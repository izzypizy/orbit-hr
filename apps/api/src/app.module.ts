import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AnnouncementsController } from './announcements/announcements.controller';
import { AttendanceController } from './attendance/attendance.controller';
import { AttendanceService } from './attendance/attendance.service';
import { AuthController } from './auth/auth.controller';
import { ClaimsController } from './claims/claims.controller';
import { ClaimsService } from './claims/claims.service';
import { AuthGuard } from './common/auth';
import { MockDb } from './data/mock-db.service';
import { EmployeesController } from './employees/employees.controller';
import { HolidaysController } from './holidays/holidays.controller';
import { LeaveController } from './leave/leave.controller';
import { LeaveService } from './leave/leave.service';
import { PayrollController } from './payroll/payroll.controller';
import { PayrollService } from './payroll/payroll.service';
import { ChecklistsController } from './talent/checklists.controller';
import { ReviewsController } from './talent/reviews.controller';
import { TrainingController } from './talent/training.controller';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [
    AuthController, EmployeesController, AnnouncementsController, HolidaysController, LeaveController, ClaimsController,
    AttendanceController, PayrollController, ChecklistsController, ReviewsController, TrainingController,
  ],
  providers: [
    MockDb, LeaveService, ClaimsService, AttendanceService, PayrollService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
