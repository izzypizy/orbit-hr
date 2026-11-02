import { Kpi, KpiEntry, KpiFrequency, PerformanceCycle, Review } from '../data/types';

export type PaceStatus = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'NO_DATA';
export type PeriodStatus = 'DONE' | 'MISSING' | 'OPEN' | 'UPCOMING';

const MAX_ACHIEVEMENT = 150; // percent; stops one KPI from carrying the whole review
const DAY_MS = 86_400_000;
const MONTHS: Record<KpiFrequency, number> = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6 };
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface Period {
  key: string; // YYYY-MM of the first month
  label: string; // "Jun 2026", "Jul–Sep 2026"
  start: string;
  end: string;
}

const ym = (y: number, m: number) => `${y + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
const lastDay = (key: string) => new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).toISOString().slice(0, 10);

/** The periods a KPI is updated for within the cycle, e.g. Jan…Jun for a monthly KPI in an H1 cycle. */
export function periodsFor(cycle: PerformanceCycle, frequency: KpiFrequency): Period[] {
  const step = MONTHS[frequency];
  const y = Number(cycle.startDate.slice(0, 4));
  const first = Number(cycle.startDate.slice(5, 7)) - 1;
  const endKey = cycle.endDate.slice(0, 7);
  const periods: Period[] = [];
  for (let m = first; ym(y, m) <= endKey; m += step) {
    const key = ym(y, m);
    const lastKey = ym(y, m + step - 1);
    const end = lastKey > endKey ? cycle.endDate : lastDay(lastKey);
    const name = (k: string) => MONTH_NAMES[Number(k.slice(5, 7)) - 1];
    const label = step === 1 ? `${name(key)} ${key.slice(0, 4)}` : `${name(key)}–${name(lastKey)} ${lastKey.slice(0, 4)}`;
    periods.push({ key, label, start: `${key}-01`, end });
  }
  return periods;
}

/** Rating 1–5 for a result, using the KPI's own scale. */
export function ratingFor(kpi: Pick<Kpi, 'direction' | 'scale'>, value: number) {
  let rating = 1;
  kpi.scale.forEach((t, i) => {
    if (kpi.direction === 'HIGHER' ? value >= t : value <= t) rating = i + 2;
  });
  return rating;
}

const combine = (kpi: Kpi, values: number[]) => {
  if (!values.length) return null;
  if (kpi.aggregation === 'TOTAL') return values.reduce((s, v) => s + v, 0);
  if (kpi.aggregation === 'LATEST') return values[values.length - 1];
  return values.reduce((s, v) => s + v, 0) / values.length;
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * KPI result so far, its rating, and whether it is on track. For totals, "on track" uses a projection to the end of
 * the cycle (e.g. 3 customers in one of two quarters → 6); averages and latest values are rated as they stand.
 */
export function scoreKpi(kpi: Kpi, entries: KpiEntry[], cycle: PerformanceCycle, date: string) {
  const mine = entries.filter((e) => e.kpiId === kpi.id);
  const periods = periodsFor(cycle, kpi.frequency).map((p) => {
    const entry = mine.find((e) => e.period === p.key);
    const status: PeriodStatus = entry ? 'DONE' : p.end < date ? 'MISSING' : p.start <= date ? 'OPEN' : 'UPCOMING';
    return { ...p, status, value: entry?.value ?? null, note: entry?.note ?? null, byId: entry?.byId ?? null, updatedAt: entry?.updatedAt ?? null };
  });
  const values = periods.filter((p) => p.value != null).map((p) => p.value!);
  const raw = combine(kpi, values);
  const value = raw == null ? null : round(raw);
  const target = kpi.scale[1];

  let projected = value;
  if (kpi.aggregation === 'TOTAL' && value != null) {
    // Periods that are over or already have a figure
    const counted = periods.filter((p) => p.status === 'DONE' || p.status === 'MISSING').length;
    projected = round((value * periods.length) / Math.max(1, counted));
  }
  const rating = value == null ? null : ratingFor(kpi, value);
  const projectedRating = projected == null ? null : ratingFor(kpi, projected);
  const pace: PaceStatus = projectedRating == null ? 'NO_DATA' : projectedRating >= 3 ? 'ON_TRACK' : projectedRating === 2 ? 'AT_RISK' : 'OFF_TRACK';

  let achievement = 0;
  if (value != null) {
    const r = kpi.direction === 'HIGHER' ? (target <= 0 ? 1 : value / target) : value <= 0 ? MAX_ACHIEVEMENT / 100 : target / value;
    achievement = Math.round(Math.min(MAX_ACHIEVEMENT / 100, Math.max(0, r)) * 100);
  }

  return {
    ...kpi,
    value,
    target,
    projected,
    rating,
    projectedRating,
    pace,
    achievement,
    periods,
    done: periods.filter((p) => p.status === 'DONE').length,
    missing: periods.filter((p) => p.status === 'MISSING').length,
  };
}

/** Weighted average of KPI ratings, to one decimal. */
export const weightedRating = (items: { weight: number; rating: number }[]) =>
  Math.round(items.reduce((s, k) => s + k.rating * k.weight, 0) / 10) / 10;

/** Share of the cycle that has passed on `date`, 0–1. */
export function elapsed(cycle: PerformanceCycle, date: string) {
  const start = Date.parse(cycle.startDate);
  const end = Date.parse(cycle.endDate) + DAY_MS;
  return Math.min(1, Math.max(0, (Date.parse(date) + DAY_MS - start) / (end - start)));
}

/**
 * KPI and review figures shown on screens. `suggestedRating` is what the KPI results give, using the end-of-cycle
 * projection for totals (once every period is over, that is the actual result). No result counts as 1.
 */
export function scoreReview(review: Review, entries: KpiEntry[], cycle: PerformanceCycle, date: string) {
  const kpis = review.kpis.map((k) => scoreKpi(k, entries, cycle, date));
  const count = (status: PaceStatus) => kpis.filter((k) => k.pace === status).length;
  return {
    kpis,
    achievement: Math.round(kpis.reduce((s, k) => s + k.achievement * k.weight, 0) / 100),
    suggestedRating: weightedRating(kpis.map((k) => ({ weight: k.weight, rating: k.projectedRating ?? 1 }))),
    pace: { onTrack: count('ON_TRACK'), atRisk: count('AT_RISK'), offTrack: count('OFF_TRACK'), noData: count('NO_DATA') },
    updates: { done: kpis.reduce((s, k) => s + k.done, 0), missing: kpis.reduce((s, k) => s + k.missing, 0) },
  };
}
