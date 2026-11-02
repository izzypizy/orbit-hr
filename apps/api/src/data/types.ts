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
  bonus: number; // performance bonus paid this period
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

export interface RewardBand {
  minRating: number; // final rating from this value up (bands are checked highest first)
  label: string;
  bonusMonths: number; // bonus = basic salary × months
  incrementPct: number; // new basic = basic × (1 + pct/100)
}

export interface PerformanceCycle {
  id: number;
  name: string; // e.g. "2026 Annual"
  startDate: string;
  endDate: string;
  // TRACKING: KPIs set and progress logged; REVIEW: self and manager reviews; CLOSED: final ratings locked
  status: 'TRACKING' | 'REVIEW' | 'CLOSED';
  rewardBands: RewardBand[];
  // Rewards: HR calculates and adjusts (DRAFT), submits, Finance approves (salaries updated, bonus paid in payroll)
  rewardStatus: 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED' | 'APPROVED';
  payoutPeriod: string | null; // YYYY-MM payroll that pays the bonus
  effectiveDate: string | null; // increment effective date
  rewardDecidedBy: number | null;
  rewardDecidedAt: string | null;
  rewardComment: string | null;
}

export type KpiFrequency = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY';

export interface Kpi {
  id: number;
  title: string;
  weight: number; // percent; all KPIs in a review add up to 100
  unit: string; // e.g. 'MYR', '%', 'tickets'
  frequency: KpiFrequency; // how often a figure is entered
  aggregation: 'AVERAGE' | 'TOTAL' | 'LATEST'; // how the period figures combine into the KPI result
  direction: 'HIGHER' | 'LOWER'; // HIGHER: more is better (sales); LOWER: less is better (defects)
  // Where ratings 2, 3, 4 and 5 start. HIGHER: result >= value; LOWER: result <= value. Anything else is 1.
  // Rating 3 ("meets expectations") is the target.
  scale: [number, number, number, number];
  selfRating: number | null; // 1–5
  selfComment: string | null;
  managerRating: number | null;
  managerComment: string | null;
}

/** The figure for one KPI in one period (e.g. June sales). One per period; re-entering corrects it. */
export interface KpiEntry {
  id: number;
  reviewId: number;
  kpiId: number;
  period: string; // YYYY-MM of the period's first month
  value: number;
  note: string | null;
  byId: number;
  updatedAt: string;
}

export interface Review {
  id: number;
  employeeId: number;
  reviewerId: number;
  cycleId: number;
  status: 'IN_PROGRESS' | 'SELF_REVIEW' | 'MANAGER_REVIEW' | 'COMPLETED';
  kpis: Kpi[];
  overallRating: number | null;
  managerSummary: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Reward {
  id: number;
  cycleId: number;
  employeeId: number;
  reviewId: number;
  rating: number;
  band: string;
  basicSalary: number; // monthly basic when calculated
  prorate: number; // share of the cycle the employee was employed, 0–1 (applies to bonus)
  bonusMonths: number;
  bonusAmount: number;
  incrementPct: number;
  incrementAmount: number; // monthly
  newSalary: number;
  adjusted: boolean; // HR changed it from the band
  note: string | null;
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
