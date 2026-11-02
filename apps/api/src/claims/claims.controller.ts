import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Res, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { ClaimsService } from './claims.service';

@Controller('claims')
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Get('categories')
  categories() {
    return this.claims.categories();
  }

  @Get('approvals')
  @Roles('MANAGER', 'HR', 'FINANCE')
  approvals(@CurrentUser() user: AuthUser) {
    return this.claims.approvals(user);
  }

  @Get('payable')
  @Roles('FINANCE')
  payable() {
    return this.claims.payable();
  }

  @Get()
  myClaims(@CurrentUser() user: AuthUser) {
    return this.claims.myClaims(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.claims.create(user, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.claims.get(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.claims.remove(user, id);
  }

  @Post(':id/items')
  addItem(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.claims.addItem(user, id, body);
  }

  @Delete('items/:itemId')
  removeItem(@CurrentUser() user: AuthUser, @Param('itemId', ParseIntPipe) itemId: number) {
    return this.claims.removeItem(user, itemId);
  }

  @Post('items/:itemId/receipt')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  attachReceipt(
    @CurrentUser() user: AuthUser,
    @Param('itemId', ParseIntPipe) itemId: number,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.claims.attachReceipt(user, itemId, file);
  }

  @Get('items/:itemId/receipt')
  receipt(@CurrentUser() user: AuthUser, @Param('itemId', ParseIntPipe) itemId: number, @Res() res: Response) {
    const file = this.claims.receipt(user, itemId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    res.send(file.buffer);
  }

  @Post(':id/submit')
  submit(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.claims.submit(user, id);
  }

  @Post(':id/decision')
  @Roles('MANAGER', 'HR', 'FINANCE')
  decide(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.claims.decide(user, id, body);
  }

  @Post(':id/pay')
  @Roles('FINANCE')
  pay(@Param('id', ParseIntPipe) id: number) {
    return this.claims.markPaid(id);
  }
}
