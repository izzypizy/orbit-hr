import { Body, Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AuthUser, CurrentUser, Public } from '../common/auth';
import { parse } from '../common/util';
import { MockDb } from '../data/mock-db.service';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

@Controller('auth')
export class AuthController {
  constructor(private readonly db: MockDb, private readonly jwt: JwtService) {}

  @Public()
  @Post('login')
  async login(@Body() body: unknown) {
    const { email, password } = parse(loginSchema, body);
    const emp = this.db.employees.find((e) => e.email === email.toLowerCase());
    if (!emp || !(await bcrypt.compare(password, emp.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const user: AuthUser = { id: emp.id, role: emp.role, name: emp.name, email: emp.email };
    return { token: await this.jwt.signAsync(user), user: this.db.employeeView(emp.id) };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.db.employeeView(user.id);
  }
}
