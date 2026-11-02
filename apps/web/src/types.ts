// Response shapes from the API.

export type Role = 'EMPLOYEE' | 'MANAGER' | 'HR' | 'FINANCE';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ClaimStatus = 'DRAFT' | 'PENDING_MANAGER' | 'PENDING_FINANCE' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface Employee {
  id: number;
  empNo: string;
  name: string;
  email: string;
  role: Role;
  position: string;
  joinDate: string;
  department: string;
  manager: string | null;
  managerId: number | null;
  departmentId: number;
  phone: string;
  address: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
}

export interface DirectoryEntry {
  id: number;
  empNo: string;
  name: string;
  position: string;
  managerId: number | null;
  email: string;
  phone: string;
  department: string;
}

export interface Department {
  id: number;
  name: string;
}

export interface Announcement {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  author: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: number;
  date: string;
  clockInTime: string;
  clockOutTime: string | null;
  hours: number | null;
  late: boolean;
}

export interface AttendanceMonth {
  rows: AttendanceRecord[];
  summary: { daysPresent: number; lateDays: number; totalHours: number };
}

export interface TeamAttendance {
  employee: Employee;
  status: 'PRESENT' | 'LATE' | 'ON_LEAVE' | 'OFF' | 'NOT_IN' | 'ABSENT';
  record: AttendanceRecord | null;
}

export interface OvertimeRequest {
  id: number;
  date: string;
  hours: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approver: string | null;
  approverComment: string | null;
  employee: Employee;
}

export interface Payslip {
  id: number;
  period: string;
  status: 'DRAFT' | 'PUBLISHED';
  basic: number;
  allowance: number;
  overtimeHours: number;
  overtimePay: number;
  bonus: number;
  unpaidLeaveDays: number;
  unpaidLeaveDeduction: number;
  grossPay: number;
  epfEmployee: number;
  socso: number;
  eis: number;
  claimsReimbursed: number;
  netPay: number;
  epfEmployer: number;
  employee: Employee;
}

export interface PayrollRun {
  period: string;
  status: 'DRAFT' | 'PUBLISHED';
  employees: number;
  grossPay: number;
  netPay: number;
  epfEmployer: number;
}

export type TaskOwner = 'HR' | 'MANAGER' | 'EMPLOYEE' | 'FINANCE';

export interface Checklist {
  id: number;
  type: 'ONBOARDING' | 'OFFBOARDING';
  createdAt: string;
  progress: number;
  employee: Employee;
  tasks: { id: number; title: string; owner: TaskOwner; done: boolean; doneAt: string | null; doneByName: string | null; canComplete: boolean }[];
}

export type PaceStatus = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'NO_DATA';

export interface Kpi {
  id: number;
  title: string;
  weight: number;
  unit: string;
  target: number;
  direction: 'HIGHER' | 'LOWER';
  tracking: 'CUMULATIVE' | 'LEVEL';
  actual: number | null;
  achievement: number; // % of target
  suggestedRating: number;
  pace: PaceStatus;
  selfRating: number | null;
  selfComment: string | null;
  managerRating: number | null;
  managerComment: string | null;
}

export interface PaceCounts {
  onTrack: number;
  atRisk: number;
  offTrack: number;
  noData: number;
}

export interface RewardBand {
  minRating: number;
  label: string;
  bonusMonths: number;
  incrementPct: number;
}

export interface Cycle {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: 'TRACKING' | 'REVIEW' | 'CLOSED';
  elapsed: number; // % of the cycle passed
  reviews: number;
  completed: number;
  rewardBands: RewardBand[];
  rewardStatus: 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED' | 'APPROVED';
  payoutPeriod: string | null;
  effectiveDate: string | null;
  rewardDecidedAt: string | null;
  rewardComment: string | null;
}

export interface KpiCheckIn {
  id: number;
  kpiId: number;
  date: string;
  value: number;
  note: string | null;
  by: string;
}

export interface Review {
  id: number;
  cycle: Pick<Cycle, 'id' | 'name' | 'status' | 'startDate' | 'endDate'>;
  status: 'IN_PROGRESS' | 'SELF_REVIEW' | 'MANAGER_REVIEW' | 'COMPLETED';
  kpis: Kpi[];
  achievement: number;
  suggestedRating: number;
  pace: PaceCounts;
  overallRating: number | null;
  managerSummary: string | null;
  reviewerId: number;
  reviewer: string;
  employee: Employee;
  createdAt: string;
  completedAt: string | null;
  checkIns?: KpiCheckIn[];
}

export interface MonitorRow {
  reviewId: number;
  status: Review['status'];
  overallRating: number | null;
  employee: Employee;
  lastCheckIn: string | null;
  kpis: Kpi[];
  achievement: number;
  suggestedRating: number;
  pace: PaceCounts;
}

export interface Reward {
  id: number;
  cycle: string;
  employee: Employee;
  rating: number;
  band: string;
  basicSalary: number;
  prorate: number;
  bonusMonths: number;
  bonusAmount: number;
  incrementPct: number;
  incrementAmount: number;
  newSalary: number;
  adjusted: boolean;
  note: string | null;
  payoutPeriod: string;
  effectiveDate: string;
}

export interface RewardSummary {
  cycle: Cycle & { decidedBy: string | null };
  rewards: Reward[];
  missing: { employee: Employee; reason: string }[];
  totals: { employees: number; bonus: number; monthlyIncrement: number; annualIncrement: number; avgIncrementPct: number };
  distribution: { label: string; count: number }[];
}

export interface Training {
  id: number;
  employeeId: number;
  employeeName: string;
  title: string;
  provider: string;
  date: string;
  hours: number;
  status: 'PLANNED' | 'COMPLETED';
  certificateExpiry: string | null;
}

export interface LeaveType {
  id: number;
  code: string;
  name: string;
  isPaid: boolean;
  defaultDays: number | null;
}

export interface LeaveBalance {
  leaveTypeId: number;
  year: number;
  entitled: number;
  taken: number;
  pending: number;
  available: number | null;
  leaveType: LeaveType;
}

export interface LeaveRequest {
  id: number;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  days: number;
  reason: string;
  status: LeaveStatus;
  approver: string | null;
  approverComment: string | null;
  createdAt: string;
  leaveType: LeaveType;
  employee: Employee;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
}

export interface ClaimCategory {
  id: number;
  name: string;
  limitPerItem: number | null;
  requiresReceipt: boolean;
}

export interface ClaimItem {
  id: number;
  date: string;
  amount: number;
  description: string;
  receiptName: string | null;
  hasReceipt: boolean;
  category: ClaimCategory;
}

export interface Claim {
  id: number;
  title: string;
  currency: string;
  totalAmount: number;
  status: ClaimStatus;
  submittedAt: string | null;
  managerName: string | null;
  managerAt: string | null;
  financeName: string | null;
  financeAt: string | null;
  paidAt: string | null;
  rejectReason: string | null;
  createdAt: string;
  employee: Employee;
  items: ClaimItem[];
}
