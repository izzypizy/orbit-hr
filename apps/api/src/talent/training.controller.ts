import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../common/auth';
import { isoDate, localDate, nextId, parse } from '../common/util';
import { MockDb } from '../data/mock-db.service';
import { Training } from '../data/types';

const trainingSchema = z.object({
  employeeId: z.number().int().optional(),
  title: z.string().trim().min(3),
  provider: z.string().trim().min(2),
  date: isoDate,
  hours: z.number().min(0.5).max(500),
  status: z.enum(['PLANNED', 'COMPLETED']),
  certificateExpiry: isoDate.nullable().optional(),
});

/** Employees record their own training; managers and HR can record it for their people. */
@Controller('training')
export class TrainingController {
  constructor(private readonly db: MockDb) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.db.trainings
      .filter((t) => this.db.canSeeEmployee(user, t.employeeId))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((t) => this.view(t));
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const { employeeId = user.id, certificateExpiry = null, ...input } = parse(trainingSchema, body);
    if (!this.db.canSeeEmployee(user, employeeId)) throw new ForbiddenException();
    const training: Training = { id: nextId(this.db.trainings), employeeId, certificateExpiry, ...input };
    this.db.trainings.push(training);
    return this.view(training);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    const t = this.find(user, id);
    t.status = 'COMPLETED';
    if (t.date > localDate()) t.date = localDate();
    return this.view(t);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    const t = this.find(user, id);
    this.db.trainings.splice(this.db.trainings.indexOf(t), 1);
    return { ok: true };
  }

  private find(user: AuthUser, id: number) {
    const t = this.db.trainings.find((x) => x.id === id);
    if (!t) throw new NotFoundException('Training record not found');
    if (!this.db.canSeeEmployee(user, t.employeeId)) throw new ForbiddenException();
    return t;
  }

  private view(t: Training) {
    const employee = this.db.employee(t.employeeId);
    return { ...t, employeeName: employee.name };
  }
}
