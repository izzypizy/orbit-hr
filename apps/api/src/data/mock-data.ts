import * as bcrypt from 'bcryptjs';
import { countWorkingDays, eachDate, fromLocal } from '../common/util';
import { periodsFor, scoreKpi, weightedRating } from '../performance/kpi-scoring';
import {
  Announcement, AttendanceRecord, Checklist, Claim, ClaimCategory, ClaimItem, Department, Employee, Kpi, KpiEntry, KpiFrequency,
  LeaveBalance, LeaveRequest, LeaveType, OvertimeRequest, PerformanceCycle, PublicHoliday, Review, Reward, RewardBand,
  TaskOwner, Training,
} from './types';

// Every demo account uses this password.
export const DEMO_PASSWORD = 'Password123!';

/** Bonus and increment by final rating. HR can change these per cycle before calculating rewards. */
export const DEFAULT_REWARD_BANDS: RewardBand[] = [
  { minRating: 4.5, label: 'Outstanding', bonusMonths: 3, incrementPct: 8 },
  { minRating: 3.5, label: 'Exceeds expectations', bonusMonths: 2, incrementPct: 6 },
  { minRating: 2.5, label: 'Meets expectations', bonusMonths: 1, incrementPct: 4 },
  { minRating: 1.5, label: 'Needs improvement', bonusMonths: 0, incrementPct: 1.5 },
  { minRating: 0, label: 'Unsatisfactory', bonusMonths: 0, incrementPct: 0 },
];

const YEAR = 2026;

/** Tasks created for each new onboarding/offboarding checklist: [title, who completes it]. */
export const CHECKLIST_TEMPLATES: Record<Checklist['type'], [string, TaskOwner][]> = {
  ONBOARDING: [
    ['Send offer letter and employment contract', 'HR'],
    ['Register with EPF, SOCSO and EIS', 'HR'],
    ['Prepare laptop, email and access card', 'HR'],
    ['Assign an onboarding buddy', 'MANAGER'],
    ['Submit bank account and tax details', 'EMPLOYEE'],
    ['Read the employee handbook', 'EMPLOYEE'],
    ['Agree 90-day goals', 'MANAGER'],
    ['First-month check-in', 'MANAGER'],
  ],
  OFFBOARDING: [
    ['Hand over ongoing work', 'EMPLOYEE'],
    ['Sign off knowledge transfer', 'MANAGER'],
    ['Conduct exit interview', 'HR'],
    ['Collect laptop and access card', 'HR'],
    ['Settle final pay and outstanding claims', 'FINANCE'],
    ['Issue release letter', 'HR'],
  ],
};

export function createMockData() {
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 8);

  const departments: Department[] = [
    { id: 1, name: 'Human Resources' },
    { id: 2, name: 'Finance' },
    { id: 3, name: 'Engineering' },
    { id: 4, name: 'Sales' },
  ];

  const emp = (
    id: number, empNo: string, name: string, email: string, role: Employee['role'], position: string, joinDate: string,
    departmentId: number, managerId: number | null, basicSalary: number, phone: string,
  ): Employee => ({
    id, empNo, name, email, role, position, joinDate, departmentId, managerId, basicSalary, phone, passwordHash,
    address: 'Bayan Lepas, Penang',
    emergencyContactName: '',
    emergencyContactRelation: '',
    emergencyContactPhone: '',
  });

  const employees: Employee[] = [
    emp(1, 'HR001', 'Aisha Rahman', 'hr@demo.local', 'HR', 'HR Manager', '2019-03-01', 1, null, 9500, '012-000 0101'),
    emp(2, 'MGR001', 'Daniel Lim', 'manager@demo.local', 'MANAGER', 'Engineering Manager', '2020-06-15', 3, 1, 12000, '012-000 0102'),
    emp(3, 'FIN001', 'Priya Nair', 'finance@demo.local', 'FINANCE', 'Finance Executive', '2021-01-04', 2, 1, 6500, '012-000 0103'),
    emp(4, 'EMP001', 'Siti Aminah', 'employee@demo.local', 'EMPLOYEE', 'Software Engineer', '2022-08-01', 3, 2, 6000, '012-000 0104'),
    emp(5, 'EMP002', 'Kumar Raj', 'employee2@demo.local', 'EMPLOYEE', 'QA Engineer', '2023-02-20', 3, 2, 4800, '012-000 0105'),
    emp(6, 'EMP003', 'Farah Hassan', 'newhire@demo.local', 'EMPLOYEE', 'Junior Software Engineer', `${YEAR}-10-19`, 3, 2, 4200, '012-000 0106'),
    emp(7, 'EMP004', 'Hafiz Ismail', 'sales@demo.local', 'EMPLOYEE', 'Sales Executive', '2024-04-01', 4, 2, 4500, '012-000 0107'),
  ];
  Object.assign(employees[3], { emergencyContactName: 'Ahmad Zaki', emergencyContactRelation: 'Spouse', emergencyContactPhone: '013-000 0201' });

  const leaveTypes: LeaveType[] = [
    { id: 1, code: 'AL', name: 'Annual Leave', isPaid: true, defaultDays: 14 },
    { id: 2, code: 'SL', name: 'Sick Leave', isPaid: true, defaultDays: 14 },
    { id: 3, code: 'EL', name: 'Emergency Leave', isPaid: true, defaultDays: 3 },
    { id: 4, code: 'UL', name: 'Unpaid Leave', isPaid: false, defaultDays: null },
  ];

  // Fixed-date holidays only; HR adds moving ones (CNY, Hari Raya, Deepavali...) from the Holidays screen.
  const holidays: PublicHoliday[] = [YEAR, YEAR + 1].flatMap((y, i) =>
    [
      [`${y}-01-01`, "New Year's Day"],
      [`${y}-05-01`, 'Labour Day'],
      [`${y}-08-31`, 'National Day'],
      [`${y}-09-16`, 'Malaysia Day'],
      [`${y}-12-25`, 'Christmas Day'],
    ].map(([date, name], j) => ({ id: i * 5 + j + 1, date, name })),
  );
  const holidaySet = new Set(holidays.map((h) => h.date));

  const leave = (
    id: number, employeeId: number, leaveTypeId: number, startDate: string, endDate: string,
    reason: string, status: LeaveRequest['status'], approverId: number | null = null,
  ): LeaveRequest => ({
    id, employeeId, leaveTypeId, startDate, endDate, reason, status, approverId,
    halfDay: false,
    days: countWorkingDays(startDate, endDate, holidaySet),
    approverComment: null,
    decidedAt: status === 'PENDING' ? null : `${startDate}T01:00:00.000Z`,
    createdAt: `${YEAR}-08-01T01:00:00.000Z`,
  });

  const leaveRequests: LeaveRequest[] = [
    leave(1, 4, 1, `${YEAR}-09-14`, `${YEAR}-09-16`, 'Family trip to Langkawi', 'APPROVED', 2),
    leave(2, 4, 1, `${YEAR}-11-23`, `${YEAR}-11-25`, 'Personal matters', 'PENDING'),
    leave(3, 5, 2, `${YEAR}-10-12`, `${YEAR}-10-12`, 'Fever', 'APPROVED', 2),
    leave(4, 5, 1, `${YEAR}-12-21`, `${YEAR}-12-24`, 'Year-end holiday', 'PENDING'),
    leave(5, 2, 1, `${YEAR}-11-02`, `${YEAR}-11-06`, 'Vacation', 'PENDING'),
    leave(6, 3, 3, `${YEAR}-10-30`, `${YEAR}-10-30`, 'Car breakdown', 'APPROVED', 1),
  ];

  // Balances derived from the requests above so the numbers stay consistent
  const leaveBalances: LeaveBalance[] = employees.flatMap((e) =>
    leaveTypes.map((t) => {
      const mine = leaveRequests.filter((r) => r.employeeId === e.id && r.leaveTypeId === t.id);
      const sum = (status: string) => mine.filter((r) => r.status === status).reduce((s, r) => s + r.days, 0);
      return { employeeId: e.id, leaveTypeId: t.id, year: YEAR, entitled: t.defaultDays ?? 0, taken: sum('APPROVED'), pending: sum('PENDING') };
    }),
  );

  const claimCategories: ClaimCategory[] = [
    { id: 1, name: 'Travel', limitPerItem: null, requiresReceipt: true },
    { id: 2, name: 'Accommodation', limitPerItem: 400, requiresReceipt: true },
    { id: 3, name: 'Meals', limitPerItem: 100, requiresReceipt: false },
    { id: 4, name: 'Mileage', limitPerItem: null, requiresReceipt: false },
    { id: 5, name: 'Parking & Toll', limitPerItem: 50, requiresReceipt: false },
    { id: 6, name: 'Medical', limitPerItem: 500, requiresReceipt: true },
  ];

  const claim = (id: number, employeeId: number, title: string, status: Claim['status'], extra: Partial<Claim> = {}): Claim => ({
    id, employeeId, title, status, currency: 'MYR', totalAmount: 0,
    submittedAt: `${YEAR}-10-21T02:00:00.000Z`,
    managerId: null, managerAt: null, financeId: null, financeAt: null, paidAt: null, rejectReason: null,
    createdAt: `${YEAR}-10-21T01:00:00.000Z`,
    ...extra,
  });

  const claims: Claim[] = [
    claim(1, 4, 'KL client visit – October', 'PENDING_MANAGER'),
    claim(2, 5, 'Team lunch', 'PENDING_FINANCE', { managerId: 2, managerAt: `${YEAR}-10-22T03:00:00.000Z` }),
    claim(3, 2, 'Tech conference travel', 'APPROVED', { managerId: 1, managerAt: `${YEAR}-10-10T03:00:00.000Z`, financeId: 3, financeAt: `${YEAR}-10-12T03:00:00.000Z` }),
    claim(4, 4, 'September parking', 'PAID', { managerId: 2, managerAt: `${YEAR}-10-02T03:00:00.000Z`, financeId: 3, financeAt: `${YEAR}-10-03T03:00:00.000Z`, paidAt: `${YEAR}-10-05T03:00:00.000Z` }),
  ];

  const claimItems: ClaimItem[] = [
    { id: 1, claimId: 1, categoryId: 4, date: `${YEAR}-10-20`, amount: 120.5, description: 'Penang–KL return, 280 km', receiptName: null },
    { id: 2, claimId: 1, categoryId: 3, date: `${YEAR}-10-20`, amount: 45, description: 'Lunch with client', receiptName: null },
    { id: 3, claimId: 1, categoryId: 5, date: `${YEAR}-10-20`, amount: 18, description: 'Parking at KLCC', receiptName: null },
    { id: 4, claimId: 2, categoryId: 3, date: `${YEAR}-10-15`, amount: 88, description: 'Sprint celebration lunch', receiptName: null },
    { id: 5, claimId: 3, categoryId: 4, date: `${YEAR}-10-08`, amount: 210, description: 'Drive to Cyberjaya, 480 km', receiptName: null },
    { id: 6, claimId: 3, categoryId: 3, date: `${YEAR}-10-08`, amount: 60, description: 'Dinner during conference', receiptName: null },
    { id: 7, claimId: 4, categoryId: 5, date: `${YEAR}-09-30`, amount: 35, description: 'Office parking, September', receiptName: null },
  ];
  for (const c of claims) {
    c.totalAmount = claimItems.filter((i) => i.claimId === c.id).reduce((s, i) => s + i.amount, 0);
  }

  const announcements: Announcement[] = [
    { id: 1, title: 'Year-end company dinner', body: 'Join us for the annual dinner on 12 December at 7pm. RSVP to HR by 20 November.', pinned: true, authorId: 1, createdAt: `${YEAR}-10-20T02:00:00.000Z` },
    { id: 2, title: 'Updated claims policy', body: 'Meal claims are now capped at MYR 100 per item. Travel and medical claims still need a receipt.', pinned: false, authorId: 1, createdAt: `${YEAR}-10-06T02:00:00.000Z` },
    { id: 3, title: '2027 medical insurance enrolment', body: 'Open enrolment for 2027 medical coverage closes on 15 November. Contact HR to add or update dependants.', pinned: false, authorId: 1, createdAt: `${YEAR}-10-01T02:00:00.000Z` },
  ];

  // October attendance up to the 29th, with clock-ins spread around 09:00 so some days are late
  const attendance: AttendanceRecord[] = [];
  const onLeave = (employeeId: number, date: string) =>
    leaveRequests.some((r) => r.employeeId === employeeId && r.status === 'APPROVED' && r.startDate <= date && r.endDate >= date);
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  for (const e of employees) {
    for (const date of eachDate(`${YEAR}-10-01`, `${YEAR}-10-29`)) {
      if (date < e.joinDate || countWorkingDays(date, date, holidaySet) === 0 || onLeave(e.id, date)) continue;
      const seed = e.id * 7 + Number(date.slice(8)) * 3;
      const clockIn = fromLocal(date, hhmm(8 * 60 + 40 + (seed % 25)));
      const clockOut = fromLocal(date, hhmm(18 * 60 + ((seed * 5) % 50)));
      attendance.push({ id: attendance.length + 1, employeeId: e.id, date, clockIn, clockOut });
    }
  }

  const overtimeRequests: OvertimeRequest[] = [
    { id: 1, employeeId: 4, date: `${YEAR}-10-14`, hours: 2, reason: 'Production release support', status: 'APPROVED', approverId: 2, approverComment: null, createdAt: `${YEAR}-10-15T01:00:00.000Z` },
    { id: 2, employeeId: 5, date: `${YEAR}-10-20`, hours: 3, reason: 'Regression testing before release', status: 'PENDING', approverId: null, approverComment: null, createdAt: `${YEAR}-10-21T01:00:00.000Z` },
  ];

  // New hire Farah is part-way through onboarding
  const checklists: Checklist[] = [{
    id: 1, employeeId: 6, type: 'ONBOARDING', createdAt: `${YEAR}-10-12T01:00:00.000Z`,
    tasks: CHECKLIST_TEMPLATES.ONBOARDING.map(([title, owner], i) => {
      const done = i < 4;
      return { id: i + 1, title, owner, done, doneAt: done ? `${YEAR}-10-1${3 + i}T03:00:00.000Z` : null, doneBy: done ? (owner === 'MANAGER' ? 2 : 1) : null };
    }),
  }];

  // Evaluated twice a year: H1 (Jan–Jun) is closed with final ratings, ready for HR to calculate rewards;
  // H2 (Jul–Dec) is in progress with monthly/quarterly figures entered up to October.
  const cycle = (id: number, half: 1 | 2, status: PerformanceCycle['status']): PerformanceCycle => ({
    id, name: `${YEAR} H${half}`, startDate: half === 1 ? `${YEAR}-01-01` : `${YEAR}-07-01`, endDate: half === 1 ? `${YEAR}-06-30` : `${YEAR}-12-31`, status,
    rewardBands: DEFAULT_REWARD_BANDS.map((b) => ({ ...b })),
    rewardStatus: 'NOT_STARTED', payoutPeriod: null, effectiveDate: null, rewardDecidedBy: null, rewardDecidedAt: null, rewardComment: null,
  });
  const cycles: PerformanceCycle[] = [cycle(1, 1, 'CLOSED'), cycle(2, 2, 'TRACKING')];

  // [title, unit, frequency, aggregation, direction, scale (where ratings 2–5 start), weight, figures per period in order]
  type KpiRow = [string, string, KpiFrequency, Kpi['aggregation'], Kpi['direction'], Kpi['scale'], number, number[]];
  const SALES_SCALE: Kpi['scale'] = [20000, 50000, 55001, 60001];
  const plans: [reviewId: number, employeeId: number, reviewerId: number, cycleId: number, rows: KpiRow[], summary?: string][] = [
    // 2026 H1, completed
    [1, 7, 2, 1, [
      ['Average monthly sales', 'MYR', 'MONTHLY', 'AVERAGE', 'HIGHER', SALES_SCALE, 70, [51000, 53000, 55000, 52000, 56000, 57000]],
      ['New customers signed', 'customers', 'QUARTERLY', 'TOTAL', 'HIGHER', [2, 4, 6, 8], 30, [3, 4]],
    ], 'Hit the sales target every quarter and brought in seven new accounts.'],
    [2, 4, 2, 1, [
      ['Story points delivered', 'pts', 'MONTHLY', 'TOTAL', 'HIGHER', [80, 120, 135, 150], 60, [23, 22, 24, 23, 22, 22]],
      ['Code review turnaround', 'hours', 'MONTHLY', 'AVERAGE', 'LOWER', [36, 24, 18, 12], 40, [20, 18, 17, 19, 16, 18]],
    ], 'Consistent delivery and fast, careful reviews.'],
    [3, 5, 2, 1, [
      ['Automated test coverage', '%', 'MONTHLY', 'LATEST', 'HIGHER', [60, 75, 80, 85], 60, [62, 64, 66, 67, 68, 70]],
      ['Automation scripts delivered', 'scripts', 'MONTHLY', 'TOTAL', 'HIGHER', [30, 50, 60, 70], 40, [9, 8, 10, 9, 8, 9]],
    ], 'Coverage is still below the 75% target; agreed a plan with weekly checkpoints.'],
    [4, 2, 1, 1, [
      ['Roadmap items delivered', 'items', 'QUARTERLY', 'TOTAL', 'HIGHER', [3, 6, 7, 8], 60, [4, 4]],
      ['Team attrition', 'people', 'QUARTERLY', 'TOTAL', 'LOWER', [3, 2, 1, 0], 40, [0, 1]],
    ], 'Shipped ahead of plan and kept the team together.'],
    [5, 3, 1, 1, [
      ['Month-end close', 'days', 'MONTHLY', 'AVERAGE', 'LOWER', [8, 6, 5, 4], 50, [7, 6, 7, 6, 6, 7]],
      ['Claims processed within SLA', '%', 'MONTHLY', 'AVERAGE', 'HIGHER', [85, 95, 97, 99], 50, [95, 96, 94, 97, 96, 95]],
    ], 'Month-end close is slower than target; automating reconciliations next half.'],
    // 2026 H2, in progress (Jul–Oct entered; Kumar has not entered October coverage yet)
    [6, 7, 2, 2, [
      ['Average monthly sales', 'MYR', 'MONTHLY', 'AVERAGE', 'HIGHER', SALES_SCALE, 70, [48000, 52500, 57000, 54800]],
      ['New customers signed', 'customers', 'QUARTERLY', 'TOTAL', 'HIGHER', [2, 4, 6, 8], 30, [3]],
    ]],
    [7, 4, 2, 2, [
      ['Story points delivered', 'pts', 'MONTHLY', 'TOTAL', 'HIGHER', [80, 120, 135, 150], 40, [22, 19, 24, 21]],
      ['Code review turnaround', 'hours', 'MONTHLY', 'AVERAGE', 'LOWER', [36, 24, 18, 12], 30, [26, 22, 20, 19]],
      ['Junior engineers mentored', 'people', 'QUARTERLY', 'LATEST', 'HIGHER', [1, 2, 3, 4], 30, [0]],
    ]],
    [8, 5, 2, 2, [
      ['Automated test coverage', '%', 'MONTHLY', 'LATEST', 'HIGHER', [60, 75, 80, 85], 50, [70, 72, 73]],
      ['Defects escaped to production', 'defects', 'QUARTERLY', 'TOTAL', 'LOWER', [6, 4, 2, 1], 30, [2]],
      ['Automation scripts delivered', 'scripts', 'MONTHLY', 'TOTAL', 'HIGHER', [30, 50, 60, 70], 20, [8, 9, 7, 10]],
    ]],
    [9, 2, 1, 2, [
      ['Roadmap items delivered', 'items', 'QUARTERLY', 'TOTAL', 'HIGHER', [3, 6, 7, 8], 50, [3]],
      ['Team engagement score', '%', 'HALF_YEARLY', 'LATEST', 'HIGHER', [60, 75, 80, 85], 30, []],
      ['Team attrition', 'people', 'QUARTERLY', 'TOTAL', 'LOWER', [3, 2, 1, 0], 20, [0]],
    ]],
    [10, 3, 1, 2, [
      ['Month-end close', 'days', 'MONTHLY', 'AVERAGE', 'LOWER', [8, 6, 5, 4], 40, [6, 6, 5, 7]],
      ['Claims processed within SLA', '%', 'MONTHLY', 'AVERAGE', 'HIGHER', [85, 95, 97, 99], 35, [93, 96, 97, 95]],
      ['Audit findings', 'findings', 'HALF_YEARLY', 'TOTAL', 'LOWER', [4, 2, 1, 0], 25, []],
    ]],
  ];

  let kpiId = 0;
  const reviews: Review[] = [];
  const kpiEntries: KpiEntry[] = [];
  for (const [id, employeeId, reviewerId, cycleId, rows, summary] of plans) {
    const c = cycles.find((x) => x.id === cycleId)!;
    const done = c.status === 'CLOSED';
    const kpis: Kpi[] = rows.map(([title, unit, frequency, aggregation, direction, scale, weight]) => ({
      id: ++kpiId, title, unit, frequency, aggregation, direction, scale, weight,
      selfRating: null, selfComment: null, managerRating: null, managerComment: null,
    }));
    kpis.forEach((k, i) => periodsFor(c, k.frequency).slice(0, rows[i][7].length).forEach((p, j) => kpiEntries.push({
      id: kpiEntries.length + 1, reviewId: id, kpiId: k.id, period: p.key, value: rows[i][7][j], byId: employeeId,
      note: null, updatedAt: `${p.end}T10:00:00.000Z`,
    })));
    const review: Review = {
      id, employeeId, reviewerId, cycleId, kpis,
      status: done ? 'COMPLETED' : 'IN_PROGRESS',
      overallRating: null,
      managerSummary: summary ?? null,
      createdAt: `${c.startDate}T01:00:00.000Z`,
      completedAt: done ? `${YEAR}-07-10T01:00:00.000Z` : null,
    };
    if (done) {
      // Completed reviews: self and manager ratings agree with the scale
      for (const k of kpis) {
        const rating = scoreKpi(k, kpiEntries, c, c.endDate).rating ?? 1;
        Object.assign(k, { selfRating: rating, managerRating: rating, selfComment: 'Figures as entered', managerComment: 'Agreed' });
      }
      review.overallRating = weightedRating(kpis.map((k) => ({ weight: k.weight, rating: k.managerRating! })));
    }
    reviews.push(review);
  }

  const trainings: Training[] = [
    { id: 1, employeeId: 4, title: 'AWS Certified Cloud Practitioner', provider: 'Amazon Web Services', date: `${YEAR}-06-10`, hours: 16, status: 'COMPLETED', certificateExpiry: `${YEAR + 3}-06-10` },
    { id: 2, employeeId: 5, title: 'ISTQB Foundation Level', provider: 'External', date: `${YEAR}-11-18`, hours: 24, status: 'PLANNED', certificateExpiry: null },
    { id: 3, employeeId: 2, title: 'Leadership Essentials', provider: 'Internal L&D', date: `${YEAR}-03-05`, hours: 12, status: 'COMPLETED', certificateExpiry: null },
    { id: 4, employeeId: 3, title: 'Financial Reporting Standards Update', provider: 'External', date: `${YEAR}-12-02`, hours: 8, status: 'PLANNED', certificateExpiry: null },
    { id: 5, employeeId: 1, title: 'Employment Law Refresher', provider: 'External', date: `${YEAR}-02-20`, hours: 7, status: 'COMPLETED', certificateExpiry: null },
    { id: 6, employeeId: 6, title: 'New Hire Orientation', provider: 'Internal HR', date: `${YEAR}-10-20`, hours: 4, status: 'COMPLETED', certificateExpiry: null },
  ];

  return {
    departments, employees, leaveTypes, leaveBalances, leaveRequests, holidays, claimCategories, claims, claimItems,
    announcements, attendance, overtimeRequests, checklists, cycles, reviews, kpiEntries, rewards: [] as Reward[], trainings,
  };
}
