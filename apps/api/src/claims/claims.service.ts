import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { AuthUser } from '../common/auth';
import { isoDate, nextId, now, parse } from '../common/util';
import { MockDb } from '../data/mock-db.service';
import { Claim } from '../data/types';

const createSchema = z.object({ title: z.string().trim().min(3) });

const itemSchema = z.object({
  categoryId: z.number().int(),
  date: isoDate,
  amount: z.number().positive().max(100000),
  description: z.string().trim().min(3),
});

const decisionSchema = z.object({ approve: z.boolean(), comment: z.string().trim().optional() });

export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

@Injectable()
export class ClaimsService {
  constructor(private readonly db: MockDb) {}

  categories() {
    return this.db.claimCategories;
  }

  myClaims(employeeId: number) {
    return this.db.claims
      .filter((c) => c.employeeId === employeeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => this.view(c));
  }

  get(user: AuthUser, id: number) {
    const claim = this.find(id);
    if (!this.canView(user, claim)) throw new ForbiddenException();
    return this.view(claim);
  }

  create(user: AuthUser, body: unknown) {
    const { title } = parse(createSchema, body);
    const claim: Claim = {
      id: nextId(this.db.claims), employeeId: user.id, title, currency: 'MYR', totalAmount: 0, status: 'DRAFT',
      submittedAt: null, managerId: null, managerAt: null, financeId: null, financeAt: null, paidAt: null,
      rejectReason: null, createdAt: now(),
    };
    this.db.claims.push(claim);
    return this.view(claim);
  }

  remove(user: AuthUser, id: number) {
    const claim = this.ownDraft(user, id);
    this.db.claims.splice(this.db.claims.indexOf(claim), 1);
    for (const item of this.db.claimItems.filter((i) => i.claimId === id)) this.deleteItem(item.id);
    return { ok: true };
  }

  addItem(user: AuthUser, claimId: number, body: unknown) {
    const claim = this.ownDraft(user, claimId);
    const input = parse(itemSchema, body);
    const category = this.db.claimCategories.find((c) => c.id === input.categoryId);
    if (!category) throw new BadRequestException('Unknown claim category');
    if (category.limitPerItem != null && input.amount > category.limitPerItem) {
      throw new BadRequestException(`${category.name} is limited to MYR ${category.limitPerItem.toFixed(2)} per item`);
    }
    this.db.claimItems.push({ id: nextId(this.db.claimItems), claimId, ...input, receiptName: null });
    this.recalculate(claim);
    return this.view(claim);
  }

  removeItem(user: AuthUser, itemId: number) {
    const item = this.findItem(itemId);
    const claim = this.ownDraft(user, item.claimId);
    this.deleteItem(itemId);
    this.recalculate(claim);
    return this.view(claim);
  }

  attachReceipt(user: AuthUser, itemId: number, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!RECEIPT_TYPES.includes(file.mimetype)) throw new BadRequestException('Receipt must be a JPG, PNG, WEBP or PDF');
    const item = this.findItem(itemId);
    const claim = this.ownDraft(user, item.claimId);
    this.db.receipts.set(itemId, { buffer: file.buffer, mimeType: file.mimetype });
    item.receiptName = file.originalname;
    return this.view(claim);
  }

  receipt(user: AuthUser, itemId: number) {
    const item = this.findItem(itemId);
    if (!this.canView(user, this.find(item.claimId))) throw new ForbiddenException();
    const file = this.db.receipts.get(itemId);
    if (!file) throw new NotFoundException('No receipt attached');
    return { ...file, name: item.receiptName ?? 'receipt' };
  }

  submit(user: AuthUser, id: number) {
    const claim = this.ownDraft(user, id);
    const items = this.db.claimItems.filter((i) => i.claimId === id);
    if (items.length === 0) throw new BadRequestException('Add at least one item before submitting');
    const missing = items.filter((i) => this.category(i.categoryId).requiresReceipt && !this.db.receipts.has(i.id));
    if (missing.length) throw new BadRequestException(`Receipt required for: ${missing.map((i) => i.description).join(', ')}`);

    // Employees without a manager (e.g. department heads) go straight to Finance
    claim.status = this.db.employee(user.id).managerId ? 'PENDING_MANAGER' : 'PENDING_FINANCE';
    claim.submittedAt = now();
    return this.view(claim);
  }

  /** Claims waiting for this user: managers/HR approve step 1, Finance approves step 2. */
  approvals(user: AuthUser) {
    return this.db.claims
      .filter((c) => c.employeeId !== user.id && this.isApprover(user, c))
      .sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''))
      .map((c) => this.view(c));
  }

  payable() {
    return this.db.claims.filter((c) => c.status === 'APPROVED').map((c) => this.view(c));
  }

  decide(user: AuthUser, id: number, body: unknown) {
    const { approve, comment } = parse(decisionSchema, body);
    const claim = this.find(id);
    if (claim.employeeId === user.id || !this.isApprover(user, claim)) throw new ForbiddenException('You cannot decide on this claim');
    if (!approve && !comment) throw new BadRequestException('Please give a reason for rejecting');

    if (claim.status === 'PENDING_MANAGER') {
      claim.managerId = user.id;
      claim.managerAt = now();
      claim.status = approve ? 'PENDING_FINANCE' : 'REJECTED';
    } else {
      claim.financeId = user.id;
      claim.financeAt = now();
      claim.status = approve ? 'APPROVED' : 'REJECTED';
    }
    if (!approve) claim.rejectReason = comment!;
    return this.view(claim);
  }

  markPaid(id: number) {
    const claim = this.find(id);
    if (claim.status !== 'APPROVED') throw new BadRequestException('Only approved claims can be marked as paid');
    claim.status = 'PAID';
    claim.paidAt = now();
    return this.view(claim);
  }

  private isApprover(user: AuthUser, c: Claim) {
    if (c.status === 'PENDING_MANAGER') return user.role === 'HR' || this.db.employee(c.employeeId).managerId === user.id;
    if (c.status === 'PENDING_FINANCE') return user.role === 'FINANCE';
    return false;
  }

  private canView(user: AuthUser, c: Claim) {
    return c.employeeId === user.id || user.role === 'HR' || user.role === 'FINANCE'
      || this.db.employee(c.employeeId).managerId === user.id;
  }

  private ownDraft(user: AuthUser, id: number) {
    const claim = this.find(id);
    if (claim.employeeId !== user.id) throw new ForbiddenException();
    if (claim.status !== 'DRAFT') throw new BadRequestException('Only draft claims can be changed');
    return claim;
  }

  private find(id: number) {
    const claim = this.db.claims.find((c) => c.id === id);
    if (!claim) throw new NotFoundException('Claim not found');
    return claim;
  }

  private findItem(id: number) {
    const item = this.db.claimItems.find((i) => i.id === id);
    if (!item) throw new NotFoundException('Claim item not found');
    return item;
  }

  private deleteItem(id: number) {
    this.db.claimItems.splice(this.db.claimItems.findIndex((i) => i.id === id), 1);
    this.db.receipts.delete(id);
  }

  private category(id: number) {
    return this.db.claimCategories.find((c) => c.id === id)!;
  }

  private recalculate(claim: Claim) {
    const total = this.db.claimItems.filter((i) => i.claimId === claim.id).reduce((s, i) => s + i.amount, 0);
    claim.totalAmount = Math.round(total * 100) / 100;
  }

  private view(c: Claim) {
    return {
      ...c,
      employee: this.db.employeeView(c.employeeId),
      managerName: c.managerId ? this.db.employee(c.managerId).name : null,
      financeName: c.financeId ? this.db.employee(c.financeId).name : null,
      items: this.db.claimItems
        .filter((i) => i.claimId === c.id)
        .map((i) => ({ ...i, category: this.category(i.categoryId), hasReceipt: this.db.receipts.has(i.id) })),
    };
  }
}
