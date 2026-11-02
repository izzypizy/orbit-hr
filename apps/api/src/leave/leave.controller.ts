import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { isoDate, parse } from '../common/util';
import { LeaveService } from './leave.service';

@Controller('leave')
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Get('types')
  types() {
    return this.leave.types();
  }

  @Get('balances')
  balances(@CurrentUser() user: AuthUser, @Query('year') year?: string) {
    return this.leave.balances(user.id, year ? Number(year) : undefined);
  }

  @Get('working-days')
  workingDays(@Query('start') start: string, @Query('end') end: string) {
    parse(isoDate, start);
    parse(isoDate, end);
    if (end < start) throw new BadRequestException('End date is before start date');
    return { days: this.leave.workingDays(start, end) };
  }

  @Get('calendar')
  calendar(@CurrentUser() user: AuthUser, @Query('from') from: string, @Query('to') to: string) {
    return this.leave.calendar(user, parse(isoDate, from), parse(isoDate, to));
  }

  @Get('approvals')
  @Roles('MANAGER', 'HR')
  approvals(@CurrentUser() user: AuthUser) {
    return this.leave.approvals(user);
  }

  @Get('requests')
  myRequests(@CurrentUser() user: AuthUser) {
    return this.leave.myRequests(user.id);
  }

  @Post('requests')
  apply(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.leave.apply(user, body);
  }

  @Post('requests/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.leave.cancel(user, id);
  }

  @Post('requests/:id/decision')
  @Roles('MANAGER', 'HR')
  decide(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.leave.decide(user, id, body);
  }
}
