import { BadRequestException } from '@nestjs/common';
import { z, ZodTypeAny } from 'zod';

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new BadRequestException(`${issue.path.join('.') || 'body'}: ${issue.message}`);
  }
  return result.data;
}

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export const now = () => new Date().toISOString();
export const today = () => now().slice(0, 10);

export function eachDate(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

/** Counts Monday–Friday dates in the range that are not public holidays. */
export function countWorkingDays(start: string, end: string, holidays: Set<string>): number {
  return eachDate(start, end).filter((date) => {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    return dow !== 0 && dow !== 6 && !holidays.has(date);
  }).length;
}

// Attendance uses Malaysia time (UTC+8, no daylight saving)
const MY_OFFSET_MS = 8 * 60 * 60 * 1000;
export const localDate = (at: Date | string = new Date()) => new Date(new Date(at).getTime() + MY_OFFSET_MS).toISOString().slice(0, 10);
export const localTime = (at: Date | string) => new Date(new Date(at).getTime() + MY_OFFSET_MS).toISOString().slice(11, 16);
/** ISO timestamp for a Malaysia-local date and HH:mm time. */
export const fromLocal = (date: string, time: string) => new Date(`${date}T${time}:00+08:00`).toISOString();

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const nextId =(list: { id: number }[]) => list.reduce((max, x) => Math.max(max, x.id), 0) + 1;
