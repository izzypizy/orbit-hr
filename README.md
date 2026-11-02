# Orbit HR

*Everything revolves around your people.*

HR self-service: leave, claims, attendance, payroll, onboarding, performance and training.
The brand (logo, palette, type, voice) is documented in the app at **/brand** and lives in
`apps/web/src/brand/` and `apps/web/src/theme.ts`.
React + Ant Design frontend, NestJS backend, **mock data in memory** (no database yet).

## Run it

Requires Node.js 20+.

```bash
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3000/api

Or press **F5** in VS Code with "Full stack" selected. Data resets every time the API restarts.

### Live demo on GitHub Pages

**https://izzypizy.github.io/orbit-hr/**

Every push to `main` publishes a browser-only build (`npm run build:demo -w @hrms/web`, see
`.github/workflows/pages.yml`). It runs the same API controllers inside the browser (`apps/web/src/demo/`),
so there is no server: each visitor gets their own copy of the mock data, which resets when they refresh.

### In GitHub Codespaces

On GitHub, click **Code → Codespaces → Create codespace on main**. The codespace installs
packages, starts the app and opens Orbit HR in a new tab (port 5173). If the tab doesn't open,
go to the **Ports** panel and click the globe icon next to port 5173.

## Demo accounts

All demo accounts use the password `Password123!`.

| Email | Role | Can do |
|---|---|---|
| employee@demo.local | Employee (Siti) | Leave, claims, clock in/out, overtime, payslips, self-review, training |
| employee2@demo.local | Employee (Kumar) | Same, second team member |
| newhire@demo.local | Employee (Farah) | New hire, part-way through onboarding |
| manager@demo.local | Manager (Daniel) | + approve team leave, claims (step 1) and overtime; team attendance; set team KPIs, monitor progress, review the team |
| hr@demo.local | HR Admin (Aisha) | + add employees, on/offboarding, announcements, holidays, performance cycles, calculate rewards, payroll |
| finance@demo.local | Finance (Priya) | + approve claims (step 2), mark claims paid, approve rewards, payroll |

## Features

**Self-service**
- My Profile: edit phone, address and emergency contact
- Announcements (HR posts, pinned items first) and an org chart

**Leave**
- Balances per leave type; working days exclude weekends and public holidays
- Half-day leave, overlap and balance checks; manager/HR approval; cancel pending or future leave
- "Who's on leave" in your department for the next 14 days

**Claims**
- Draft → add items → attach receipts → submit; per-category limits and receipt rules
- Two-step approval: Manager → Finance → Paid

**Attendance**
- Clock in/out (Malaysia time; after 09:00 counts as late), monthly record and summary
- Team view for managers/HR: present, late, on leave, absent
- Overtime requests with manager approval

**Payroll (simplified)**
- HR/Finance calculate a month, review, then publish
- Basic + allowance + approved overtime (1.5×) − approved unpaid leave, EPF/SOCSO/EIS deductions, paid claims reimbursed
- Employees see published payslips. Rates are simplified for the demo and PCB (tax) is not calculated

**Talent**
- Onboarding/offboarding checklists; each task belongs to HR, the manager, the employee or Finance
- Adding an employee starts their onboarding checklist automatically
- Training records with certificate expiry warnings

**Performance & KPIs**
- Performance cycles run by HR: Tracking KPIs → Review phase → Closed
- Measurable KPIs: target, unit, "at least" or "at most", and whether it adds up over the cycle (sales) or is a level to keep (uptime); weights add up to 100%
- Progress check-ins with history; each KPI shows achievement (% of target, capped at 150%) and pace (on track, at risk, off track) against where it should be by now
- Team monitor for managers and HR: achievement, KPIs at risk, people without KPIs
- Suggested rating from achievement (110%+ = 5, 100% = 4, 85% = 3, 70% = 2), then self-review and manager review give the final rating

**Rewards (bonus and increment)**
- Reward bands per cycle map the final rating to bonus months and increment %
- HR calculates rewards for a closed cycle, adjusts individuals with a reason, and submits; Finance approves or sends back
- Bonuses are pro-rated for people who joined mid-cycle and paid in the chosen payroll month (EPF applies; SOCSO/EIS don't)
- New salaries apply in payroll from the effective date; employees see a reward letter under Performance → My rewards

## Structure

```
apps/
  api/                  NestJS
    src/data/           mock-data.ts (seed), mock-db.service.ts (in-memory store), types.ts
    src/common/         JWT auth guard, @Roles, validation and date helpers
    src/leave/, src/claims/, src/attendance/, src/payroll/
    src/talent/         checklists, reviews (KPIs, check-ins, ratings), training
    src/performance/    cycles and KPI monitoring, KPI scoring rules, rewards
    src/employees/, src/announcements/, src/holidays/
  web/                  React + Vite + Ant Design
    src/pages/          one file per screen
```

## Moving to a real database later

All data access goes through `MockDb` (`apps/api/src/data/mock-db.service.ts`), and the shapes in `types.ts` map 1:1 to tables.
Add Prisma + PostgreSQL (or SQLite), then replace the array operations in the services and controllers with queries.
Receipts are held in memory; move them to disk or S3-compatible storage at the same time.
