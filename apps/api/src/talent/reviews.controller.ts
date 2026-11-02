import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { localDate, nextId, now, parse } from '../common/util';
import { MockDb } from '../data/mock-db.service';
import { Review } from '../data/types';
import { periodsFor, scoreKpi, scoreReview, weightedRating } from '../performance/kpi-scoring';

const kpiSchema = z.object({
  title: z.string().trim().min(3),
  weight: z.number().int().min(5).max(100),
  unit: z.string().trim().min(1).max(20),
  frequency: z.enum(['MONTHLY', 'QUARTERLY', 'HALF_YEARLY']),
  aggregation: z.enum(['AVERAGE', 'TOTAL', 'LATEST']),
  direction: z.enum(['HIGHER', 'LOWER']),
  scale: z.tuple([z.number(), z.number(), z.number(), z.number()]),
}).refine(
  (k) => k.scale.every((t, i) => i === 0 || (k.direction === 'HIGHER' ? t > k.scale[i - 1] : t < k.scale[i - 1])),
  (k) => ({ message: `"${k.title}": each rating must start ${k.direction === 'HIGHER' ? 'higher' : 'lower'} than the one before`, path: ['scale'] }),
);

const createSchema = z.object({
  employeeId: z.number().int(),
  cycleId: z.number().int(),
  kpis: z.array(kpiSchema).min(1).max(10),
});

const entrySchema = z.object({
  kpiId: z.number().int(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  value: z.number(),
  note: z.string().trim().max(500).optional(),
});

const ratingsSchema = z.object({
  ratings: z.array(z.object({ kpiId: z.number().int(), rating: z.number().int().min(1).max(5), comment: z.string().trim().optional() })),
  summary: z.string().trim().optional(),
});

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly db: MockDb) {}

  /** Reviews about me, reviews I write, or all of them for HR. */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.db.reviews
      .filter((r) => this.canView(user, r))
      .sort((a, b) => b.cycleId - a.cycleId || a.employeeId - b.employeeId)
      .map((r) => this.view(r));
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    const r = this.find(id);
    if (!this.canView(user, r)) throw new ForbiddenException();
    return this.view(r);
  }

  /** HR, or the employee's manager, sets KPIs for a cycle. The employee's manager is the reviewer. */
  @Post()
  @Roles('HR', 'MANAGER')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = parse(createSchema, body);
    const employee = this.db.employee(input.employeeId);
    const cycle = this.db.cycle(input.cycleId);
    if (user.role !== 'HR' && employee.managerId !== user.id) throw new ForbiddenException('You can only set KPIs for your own team');
    if (cycle.status === 'CLOSED') throw new BadRequestException(`${cycle.name} is closed`);
    if (input.kpis.reduce((s, k) => s + k.weight, 0) !== 100) throw new BadRequestException('KPI weights must add up to 100%');
    if (this.db.reviews.some((r) => r.employeeId === employee.id && r.cycleId === cycle.id)) {
      throw new BadRequestException(`${employee.name} already has KPIs for ${cycle.name}`);
    }
    let kpiId = Math.max(0, ...this.db.reviews.flatMap((r) => r.kpis.map((k) => k.id)));
    const review: Review = {
      id: nextId(this.db.reviews),
      employeeId: employee.id,
      reviewerId: employee.managerId ?? user.id,
      cycleId: cycle.id,
      status: cycle.status === 'TRACKING' ? 'IN_PROGRESS' : 'SELF_REVIEW',
      kpis: input.kpis.map((k) => ({ id: ++kpiId, ...k, selfRating: null, selfComment: null, managerRating: null, managerComment: null })),
      overallRating: null,
      managerSummary: null,
      createdAt: now(),
      completedAt: null,
    };
    this.db.reviews.push(review);
    return this.view(review);
  }

  /**
   * Enter (or correct) a KPI's figure for one period, e.g. June sales. The employee, their reviewer or HR can do this
   * for any period that has started, until the review is completed.
   */
  @Post(':id/entries')
  enter(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const r = this.find(id);
    if (r.employeeId !== user.id && r.reviewerId !== user.id && user.role !== 'HR') throw new ForbiddenException();
    if (r.status === 'COMPLETED') throw new BadRequestException('This review is completed');
    const input = parse(entrySchema, body);
    const kpi = r.kpis.find((k) => k.id === input.kpiId);
    if (!kpi) throw new NotFoundException('KPI not found');
    const period = periodsFor(this.db.cycle(r.cycleId), kpi.frequency).find((p) => p.key === input.period);
    if (!period) throw new BadRequestException(`${input.period} is not a ${kpi.frequency.toLowerCase().replace('_', '-')} period of this cycle`);
    if (period.start > localDate()) throw new BadRequestException(`${period.label} has not started yet`);

    const existing = this.db.kpiEntries.find((e) => e.kpiId === kpi.id && e.period === period.key);
    const fields = { value: input.value, note: input.note || null, byId: user.id, updatedAt: now() };
    if (existing) Object.assign(existing, fields);
    else this.db.kpiEntries.push({ id: nextId(this.db.kpiEntries), reviewId: r.id, kpiId: kpi.id, period: period.key, ...fields });
    return this.view(r);
  }

  @Post(':id/self')
  selfReview(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const r = this.find(id);
    if (r.employeeId !== user.id) throw new ForbiddenException();
    if (r.status === 'IN_PROGRESS') throw new BadRequestException('Self-review opens when HR starts the review phase');
    if (r.status !== 'SELF_REVIEW') throw new BadRequestException('Self-review is already submitted');
    this.applyRatings(r, body, 'self');
    r.status = 'MANAGER_REVIEW';
    return this.view(r);
  }

  /** The reviewer confirms each KPI's rating. Changing the rating the scale gives needs a reason. */
  @Post(':id/manager')
  managerReview(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const r = this.find(id);
    if (r.reviewerId !== user.id) throw new ForbiddenException('Only the assigned reviewer can complete this review');
    if (r.status !== 'MANAGER_REVIEW') throw new BadRequestException('Waiting for the employee self-review');
    const input = parse(ratingsSchema, body);
    const cycle = this.db.cycle(r.cycleId);
    for (const kpi of r.kpis) {
      const given = input.ratings.find((x) => x.kpiId === kpi.id);
      const fromScale = scoreKpi(kpi, this.db.kpiEntries, cycle, localDate()).rating ?? 1;
      if (given && given.rating !== fromScale && !given.comment) {
        throw new BadRequestException(`"${kpi.title}": the scale gives ${fromScale}. Add a comment explaining the change to ${given.rating}`);
      }
    }
    const { summary } = this.applyRatings(r, body, 'manager');
    if (!summary) throw new BadRequestException('Please write an overall summary');
    r.managerSummary = summary;
    r.overallRating = weightedRating(r.kpis.map((k) => ({ weight: k.weight, rating: k.managerRating! })));
    r.status = 'COMPLETED';
    r.completedAt = now();
    return this.view(r);
  }

  private applyRatings(r: Review, body: unknown, who: 'self' | 'manager') {
    const input = parse(ratingsSchema, body);
    for (const kpi of r.kpis) {
      const rating = input.ratings.find((x) => x.kpiId === kpi.id);
      if (!rating) throw new BadRequestException(`Please rate "${kpi.title}"`);
      if (who === 'self') {
        kpi.selfRating = rating.rating;
        kpi.selfComment = rating.comment || null;
      } else {
        kpi.managerRating = rating.rating;
        kpi.managerComment = rating.comment || null;
      }
    }
    return input;
  }

  private canView(user: AuthUser, r: Review) {
    return user.role === 'HR' || r.employeeId === user.id || r.reviewerId === user.id;
  }

  private find(id: number) {
    const r = this.db.reviews.find((x) => x.id === id);
    if (!r) throw new NotFoundException('Review not found');
    return r;
  }

  private view(r: Review) {
    const cycle = this.db.cycle(r.cycleId);
    const scored = scoreReview(r, this.db.kpiEntries, cycle, localDate());
    const name = (id: number | null) => (id ? this.db.employee(id).name : null);
    return {
      ...r,
      ...scored,
      kpis: scored.kpis.map((k) => ({ ...k, periods: k.periods.map((p) => ({ ...p, by: name(p.byId) })) })),
      cycle: { id: cycle.id, name: cycle.name, status: cycle.status, startDate: cycle.startDate, endDate: cycle.endDate },
      employee: this.db.employeeView(r.employeeId),
      reviewer: this.db.employee(r.reviewerId).name,
    };
  }
}
