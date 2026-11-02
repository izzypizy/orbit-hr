import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { localDate, nextId, now, parse } from '../common/util';
import { MockDb } from '../data/mock-db.service';
import { Review } from '../data/types';
import { scoreReview, weightedRating } from '../performance/kpi-scoring';

const kpiSchema = z.object({
  title: z.string().trim().min(3),
  weight: z.number().int().min(5).max(100),
  unit: z.string().trim().min(1).max(20),
  target: z.number().min(0),
  direction: z.enum(['HIGHER', 'LOWER']),
  tracking: z.enum(['CUMULATIVE', 'LEVEL']),
}).refine((k) => k.direction === 'LOWER' || k.target > 0, { message: 'Target must be more than 0', path: ['target'] });

const createSchema = z.object({
  employeeId: z.number().int(),
  cycleId: z.number().int(),
  kpis: z.array(kpiSchema).min(1).max(10),
});

const checkInSchema = z.object({
  kpiId: z.number().int(),
  value: z.number().min(0),
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
    return { ...this.view(r), checkIns: this.checkIns(r) };
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
      kpis: input.kpis.map((k) => ({
        id: ++kpiId, ...k, actual: null, selfRating: null, selfComment: null, managerRating: null, managerComment: null,
      })),
      overallRating: null,
      managerSummary: null,
      createdAt: now(),
      completedAt: null,
    };
    this.db.reviews.push(review);
    return this.view(review);
  }

  /** Log the latest value of a KPI. The employee, their reviewer or HR can update progress until the review is completed. */
  @Post(':id/check-ins')
  checkIn(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const r = this.find(id);
    if (r.employeeId !== user.id && r.reviewerId !== user.id && user.role !== 'HR') throw new ForbiddenException();
    if (r.status === 'COMPLETED') throw new BadRequestException('This review is completed');
    const input = parse(checkInSchema, body);
    const kpi = r.kpis.find((k) => k.id === input.kpiId);
    if (!kpi) throw new NotFoundException('KPI not found');
    kpi.actual = input.value;
    this.db.kpiCheckIns.push({
      id: nextId(this.db.kpiCheckIns), reviewId: r.id, kpiId: kpi.id, date: localDate(), value: input.value, note: input.note || null, byId: user.id,
    });
    return { ...this.view(r), checkIns: this.checkIns(r) };
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

  @Post(':id/manager')
  managerReview(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const r = this.find(id);
    if (r.reviewerId !== user.id) throw new ForbiddenException('Only the assigned reviewer can complete this review');
    if (r.status !== 'MANAGER_REVIEW') throw new BadRequestException('Waiting for the employee self-review');
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

  private checkIns(r: Review) {
    return this.db.kpiCheckIns
      .filter((c) => c.reviewId === r.id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
      .map((c) => ({ ...c, by: this.db.employee(c.byId).name }));
  }

  private view(r: Review) {
    const cycle = this.db.cycle(r.cycleId);
    return {
      ...r,
      ...scoreReview(r, cycle, localDate()),
      cycle: { id: cycle.id, name: cycle.name, status: cycle.status, startDate: cycle.startDate, endDate: cycle.endDate },
      employee: this.db.employeeView(r.employeeId),
      reviewer: this.db.employee(r.reviewerId).name,
    };
  }
}
