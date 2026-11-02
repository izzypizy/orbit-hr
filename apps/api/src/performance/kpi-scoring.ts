import { Kpi, PerformanceCycle, Review } from '../data/types';

export type PaceStatus = 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK' | 'NO_DATA';

const MAX_ACHIEVEMENT = 150; // percent; stops one KPI from carrying the whole review
const DAY_MS = 86_400_000;

/** Share of the cycle that has passed on `date`, 0–1. */
export function elapsed(cycle: PerformanceCycle, date: string) {
  const start = Date.parse(cycle.startDate);
  const end = Date.parse(cycle.endDate) + DAY_MS;
  return Math.min(1, Math.max(0, (Date.parse(date) + DAY_MS - start) / (end - start)));
}

/** How the actual compares with `target`, as a ratio (1 = exactly on target). */
function ratio(kpi: Kpi, target: number) {
  const actual = kpi.actual ?? 0;
  if (kpi.direction === 'HIGHER') return target <= 0 ? 1 : actual / target;
  return actual <= 0 ? MAX_ACHIEVEMENT / 100 : target / actual;
}

/** Achievement against the full-cycle target, in percent (0–150). */
export function achievement(kpi: Kpi) {
  if (kpi.actual == null) return 0;
  return Math.round(Math.min(MAX_ACHIEVEMENT / 100, Math.max(0, ratio(kpi, kpi.target))) * 100);
}

/**
 * Whether the KPI is on pace today. Cumulative KPIs are compared with the share of the target due by now
 * (e.g. 50% of annual sales by mid-year); level KPIs are compared with the target itself.
 */
export function pace(kpi: Kpi, cycle: PerformanceCycle, date: string): PaceStatus {
  if (kpi.actual == null) return 'NO_DATA';
  const due = kpi.tracking === 'CUMULATIVE' ? kpi.target * elapsed(cycle, date) : kpi.target;
  if (kpi.tracking === 'CUMULATIVE' && due <= 0) return 'ON_TRACK';
  const r = ratio(kpi, due);
  return r >= 0.95 ? 'ON_TRACK' : r >= 0.8 ? 'AT_RISK' : 'OFF_TRACK';
}

/** 1–5 rating suggested by achievement, used as the manager's starting point. */
export function ratingFor(achievementPct: number) {
  return achievementPct >= 110 ? 5 : achievementPct >= 100 ? 4 : achievementPct >= 85 ? 3 : achievementPct >= 70 ? 2 : 1;
}

/** Weighted average of KPI ratings, to one decimal. */
export const weightedRating = (items: { weight: number; rating: number }[]) =>
  Math.round(items.reduce((s, k) => s + k.rating * k.weight, 0) / 10) / 10;

/** KPI and review figures shown on screens. */
export function scoreReview(review: Review, cycle: PerformanceCycle, date: string) {
  const kpis = review.kpis.map((k) => {
    const pct = achievement(k);
    return { ...k, achievement: pct, suggestedRating: ratingFor(pct), pace: pace(k, cycle, date) };
  });
  const count = (status: PaceStatus) => kpis.filter((k) => k.pace === status).length;
  return {
    kpis,
    achievement: Math.round(kpis.reduce((s, k) => s + k.achievement * k.weight, 0) / 100),
    suggestedRating: weightedRating(kpis.map((k) => ({ weight: k.weight, rating: k.suggestedRating }))),
    pace: { onTrack: count('ON_TRACK'), atRisk: count('AT_RISK'), offTrack: count('OFF_TRACK'), noData: count('NO_DATA') },
  };
}
