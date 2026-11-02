import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../common/auth';
import { isoDate, nextId, parse } from '../common/util';
import { MockDb } from '../data/mock-db.service';

const holidaySchema = z.object({ date: isoDate, name: z.string().trim().min(1) });

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly db: MockDb) {}

  @Get()
  list(@Query('year') year?: string) {
    return this.db.holidays
      .filter((h) => !year || h.date.startsWith(year))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  @Post()
  @Roles('HR')
  create(@Body() body: unknown) {
    const data = parse(holidaySchema, body);
    if (this.db.holidays.some((h) => h.date === data.date)) throw new BadRequestException('A holiday already exists on that date');
    const holiday = { id: nextId(this.db.holidays), ...data };
    this.db.holidays.push(holiday);
    return holiday;
  }

  @Delete(':id')
  @Roles('HR')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.db.holidays = this.db.holidays.filter((h) => h.id !== id);
    return { ok: true };
  }
}
