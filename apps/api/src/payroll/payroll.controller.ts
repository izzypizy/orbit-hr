import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { parse } from '../common/util';
import { PayrollService } from './payroll.service';

const periodSchema = z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'must be YYYY-MM') });

@Controller('payroll')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('payslips')
  mine(@CurrentUser() user: AuthUser) {
    return this.payroll.mine(user.id);
  }

  @Get('payslips/:id')
  payslip(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.payroll.get(user, id);
  }

  @Get('runs')
  @Roles('HR', 'FINANCE')
  runs() {
    return this.payroll.runs();
  }

  @Get('runs/:period')
  @Roles('HR', 'FINANCE')
  period(@Param('period') period: string) {
    return this.payroll.period(parse(periodSchema, { period }).period);
  }

  @Post('run')
  @Roles('HR', 'FINANCE')
  run(@Body() body: unknown) {
    return this.payroll.run(parse(periodSchema, body).period);
  }

  @Post('publish')
  @Roles('HR', 'FINANCE')
  publish(@Body() body: unknown) {
    return this.payroll.publish(parse(periodSchema, body).period);
  }
}
