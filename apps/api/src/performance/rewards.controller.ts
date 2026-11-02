import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { isoDate, nextId, now, parse, round2 } from '../common/util';
import { MockDb } from '../data/mock-db.service';
import { PerformanceCycle, Reward, RewardBand } from '../data/types';

const DAY_MS = 86_400_000;

const bandsSchema = z.object({
  bands: z.array(z.object({
    minRating: z.number().min(0).max(5),
    label: z.string().trim().min(2),
    bonusMonths: z.number().min(0).max(12),
    incrementPct: z.number().min(0).max(50),
  })).min(1).max(10),
});

const calculateSchema = z.object({
  payoutPeriod: z.string().regex(/^\d{4}-\d{2}$/, 'must be YYYY-MM'),
  effectiveDate: isoDate,
});

const adjustSchema = z.object({
  bonusMonths: z.number().min(0).max(12),
  incrementPct: z.number().min(0).max(50),
  note: z.string().trim().min(3, 'Give a reason for the change'),
});

const decisionSchema = z.object({ approve: z.boolean(), comment: z.string().trim().optional() });

/**
 * Reward management: bonus and salary increment from each person's final rating.
 * HR sets the bands and calculates; HR can adjust individuals with a reason, then submits.
 * Finance approves: new salaries take effect and bonuses are paid in the chosen payroll month.
 */
@Controller('rewards')
export class RewardsController {
  constructor(private readonly db: MockDb) {}

  /** My approved rewards (reward letters). */
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.db.rewards
      .filter((r) => r.employeeId === user.id && this.db.cycle(r.cycleId).rewardStatus === 'APPROVED')
      .map((r) => this.view(r));
  }

  @Get('cycles/:id')
  @Roles('HR', 'FINANCE')
  summary(@Param('id', ParseIntPipe) id: number) {
    const cycle = this.db.cycle(id);
    const rewards = this.db.rewards.filter((r) => r.cycleId === id).map((r) => this.view(r));
    const reviews = this.db.reviews.filter((r) => r.cycleId === id);
    // Employed during the cycle but without a completed review: they get no reward until it is done
    const missing = this.db.employees
      .filter((e) => e.joinDate <= cycle.endDate && !reviews.some((r) => r.employeeId === e.id && r.status === 'COMPLETED'))
      .map((e) => {
        const review = reviews.find((r) => r.employeeId === e.id);
        return { employee: this.db.employeeView(e.id), reason: review ? `Review not completed (${review.status.replace(/_/g, ' ').toLowerCase()})` : 'No KPIs set for this cycle' };
      });
    const sum = (key: 'bonusAmount' | 'incrementAmount' | 'basicSalary') => round2(rewards.reduce((s, r) => s + r[key], 0));
    return {
      cycle: { ...cycle, decidedBy: cycle.rewardDecidedBy ? this.db.employee(cycle.rewardDecidedBy).name : null },
      rewards,
      missing,
      totals: {
        employees: rewards.length,
        bonus: sum('bonusAmount'),
        monthlyIncrement: sum('incrementAmount'),
        annualIncrement: round2(sum('incrementAmount') * 12),
        avgIncrementPct: sum('basicSalary') ? round2((sum('incrementAmount') / sum('basicSalary')) * 100) : 0,
      },
      distribution: cycle.rewardBands.map((b) => ({ label: b.label, count: rewards.filter((r) => r.band === b.label).length })),
    };
  }

  @Put('cycles/:id/bands')
  @Roles('HR')
  setBands(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const cycle = this.editable(id);
    const { bands } = parse(bandsSchema, body);
    const sorted = [...bands].sort((a, b) => b.minRating - a.minRating);
    if (sorted[sorted.length - 1].minRating !== 0) throw new BadRequestException('The lowest band must start at 0 so every rating is covered');
    if (new Set(sorted.map((b) => b.minRating)).size !== sorted.length) throw new BadRequestException('Two bands start at the same rating');
    cycle.rewardBands = sorted;
    return this.summary(id);
  }

  /** (Re)calculates every reward in the cycle from the bands. Replaces earlier adjustments. */
  @Post('cycles/:id/calculate')
  @Roles('HR')
  calculate(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const cycle = this.editable(id);
    if (cycle.status !== 'CLOSED') throw new BadRequestException('Close the cycle first so final ratings are locked');
    const input = parse(calculateSchema, body);
    if (input.payoutPeriod < cycle.endDate.slice(0, 7)) throw new BadRequestException('Pay the bonus after the cycle ends');

    for (let i = this.db.rewards.length - 1; i >= 0; i--) if (this.db.rewards[i].cycleId === id) this.db.rewards.splice(i, 1);
    for (const review of this.db.reviews.filter((r) => r.cycleId === id && r.status === 'COMPLETED')) {
      const e = this.db.employee(review.employeeId);
      const band = this.bandFor(cycle.rewardBands, review.overallRating!);
      this.db.rewards.push({
        id: nextId(this.db.rewards),
        cycleId: id,
        employeeId: e.id,
        reviewId: review.id,
        rating: review.overallRating!,
        band: band.label,
        basicSalary: this.db.basicSalaryOn(e.id, input.effectiveDate),
        prorate: this.prorate(cycle, e.joinDate),
        bonusMonths: 0, bonusAmount: 0, incrementPct: 0, incrementAmount: 0, newSalary: 0,
        adjusted: false,
        note: null,
      });
      this.price(this.db.rewards[this.db.rewards.length - 1], band.bonusMonths, band.incrementPct);
    }
    Object.assign(cycle, { ...input, rewardStatus: 'DRAFT', rewardDecidedBy: null, rewardDecidedAt: null, rewardComment: null });
    return this.summary(id);
  }

  /** HR overrides one person's bonus or increment, with a reason. */
  @Patch(':id')
  @Roles('HR')
  adjust(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const reward = this.db.rewards.find((r) => r.id === id);
    if (!reward) throw new NotFoundException('Reward not found');
    const cycle = this.editable(reward.cycleId);
    const input = parse(adjustSchema, body);
    const band = cycle.rewardBands.find((b) => b.label === reward.band)!;
    this.price(reward, input.bonusMonths, input.incrementPct);
    reward.adjusted = input.bonusMonths !== band.bonusMonths || input.incrementPct !== band.incrementPct;
    reward.note = input.note;
    return this.summary(reward.cycleId);
  }

  @Post('cycles/:id/submit')
  @Roles('HR')
  submit(@Param('id', ParseIntPipe) id: number) {
    const cycle = this.db.cycle(id);
    if (cycle.rewardStatus !== 'DRAFT') throw new BadRequestException('Calculate rewards first');
    if (!this.db.rewards.some((r) => r.cycleId === id)) throw new BadRequestException('There are no rewards to submit');
    cycle.rewardStatus = 'SUBMITTED';
    return this.summary(id);
  }

  /** Finance approves (new salaries apply from the effective date, bonus is paid in the payout month) or sends back to HR. */
  @Post('cycles/:id/decision')
  @Roles('FINANCE')
  decide(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const cycle = this.db.cycle(id);
    if (cycle.rewardStatus !== 'SUBMITTED') throw new BadRequestException('Nothing is waiting for approval');
    const { approve, comment } = parse(decisionSchema, body);
    if (!approve && !comment) throw new BadRequestException('Tell HR what to change');
    if (approve) {
      const published = this.db.payslips.some((p) => p.period === cycle.payoutPeriod && p.status === 'PUBLISHED');
      if (published) throw new BadRequestException(`Payroll for ${cycle.payoutPeriod} is already published. Ask HR to pick a later payout month`);
    }
    Object.assign(cycle, {
      rewardStatus: approve ? 'APPROVED' : 'DRAFT', rewardDecidedBy: user.id, rewardDecidedAt: now(), rewardComment: comment || null,
    });
    return this.summary(id);
  }

  private editable(cycleId: number) {
    const cycle = this.db.cycle(cycleId);
    if (cycle.rewardStatus === 'SUBMITTED') throw new BadRequestException('Rewards are waiting for Finance approval');
    if (cycle.rewardStatus === 'APPROVED') throw new BadRequestException('Rewards are already approved');
    return cycle;
  }

  private bandFor(bands: RewardBand[], rating: number) {
    return [...bands].sort((a, b) => b.minRating - a.minRating).find((b) => rating >= b.minRating)!;
  }

  /** Share of the cycle the employee was with the company (new joiners get a pro-rated bonus). */
  private prorate(cycle: PerformanceCycle, joinDate: string) {
    const start = Date.parse(cycle.startDate);
    const end = Date.parse(cycle.endDate) + DAY_MS;
    const from = Math.max(start, Date.parse(joinDate));
    return round2(Math.max(0, end - from) / (end - start));
  }

  private price(r: Reward, bonusMonths: number, incrementPct: number) {
    r.bonusMonths = bonusMonths;
    r.incrementPct = incrementPct;
    r.bonusAmount = round2(r.basicSalary * bonusMonths * r.prorate);
    r.incrementAmount = round2((r.basicSalary * incrementPct) / 100);
    r.newSalary = round2(r.basicSalary + r.incrementAmount);
  }

  private view(r: Reward) {
    const cycle = this.db.cycle(r.cycleId);
    return {
      ...r,
      cycle: cycle.name,
      payoutPeriod: cycle.payoutPeriod,
      effectiveDate: cycle.effectiveDate,
      employee: this.db.employeeView(r.employeeId),
    };
  }
}
