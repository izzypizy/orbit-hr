import { BadRequestException, Body, Controller, Get, Patch, Post } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { isoDate, nextId, now, parse } from '../common/util';
import { CHECKLIST_TEMPLATES, DEMO_PASSWORD } from '../data/mock-data';
import { MockDb } from '../data/mock-db.service';
import { Employee } from '../data/types';

const profileSchema = z.object({
  phone: z.string().trim().max(30),
  address: z.string().trim().max(200),
  emergencyContactName: z.string().trim().max(100),
  emergencyContactRelation: z.string().trim().max(50),
  emergencyContactPhone: z.string().trim().max(30),
});

const newEmployeeSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().email(),
  role: z.enum(['EMPLOYEE', 'MANAGER', 'HR', 'FINANCE']),
  position: z.string().trim().min(2),
  departmentId: z.number().int(),
  managerId: z.number().int().nullable(),
  joinDate: isoDate,
  basicSalary: z.number().positive(),
});

@Controller('employees')
export class EmployeesController {
  constructor(private readonly db: MockDb) {}

  /** HR sees everyone; managers see their direct reports. */
  @Get()
  @Roles('HR', 'MANAGER')
  list(@CurrentUser() user: AuthUser) {
    return this.db.employees
      .filter((e) => user.role === 'HR' || e.managerId === user.id)
      .map((e) => this.db.employeeView(e.id));
  }

  /** Minimal company-wide list for the org chart. */
  @Get('directory')
  directory() {
    return this.db.employees.map(({ id, empNo, name, position, managerId, departmentId, email, phone }) => ({
      id, empNo, name, position, managerId, email, phone, department: this.db.department(departmentId).name,
    }));
  }

  @Get('departments')
  departments() {
    return this.db.departments;
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    Object.assign(this.db.employee(user.id), parse(profileSchema, body));
    return this.db.employeeView(user.id);
  }

  /** Adds a new hire (with the demo password) and starts their onboarding checklist. */
  @Post()
  @Roles('HR')
  async create(@Body() body: unknown) {
    const input = parse(newEmployeeSchema, body);
    const email = input.email.toLowerCase();
    if (this.db.employees.some((e) => e.email === email)) throw new BadRequestException('Email is already in use');
    if (!this.db.departments.some((d) => d.id === input.departmentId)) throw new BadRequestException('Unknown department');
    if (input.managerId !== null) this.db.employee(input.managerId);

    const id = nextId(this.db.employees);
    const employee: Employee = {
      ...input,
      id,
      email,
      empNo: `EMP${String(id).padStart(3, '0')}`,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 8),
      phone: '',
      address: '',
      emergencyContactName: '',
      emergencyContactRelation: '',
      emergencyContactPhone: '',
    };
    this.db.employees.push(employee);

    let taskId = 0;
    this.db.checklists.push({
      id: nextId(this.db.checklists),
      employeeId: id,
      type: 'ONBOARDING',
      createdAt: now(),
      tasks: CHECKLIST_TEMPLATES.ONBOARDING.map(([title, owner]) => ({ id: ++taskId, title, owner, done: false, doneAt: null, doneBy: null })),
    });
    return this.db.employeeView(id);
  }
}
