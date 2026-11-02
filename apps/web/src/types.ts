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

export interface Kpi {
  id: number;
  title: string;
  weight: number;
  selfRating: number | null;
  selfComment: string | null;
  managerRating: number | null;
  managerComment: string | null;
}

export interface Review {
  id: number;
  cycle: string;
  status: 'SELF_REVIEW' | 'MANAGER_REVIEW' | 'COMPLETED';
  kpis: Kpi[];
  overallRating: number | null;
  managerSummary: string | null;
  reviewerId: number;
  reviewer: string;
  employee: Employee;
  createdAt: string;
  completedAt: string | null;
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
