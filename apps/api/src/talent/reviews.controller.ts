import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { nextId, now, parse } from '../common/util';
import { MockDb } from '../data/mock-db.service';
import { Review } from '../data/types';

const createSchema = z.object({
  employeeId: z.number().int(),
  cycle: z.string().trim().min(3),
  kpis: z.array(z.object({ title: z.string().trim().min(3), weight: z.number().int().min(5).max(100) })).min(1).max(10),
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
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => this.view(r));
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    const r = this.find(id);
    if (!this.canView(user, r)) throw new ForbiddenException();
    return this.view(r);
  }

  /** HR, or the employee's manager, starts a review. The employee's manager is the reviewer. */
  @Post()
  @Roles('HR', 'MANAGER')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = parse(createSchema, body);
    const employee = this.db.employee(input.employeeId);
    if (user.role !== 'HR' && employee.managerId !== user.id) throw new ForbiddenException('You can only review your own team');
    if (input.kpis.reduce((s, k) => s + k.weight, 0) !== 100) throw new BadRequestException('KPI weights must add up to 100%');
    if (this.db.reviews.some((r) => r.employeeId === employee.id && r.cycle === input.cycle)) {
      throw new BadRequestException(`${employee.name} already has a "${input.cycle}" review`);
    }
    let kpiId = Math.max(0, ...this.db.reviews.flatMap((r) => r.kpis.map((k) => k.id)));
    const review: Review = {
      id: nextId(this.db.reviews),
      employeeId: employee.id,
      reviewerId: employee.managerId ?? user.id,
      cycle: input.cycle,
      status: 'SELF_REVIEW',
      kpis: input.kpis.map((k) => ({ id: ++kpiId, ...k, selfRating: null, selfComment: null, managerRating: null, managerComment: null })),
      overallRating: null,
      managerSummary: null,
      createdAt: now(),
      completedAt: null,
    };
    this.db.reviews.push(review);
    return this.view(review);
  }

  @Post(':id/self')
  selfReview(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    const r = this.find(id);
    if (r.employeeId !== user.id) throw new ForbiddenException();
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
    r.overallRating = Math.round(r.kpis.reduce((s, k) => s + k.managerRating! * k.weight, 0) / 10) / 10;
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
    return { ...r, employee: this.db.employeeView(r.employeeId), reviewer: this.db.employee(r.reviewerId).name };
  }
}
