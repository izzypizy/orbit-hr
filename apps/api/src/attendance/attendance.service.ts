import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser } from '../common/auth';
import { countWorkingDays, isoDate, localDate, localTime, nextId, now, parse, round2 } from '../common/util';
import { MockDb } from '../data/mock-db.service';
import { AttendanceRecord, OvertimeRequest } from '../data/types';

/** Clocking in after this local time counts as late. */
export const WORK_START = '09:00';

const overtimeSchema = z.object({
  date: isoDate,
  hours: z.number().min(0.5).max(12),
  reason: z.string().trim().min(3),
});

const decisionSchema = z.object({ approve: z.boolean(), comment: z.string().trim().optional() });

@Injectable()
export class AttendanceService {
  constructor(private readonly db: MockDb) {}

  today(user: AuthUser) {
    const record = this.record(user.id, localDate());
    return { date: localDate(), workStart: WORK_START, record: record ? this.view(record) : null };
  }

  clockIn(user: AuthUser) {
    const date = localDate();
    if (this.record(user.id, date)) throw new BadRequestException('You have already clocked in today');
    const record: AttendanceRecord = { id: nextId(this.db.attendance), employeeId: user.id, date, clockIn: now(), clockOut: null };
    this.db.attendance.push(record);
    return this.view(record);
  }

  clockOut(user: AuthUser) {
    const record = this.record(user.id, localDate());
    if (!record) throw new BadRequestException('You have not clocked in today');
    if (record.clockOut) throw new BadRequestException('You have already clocked out today');
    record.clockOut = now();
    return this.view(record);
  }

  /** One employee's records for a month (YYYY-MM) with a summary. */
  month(user: AuthUser, employeeId: number, month: string) {
    if (!this.db.canSeeEmployee(user, employeeId)) throw new ForbiddenException();
    const rows = this.db.attendance
      .filter((r) => r.employeeId === employeeId && r.date.startsWith(month))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((r) => this.view(r));
    return {
      rows,
      summary: {
        daysPresent: rows.length,
        lateDays: rows.filter((r) => r.late).length,
        totalHours: round2(rows.reduce((s, r) => s + (r.hours ?? 0), 0)),
      },
    };
  }

  /** Status of each visible employee on a date: HR sees everyone, managers see their team. */
  team(user: AuthUser, date: string) {
    const holidays = new Set(this.db.holidays.map((h) => h.date));
    const workingDay = countWorkingDays(date, date, holidays) === 1;
    return this.db.employees
      .filter((e) => e.joinDate <= date && (user.role === 'HR' || e.managerId === user.id))
      .map((e) => {
        const record = this.record(e.id, date);
        const leave = this.db.leaveRequests.find(
          (r) => r.employeeId === e.id && r.status === 'APPROVED' && r.startDate <= date && r.endDate >= date,
        );
        let status: string;
        if (record) status = this.isLate(record) ? 'LATE' : 'PRESENT';
        else if (leave) status = 'ON_LEAVE';
        else if (!workingDay) status = 'OFF';
        else status = date === localDate() ? 'NOT_IN' : 'ABSENT';
        return { employee: this.db.employeeView(e.id), status, record: record ? this.view(record) : null };
      });
  }

  myOvertime(employeeId: number) {
    return this.db.overtimeRequests
      .filter((o) => o.employeeId === employeeId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((o) => this.overtimeView(o));
  }

  requestOvertime(user: AuthUser, body: unknown) {
    const input = parse(overtimeSchema, body);
    if (input.date > localDate()) throw new BadRequestException('Overtime can only be claimed for today or earlier');
    const duplicate = this.db.overtimeRequests.find((o) => o.employeeId === user.id && o.date === input.date && o.status !== 'REJECTED');
    if (duplicate) throw new BadRequestException('You already have an overtime request for that date');
    const request: OvertimeRequest = {
      id: nextId(this.db.overtimeRequests), employeeId: user.id, ...input,
      status: 'PENDING', approverId: null, approverComment: null, createdAt: now(),
    };
    this.db.overtimeRequests.push(request);
    return this.overtimeView(request);
  }

  overtimeApprovals(user: AuthUser) {
    return this.db.overtimeRequests
      .filter((o) => o.status === 'PENDING' && o.employeeId !== user.id && (user.role === 'HR' || this.db.isManagerOf(user.id, o.employeeId)))
      .map((o) => this.overtimeView(o));
  }

  decideOvertime(user: AuthUser, id: number, body: unknown) {
    const { approve, comment } = parse(decisionSchema, body);
    const o = this.db.overtimeRequests.find((x) => x.id === id);
    if (!o) throw new NotFoundException('Overtime request not found');
    if (o.status !== 'PENDING') throw new BadRequestException(`Request is already ${o.status.toLowerCase()}`);
    if (o.employeeId === user.id || !(user.role === 'HR' || this.db.isManagerOf(user.id, o.employeeId))) {
      throw new ForbiddenException('You cannot decide on this request');
    }
    if (!approve && !comment) throw new BadRequestException('Please give a reason for rejecting');
    o.status = approve ? 'APPROVED' : 'REJECTED';
    o.approverId = user.id;
    o.approverComment = comment || null;
    return this.overtimeView(o);
  }

  private record(employeeId: number, date: string) {
    return this.db.attendance.find((r) => r.employeeId === employeeId && r.date === date);
  }

  private isLate(r: AttendanceRecord) {
    return localTime(r.clockIn) > WORK_START;
  }

  private view(r: AttendanceRecord) {
    const hours = r.clockOut ? round2((new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / 3_600_000) : null;
    return {
      ...r,
      clockInTime: localTime(r.clockIn),
      clockOutTime: r.clockOut ? localTime(r.clockOut) : null,
      hours,
      late: this.isLate(r),
    };
  }

  private overtimeView(o: OvertimeRequest) {
    return { ...o, employee: this.db.employeeView(o.employeeId), approver: o.approverId ? this.db.employee(o.approverId).name : null };
  }
}
