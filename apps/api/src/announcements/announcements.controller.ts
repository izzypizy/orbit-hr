import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { nextId, now, parse } from '../common/util';
import { MockDb } from '../data/mock-db.service';

const announcementSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(2000),
  pinned: z.boolean().default(false),
});

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly db: MockDb) {}

  /** Pinned first, then newest first. */
  @Get()
  list() {
    return [...this.db.announcements]
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt))
      .map((a) => ({ ...a, author: this.db.employee(a.authorId).name }));
  }

  @Post()
  @Roles('HR')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const announcement = { id: nextId(this.db.announcements), ...parse(announcementSchema, body), authorId: user.id, createdAt: now() };
    this.db.announcements.push(announcement);
    return announcement;
  }

  @Delete(':id')
  @Roles('HR')
  remove(@Param('id', ParseIntPipe) id: number) {
    this.db.announcements = this.db.announcements.filter((a) => a.id !== id);
    return { ok: true };
  }
}
