import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { nextId, now, parse } from '../common/util';
import { CHECKLIST_TEMPLATES } from '../data/mock-data';
import { MockDb } from '../data/mock-db.service';
import { Checklist, ChecklistTask } from '../data/types';

const createSchema = z.object({ employeeId: z.number().int(), type: z.enum(['ONBOARDING', 'OFFBOARDING']) });

@Controller('checklists')
export class ChecklistsController {
  constructor(private readonly db: MockDb) {}

  /** HR sees all, managers their team's, employees their own; Finance also sees offboarding (final pay). */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.db.checklists
      .filter((c) => this.db.canSeeEmployee(user, c.employeeId) || (user.role === 'FINANCE' && c.type === 'OFFBOARDING'))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => this.view(user, c));
  }

  @Post()
  @Roles('HR')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const { employeeId, type } = parse(createSchema, body);
    this.db.employee(employeeId);
    const open = this.db.checklists.find((c) => c.employeeId === employeeId && c.type === type && c.tasks.some((t) => !t.done));
    if (open) throw new BadRequestException(`This employee already has an open ${type.toLowerCase()} checklist`);
    let taskId = 0;
    const checklist: Checklist = {
      id: nextId(this.db.checklists), employeeId, type, createdAt: now(),
      tasks: CHECKLIST_TEMPLATES[type].map(([title, owner]) => ({ id: ++taskId, title, owner, done: false, doneAt: null, doneBy: null })),
    };
    this.db.checklists.push(checklist);
    return this.view(user, checklist);
  }

  @Post(':id/tasks/:taskId')
  setTask(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() body: unknown,
  ) {
    const { done } = parse(z.object({ done: z.boolean() }), body);
    const checklist = this.db.checklists.find((c) => c.id === id);
    const task = checklist?.tasks.find((t) => t.id === taskId);
    if (!checklist || !task) throw new NotFoundException('Task not found');
    if (!this.canComplete(user, checklist, task)) throw new ForbiddenException(`Only the ${task.owner.toLowerCase()} can complete this task`);
    task.done = done;
    task.doneAt = done ? now() : null;
    task.doneBy = done ? user.id : null;
    return this.view(user, checklist);
  }

  /** HR can tick anything; otherwise the task's owner (the employee, their manager, or Finance) does. */
  private canComplete(user: AuthUser, c: Checklist, t: ChecklistTask) {
    if (user.role === 'HR') return true;
    if (t.owner === 'EMPLOYEE') return user.id === c.employeeId;
    if (t.owner === 'MANAGER') return this.db.isManagerOf(user.id, c.employeeId);
    if (t.owner === 'FINANCE') return user.role === 'FINANCE';
    return false;
  }

  private view(user: AuthUser, c: Checklist) {
    const done = c.tasks.filter((t) => t.done).length;
    return {
      ...c,
      employee: this.db.employeeView(c.employeeId),
      progress: Math.round((done / c.tasks.length) * 100),
      tasks: c.tasks.map((t) => ({
        ...t,
        doneByName: t.doneBy ? this.db.employee(t.doneBy).name : null,
        canComplete: this.canComplete(user, c, t),
      })),
    };
  }
}
