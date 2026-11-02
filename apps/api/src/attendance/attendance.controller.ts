import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { isoDate, localDate, parse } from '../common/util';
import { AttendanceService } from './attendance.service';

const month = z.string().regex(/^\d{4}-\d{2}$/, 'must be YYYY-MM');

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.attendance.today(user);
  }

  @Post('clock-in')
  clockIn(@CurrentUser() user: AuthUser) {
    return this.attendance.clockIn(user);
  }

  @Post('clock-out')
  clockOut(@CurrentUser() user: AuthUser) {
    return this.attendance.clockOut(user);
  }

  /** ?month=YYYY-MM&employeeId= (employeeId defaults to the current user) */
  @Get('records')
  records(@CurrentUser() user: AuthUser, @Query('month') m?: string, @Query('employeeId') employeeId?: string) {
    return this.attendance.month(user, employeeId ? Number(employeeId) : user.id, parse(month, m ?? localDate().slice(0, 7)));
  }

  @Get('team')
  @Roles('MANAGER', 'HR')
  team(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return this.attendance.team(user, parse(isoDate, date ?? localDate()));
  }

  @Get('overtime')
  myOvertime(@CurrentUser() user: AuthUser) {
    return this.attendance.myOvertime(user.id);
  }

  @Post('overtime')
  requestOvertime(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.attendance.requestOvertime(user, body);
  }

  @Get('overtime/approvals')
  @Roles('MANAGER', 'HR')
  overtimeApprovals(@CurrentUser() user: AuthUser) {
    return this.attendance.overtimeApprovals(user);
  }

  @Post('overtime/:id/decision')
  @Roles('MANAGER', 'HR')
  decideOvertime(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.attendance.decideOvertime(user, id, body);
  }
}
