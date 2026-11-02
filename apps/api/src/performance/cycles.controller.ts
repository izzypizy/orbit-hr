import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { isoDate, localDate, nextId, parse } from '../common/util';
import { DEFAULT_REWARD_BANDS } from '../data/mock-data';
import { MockDb } from '../data/mock-db.service';
import { PerformanceCycle } from '../data/types';
import { elapsed, scoreReview } from './kpi-scoring';

const createSchema = z.object({
  name: z.string().trim().min(3),
  startDate: isoDate,
  endDate: isoDate,
}).refine((c) => c.endDate > c.startDate, { message: 'End date must be after the start date', path: ['endDate'] });

@Controller('cycles')
export class CyclesController {
  constructor(private readonly db: MockDb) {}

  @Get()
  list() {
    return [...this.db.cycles].sort((a, b) => b.startDate.localeCompare(a.startDate)).map((c) => this.view(c));
  }

  @Post()
  @Roles('HR')
  create(@Body() body: unknown) {
    const input = parse(createSchema, body);
    if (this.db.cycles.some((c) => c.name.toLowerCase() === input.name.toLowerCase())) throw new BadRequestException(`"${input.name}" already exists`);
    return this.view(this.add(input));
  }

  /** Creates the two half-year cycles for a year: H1 (Jan–Jun, evaluated in June) and H2 (Jul–Dec, evaluated in December). */
  @Post('half-years')
  @Roles('HR')
  halfYears(@Body() body: unknown) {
    const { year } = parse(z.object({ year: z.number().int().min(2000).max(2100) }), body);
    const halves = [
      { name: `${year} H1`, startDate: `${year}-01-01`, endDate: `${year}-06-30` },
      { name: `${year} H2`, startDate: `${year}-07-01`, endDate: `${year}-12-31` },
    ].filter((h) => !this.db.cycles.some((c) => c.name === h.name));
    if (!halves.length) throw new BadRequestException(`${year} H1 and H2 already exist`);
    return halves.map((h) => this.view(this.add(h)));
  }

  private add(input: { name: string; startDate: string; endDate: string }) {
    const cycle: PerformanceCycle = {
      id: nextId(this.db.cycles), ...input, status: 'TRACKING',
      rewardBands: DEFAULT_REWARD_BANDS.map((b) => ({ ...b })),
      rewardStatus: 'NOT_STARTED', payoutPeriod: null, effectiveDate: null, rewardDecidedBy: null, rewardDecidedAt: null, rewardComment: null,
    };
    this.db.cycles.push(cycle);
    return cycle;
  }

  /** Ends KPI tracking: every review in the cycle moves to self-review. */
  @Post(':id/start-review')
  @Roles('HR')
  startReview(@Param('id', ParseIntPipe) id: number) {
    const cycle = this.db.cycle(id);
    if (cycle.status !== 'TRACKING') throw new BadRequestException(`${cycle.name} is not in the tracking phase`);
    cycle.status = 'REVIEW';
    this.db.reviews.filter((r) => r.cycleId === id && r.status === 'IN_PROGRESS').forEach((r) => (r.status = 'SELF_REVIEW'));
    return this.view(cycle);
  }

  /** Locks final ratings so rewards can be calculated. */
  @Post(':id/close')
  @Roles('HR')
  close(@Param('id', ParseIntPipe) id: number) {
    const cycle = this.db.cycle(id);
    if (cycle.status !== 'REVIEW') throw new BadRequestException('Start the review phase first');
    const open = this.db.reviews.filter((r) => r.cycleId === id && r.status !== 'COMPLETED');
    if (open.length) throw new BadRequestException(`${open.length} review(s) are not completed yet`);
    cycle.status = 'CLOSED';
    return this.view(cycle);
  }

  /** KPI progress for everyone in the cycle (HR) or the manager's team. */
  @Get(':id/monitor')
  @Roles('HR', 'MANAGER')
  monitor(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    const cycle = this.db.cycle(id);
    const date = localDate();
    const reviews = this.db.reviews.filter((r) => r.cycleId === id && (user.role === 'HR' || r.reviewerId === user.id));
    const rows = reviews.map((r) => {
      const lastUpdate = this.db.kpiEntries.filter((e) => e.reviewId === r.id).reduce<string | null>((max, e) => (!max || e.updatedAt > max ? e.updatedAt : max), null);
      return { reviewId: r.id, status: r.status, overallRating: r.overallRating, employee: this.db.employeeView(r.employeeId), lastUpdate, ...scoreReview(r, this.db.kpiEntries, cycle, date) };
    });
    // People who should have KPIs (anyone with a manager to review them) but don't yet
    const team = this.db.employees.filter((e) =>
      e.joinDate <= cycle.endDate && (user.role === 'HR' ? e.managerId != null : e.managerId === user.id));
    const withoutKpis = team.filter((e) => !reviews.some((r) => r.employeeId === e.id)).map((e) => this.db.employeeView(e.id));
    return { cycle: this.view(cycle), rows, withoutKpis };
  }

  private view(c: PerformanceCycle) {
    const reviews = this.db.reviews.filter((r) => r.cycleId === c.id);
    return {
      ...c,
      elapsed: Math.round(elapsed(c, localDate()) * 100),
      reviews: reviews.length,
      completed: reviews.filter((r) => r.status === 'COMPLETED').length,
    };
  }
}
