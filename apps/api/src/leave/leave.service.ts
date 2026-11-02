import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser } from '../common/auth';
import { countWorkingDays, isoDate, nextId, now, parse, today } from '../common/util';
import { MockDb } from '../data/mock-db.service';
import { LeaveRequest } from '../data/types';

const applySchema = z.object({
  leaveTypeId: z.number().int(),
  startDate: isoDate,
  endDate: isoDate,
  halfDay: z.boolean().default(false),
  reason: z.string().trim().min(3, 'please give a short reason'),
});

const decisionSchema = z.object({ approve: z.boolean(), comment: z.string().trim().optional() });

@Injectable()
export class LeaveService {
  constructor(private readonly db: MockDb) {}

  types() {
    return this.db.leaveTypes;
  }

  balances(employeeId: number, year = new Date().getUTCFullYear()) {
    return this.db.leaveTypes.map((type) => {
      const b = this.balance(employeeId, type.id, year);
      const available = type.defaultDays == null ? null : b.entitled - b.taken - b.pending;
      return { ...b, leaveType: type, available };
    });
  }

  workingDays(start: string, end: string) {
    return countWorkingDays(start, end, new Set(this.db.holidays.map((h) => h.date)));
  }

  myRequests(employeeId: number) {
    return this.db.leaveRequests
      .filter((r) => r.employeeId === employeeId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .map((r) => this.view(r));
  }

  apply(user: AuthUser, body: unknown) {
    const input = parse(applySchema, body);
    const type = this.db.leaveTypes.find((t) => t.id === input.leaveTypeId);
    if (!type) throw new BadRequestException('Unknown leave type');
    if (input.endDate < input.startDate) throw new BadRequestException('End date is before start date');
    if (input.startDate.slice(0, 4) !== input.endDate.slice(0, 4)) {
      throw new BadRequestException('Leave cannot span two years; please submit two requests');
    }
    if (input.halfDay && input.startDate !== input.endDate) throw new BadRequestException('Half day applies to a single date only');

    let days = this.workingDays(input.startDate, input.endDate);
    if (days === 0) throw new BadRequestException('The selected dates are weekends or public holidays');
    if (input.halfDay) days = 0.5;

    const overlap = this.db.leaveRequests.find(
      (r) => r.employeeId === user.id && ['PENDING', 'APPROVED'].includes(r.status)
        && r.startDate <= input.endDate && r.endDate >= input.startDate,
    );
    if (overlap) throw new BadRequestException(`Overlaps an existing request (${overlap.startDate} to ${overlap.endDate})`);

    const balance = this.balance(user.id, type.id, Number(input.startDate.slice(0, 4)));
    if (type.defaultDays != null) {
      const available = balance.entitled - balance.taken - balance.pending;
      if (days > available) throw new BadRequestException(`Insufficient ${type.name} balance: ${available} day(s) available, ${days} requested`);
    }

    const request: LeaveRequest = {
      id: nextId(this.db.leaveRequests),
      employeeId: user.id,
      ...input,
      days,
      status: 'PENDING',
      approverId: null,
      approverComment: null,
      decidedAt: null,
      createdAt: now(),
    };
    this.db.leaveRequests.push(request);
    balance.pending += days;
    return this.view(request);
  }

  cancel(user: AuthUser, id: number) {
    const r = this.find(id);
    if (r.employeeId !== user.id) throw new ForbiddenException();
    if (r.status === 'APPROVED' && r.startDate <= today()) throw new BadRequestException('Leave that has already started cannot be cancelled');
    if (r.status !== 'PENDING' && r.status !== 'APPROVED') throw new BadRequestException(`Request is already ${r.status.toLowerCase()}`);

    const balance = this.balance(r.employeeId, r.leaveTypeId, Number(r.startDate.slice(0, 4)));
    if (r.status === 'PENDING') balance.pending -= r.days;
    else balance.taken -= r.days;
    r.status = 'CANCELLED';
    return this.view(r);
  }

  /** Requests waiting for this user's decision: direct reports for managers, everyone for HR. */
  approvals(user: AuthUser) {
    return this.db.leaveRequests
      .filter((r) => r.status === 'PENDING' && r.employeeId !== user.id && this.canDecide(user, r))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((r) => this.view(r));
  }

  decide(user: AuthUser, id: number, body: unknown) {
    const { approve, comment } = parse(decisionSchema, body);
    const r = this.find(id);
    if (r.status !== 'PENDING') throw new BadRequestException(`Request is already ${r.status.toLowerCase()}`);
    if (r.employeeId === user.id || !this.canDecide(user, r)) throw new ForbiddenException('You cannot decide on this request');
    if (!approve && !comment) throw new BadRequestException('Please give a reason for rejecting');

    const balance = this.balance(r.employeeId, r.leaveTypeId, Number(r.startDate.slice(0, 4)));
    balance.pending -= r.days;
    if (approve) balance.taken += r.days;

    r.status = approve ? 'APPROVED' : 'REJECTED';
    r.approverId = user.id;
    r.approverComment = comment || null;
    r.decidedAt = now();
    return this.view(r);
  }

  /** Approved and pending leave in a date range. Employees see their department; HR sees everyone. */
  calendar(user: AuthUser, from: string, to: string) {
    const me = this.db.employee(user.id);
    return this.db.leaveRequests
      .filter((r) => ['PENDING', 'APPROVED'].includes(r.status) && r.startDate <= to && r.endDate >= from)
      .filter((r) => user.role === 'HR' || this.db.employee(r.employeeId).departmentId === me.departmentId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((r) => this.view(r));
  }

  private canDecide(user: AuthUser, r: LeaveRequest) {
    return user.role === 'HR' || this.db.employee(r.employeeId).managerId === user.id;
  }

  private find(id: number) {
    const r = this.db.leaveRequests.find((x) => x.id === id);
    if (!r) throw new NotFoundException('Leave request not found');
    return r;
  }

  private balance(employeeId: number, leaveTypeId: number, year: number) {
    let b = this.db.leaveBalances.find((x) => x.employeeId === employeeId && x.leaveTypeId === leaveTypeId && x.year === year);
    if (!b) {
      const type = this.db.leaveTypes.find((t) => t.id === leaveTypeId)!;
      b = { employeeId, leaveTypeId, year, entitled: type.defaultDays ?? 0, taken: 0, pending: 0 };
      this.db.leaveBalances.push(b);
    }
    return b;
  }

  private view(r: LeaveRequest) {
    return {
      ...r,
      leaveType: this.db.leaveTypes.find((t) => t.id === r.leaveTypeId),
      employee: this.db.employeeView(r.employeeId),
      approver: r.approverId ? this.db.employee(r.approverId).name : null,
    };
  }
}
