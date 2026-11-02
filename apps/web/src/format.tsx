import { Tag } from 'antd';
import dayjs from 'dayjs';
import type { ClaimStatus, LeaveStatus } from './types';

export const fmtDate = (d: string | null | undefined) => (d ? dayjs(d).format('DD MMM YYYY') : '—');

export const fmtRange = (start: string, end: string) => (start === end ? fmtDate(start) : `${fmtDate(start)} – ${fmtDate(end)}`);

export const fmtMoney = (amount: number, currency = 'MYR') =>
  `${currency} ${amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const LEAVE_COLORS: Record<LeaveStatus, string> = {
  PENDING: 'gold',
  APPROVED: 'green',
  REJECTED: 'red',
  CANCELLED: 'default',
};

const CLAIM_LABELS: Record<ClaimStatus, [string, string]> = {
  DRAFT: ['Draft', 'default'],
  PENDING_MANAGER: ['Awaiting manager', 'gold'],
  PENDING_FINANCE: ['Awaiting finance', 'orange'],
  APPROVED: ['Approved', 'blue'],
  REJECTED: ['Rejected', 'red'],
  PAID: ['Paid', 'green'],
};

export const LeaveStatusTag = ({ status }: { status: LeaveStatus }) => (
  <Tag color={LEAVE_COLORS[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Tag>
);

export const ClaimStatusTag = ({ status }: { status: ClaimStatus }) => {
  const [label, color] = CLAIM_LABELS[status];
  return <Tag color={color}>{label}</Tag>;
};

/** Generic status tag for the simpler workflows (overtime, payroll, reviews, training, attendance). */
const STATUS: Record<string, [string, string]> = {
  PENDING: ['Pending', 'gold'],
  APPROVED: ['Approved', 'green'],
  REJECTED: ['Rejected', 'red'],
  DRAFT: ['Draft', 'default'],
  PUBLISHED: ['Published', 'green'],
  IN_PROGRESS: ['Tracking KPIs', 'blue'],
  TRACKING: ['Tracking KPIs', 'blue'],
  REVIEW: ['Review phase', 'gold'],
  CLOSED: ['Closed', 'default'],
  ON_TRACK: ['On track', 'green'],
  AT_RISK: ['At risk', 'orange'],
  OFF_TRACK: ['Off track', 'red'],
  NO_DATA: ['No update', 'default'],
  NOT_STARTED: ['Not started', 'default'],
  SUBMITTED: ['Awaiting Finance', 'gold'],
  SELF_REVIEW: ['Self-review', 'gold'],
  MANAGER_REVIEW: ['Manager review', 'orange'],
  COMPLETED: ['Completed', 'green'],
  PLANNED: ['Planned', 'blue'],
  PRESENT: ['Present', 'green'],
  LATE: ['Late', 'orange'],
  ON_LEAVE: ['On leave', 'blue'],
  OFF: ['Off day', 'default'],
  NOT_IN: ['Not in yet', 'default'],
  ABSENT: ['Absent', 'red'],
};

export const StatusTag = ({ status }: { status: string }) => {
  const [label, color] = STATUS[status] ?? [status, 'default'];
  return <Tag color={color}>{label}</Tag>;
};

/** KPI value with its unit, e.g. "MYR 50,000", "92%", "14 tickets". */
export const fmtKpi = (value: number | null, unit: string) => {
  if (value == null) return '—';
  const n = value.toLocaleString('en-MY', { maximumFractionDigits: 2 });
  if (unit === '%') return `${n}%`;
  if (unit === 'MYR') return `MYR ${n}`;
  return `${n} ${unit}`;
};

export const fmtPeriod =(period: string) => dayjs(`${period}-01`).format('MMMM YYYY');
