import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { AuthUser } from '../common/auth';
import { nextId, now, round2 } from '../common/util';
import { MockDb } from '../data/mock-db.service';
import { Employee, Payslip } from '../data/types';

// Simplified demo rules. Real Malaysian payroll uses the official EPF/SOCSO/EIS contribution tables and PCB (tax);
// replace these before using the numbers for anything real.
const FIXED_ALLOWANCE = 300;
const WORKING_DAYS_PER_MONTH = 26; // Employment Act basis for daily rate
const OVERTIME_MULTIPLIER = 1.5;
const EPF_EMPLOYEE = 0.11;
const EPF_EMPLOYER = (wage: number) => (wage <= 5000 ? 0.13 : 0.12);
const SOCSO_EIS_WAGE_CEILING = 6000;
const SOCSO_EMPLOYEE = 0.005;
const EIS_EMPLOYEE = 0.002;

@Injectable()
export class PayrollService implements OnModuleInit {
  constructor(private readonly db: MockDb) {}

  /** Seed two published months so employees have payslips to look at. */
  onModuleInit() {
    for (const period of ['2026-08', '2026-09']) {
      this.run(period);
      this.publish(period);
    }
  }

  /** Summary of every payroll period. */
  runs() {
    const periods = [...new Set(this.db.payslips.map((p) => p.period))].sort().reverse();
    return periods.map((period) => {
      const slips = this.db.payslips.filter((p) => p.period === period);
      const sum = (key: keyof Payslip) => round2(slips.reduce((s, p) => s + (p[key] as number), 0));
      return { period, status: slips[0].status, employees: slips.length, grossPay: sum('grossPay'), netPay: sum('netPay'), epfEmployer: sum('epfEmployer') };
    });
  }

  period(period: string) {
    return this.db.payslips.filter((p) => p.period === period).map((p) => this.view(p));
  }

  /** (Re)generates draft payslips for everyone employed in the period. */
  run(period: string) {
    if (this.db.payslips.some((p) => p.period === period && p.status === 'PUBLISHED')) {
      throw new BadRequestException(`Payroll for ${period} is already published`);
    }
    const lastDay = `${period}-31`;
    for (let i = this.db.payslips.length - 1; i >= 0; i--) {
      if (this.db.payslips[i].period === period) this.db.payslips.splice(i, 1);
    }
    for (const e of this.db.employees.filter((x) => x.joinDate <= lastDay)) {
      this.db.payslips.push(this.calculate(e, period));
    }
    return this.runs().find((r) => r.period === period);
  }

  publish(period: string) {
    const slips = this.db.payslips.filter((p) => p.period === period);
    if (!slips.length) throw new BadRequestException(`Run payroll for ${period} first`);
    slips.forEach((p) => (p.status = 'PUBLISHED'));
    return this.runs().find((r) => r.period === period);
  }

  mine(employeeId: number) {
    return this.db.payslips
      .filter((p) => p.employeeId === employeeId && p.status === 'PUBLISHED')
      .sort((a, b) => b.period.localeCompare(a.period))
      .map((p) => this.view(p));
  }

  get(user: AuthUser, id: number) {
    const p = this.db.payslips.find((x) => x.id === id);
    if (!p) throw new NotFoundException('Payslip not found');
    const isOwner = p.employeeId === user.id && p.status === 'PUBLISHED';
    if (!isOwner && user.role !== 'HR' && user.role !== 'FINANCE') throw new ForbiddenException();
    return this.view(p);
  }

  private calculate(e: Employee, period: string): Payslip {
    // Increments approved in reward management apply from their effective date
    const basic = this.db.basicSalaryOn(e.id, `${period}-31`);
    const dailyRate = basic / WORKING_DAYS_PER_MONTH;

    const overtimeHours = this.db.overtimeRequests
      .filter((o) => o.employeeId === e.id && o.status === 'APPROVED' && o.date.startsWith(period))
      .reduce((s, o) => s + o.hours, 0);
    const overtimePay = round2(overtimeHours * (dailyRate / 8) * OVERTIME_MULTIPLIER);

    const unpaidType = this.db.leaveTypes.filter((t) => !t.isPaid).map((t) => t.id);
    const unpaidLeaveDays = this.db.leaveRequests
      .filter((r) => r.employeeId === e.id && r.status === 'APPROVED' && unpaidType.includes(r.leaveTypeId) && r.startDate.startsWith(period))
      .reduce((s, r) => s + r.days, 0);
    const unpaidLeaveDeduction = round2(unpaidLeaveDays * dailyRate);

    const claimsReimbursed = round2(this.db.claims
      .filter((c) => c.employeeId === e.id && c.status === 'PAID' && c.paidAt?.startsWith(period))
      .reduce((s, c) => s + c.totalAmount, 0));

    // Performance bonus from approved rewards paid in this month
    const bonus = round2(this.db.rewards
      .filter((r) => r.employeeId === e.id && r.bonusAmount > 0)
      .filter((r) => {
        const c = this.db.cycle(r.cycleId);
        return c.rewardStatus === 'APPROVED' && c.payoutPeriod === period;
      })
      .reduce((s, r) => s + r.bonusAmount, 0));

    const grossPay = round2(basic + FIXED_ALLOWANCE + overtimePay + bonus - unpaidLeaveDeduction);
    const statutoryWage = basic + FIXED_ALLOWANCE - unpaidLeaveDeduction;
    const capped = Math.min(statutoryWage, SOCSO_EIS_WAGE_CEILING);
    // EPF is due on bonuses; SOCSO and EIS are not
    const epfWage = statutoryWage + bonus;
    const epfEmployee = round2(epfWage * EPF_EMPLOYEE);
    const socso = round2(capped * SOCSO_EMPLOYEE);
    const eis = round2(capped * EIS_EMPLOYEE);

    return {
      id: nextId(this.db.payslips),
      employeeId: e.id,
      period,
      status: 'DRAFT',
      basic,
      allowance: FIXED_ALLOWANCE,
      overtimeHours,
      overtimePay,
      bonus,
      unpaidLeaveDays,
      unpaidLeaveDeduction,
      grossPay,
      epfEmployee,
      socso,
      eis,
      claimsReimbursed,
      netPay: round2(grossPay - epfEmployee - socso - eis + claimsReimbursed),
      epfEmployer: round2(epfWage * EPF_EMPLOYER(statutoryWage)),
      generatedAt: now(),
    };
  }

  private view(p: Payslip) {
    return { ...p, employee: this.db.employeeView(p.employeeId) };
  }
}
