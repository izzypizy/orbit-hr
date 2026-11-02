// Entity shapes. These map 1:1 to future database tables.
// Dates are 'YYYY-MM-DD' strings; timestamps are ISO strings.

export type Role = 'EMPLOYEE' | 'MANAGER' | 'HR' | 'FINANCE';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ClaimStatus = 'DRAFT' | 'PENDING_MANAGER' | 'PENDING_FINANCE' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface Department {
  id: number;
  name: string;
}

export interface Employee {
  id: number;
  empNo: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  position: string;
  joinDate: string;
  departmentId: number;
  managerId: number | null;
  basicSalary: number; // monthly, MYR; never returned by employeeView
  phone: string;
  address: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
}

export interface LeaveType {
  id: number;
  code: string;
  name: string;
  isPaid: boolean;
  defaultDays: number | null; // null = no limit
}

export interface LeaveBalance {
  employeeId: number;
  leaveTypeId: number;
  year: number;
  entitled: number;
  taken: number;
  pending: number;
}

export interface LeaveRequest {
  id: number;
  employeeId: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  days: number;
  reason: string;
  status: LeaveStatus;
  approverId: number | null;
  approverComment: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface PublicHoliday {
  id: number;
  date: string;
  name: string;
}

export interface ClaimCategory {
  id: number;
  name: string;
  limitPerItem: number | null; // null = no limit
  requiresReceipt: boolean;
}

export interface Claim {
  id: number;
  employeeId: number;
  title: string;
  currency: string;
  totalAmount: number;
  status: ClaimStatus;
  submittedAt: string | null;
  managerId: number | null;
  managerAt: string | null;
  financeId: number | null;
  financeAt: string | null;
  paidAt: string | null;
  rejectReason: string | null;
  createdAt: string;
}

export interface ClaimItem {
  id: number;
  claimId: number;
  categoryId: number;
  date: string;
  amount: number;
  description: string;
  receiptName: string | null;
}

export interface ReceiptFile {
  buffer: Buffer;
  mimeType: string;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  authorId: number;
  createdAt: string;
}

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  date: string; // local (Malaysia) date
  clockIn: string; // ISO timestamp
  clockOut: string | null;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface OvertimeRequest {
  id: number;
  employeeId: number;
  date: string;
  hours: number;
  reason: string;
  status: ApprovalStatus;
  approverId: number | null;
  approverComment: string | null;
  createdAt: string;
}

export interface Payslip {
  id: number;
  employeeId: number;
  period: string; // YYYY-MM
  status: 'DRAFT' | 'PUBLISHED';
  basic: number;
  allowance: number;
  overtimePay: number;
  overtimeHours: number;
  unpaidLeaveDays: number;
  unpaidLeaveDeduction: number;
  grossPay: number;
  epfEmployee: number;
  socso: number;
  eis: number;
  claimsReimbursed: number;
  netPay: number;
  epfEmployer: number;
  generatedAt: string;
}

export type TaskOwner = 'HR' | 'MANAGER' | 'EMPLOYEE' | 'FINANCE';

export interface ChecklistTask {
  id: number;
  title: string;
  owner: TaskOwner;
  done: boolean;
  doneAt: string | null;
  doneBy: number | null;
}

export interface Checklist {
  id: number;
  employeeId: number;
  type: 'ONBOARDING' | 'OFFBOARDING';
  createdAt: string;
  tasks: ChecklistTask[];
}

export interface Kpi {
  id: number;
  title: string;
  weight: number; // percent; all KPIs in a review add up to 100
  selfRating: number | null; // 1–5
  selfComment: string | null;
  managerRating: number | null;
  managerComment: string | null;
}

export interface Review {
  id: number;
  employeeId: number;
  reviewerId: number;
  cycle: string; // e.g. "2026 Annual"
  status: 'SELF_REVIEW' | 'MANAGER_REVIEW' | 'COMPLETED';
  kpis: Kpi[];
  overallRating: number | null;
  managerSummary: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Training {
  id: number;
  employeeId: number;
  title: string;
  provider: string;
  date: string;
  hours: number;
  status: 'PLANNED' | 'COMPLETED';
  certificateExpiry: string | null;
}
