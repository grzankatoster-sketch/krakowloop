import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LAST_PLAN_KEY, loadLastDay, loadLastPlan, parseLastPlan, saveLastPlan } from '../src/lib/planStore';
import { paramsToPlan, planToParams } from '../src/lib/planParams';
import type { PlanOptions } from '../src/lib/planner';

// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const KNOWN: ReadonlySet<string> = new Set(['wawel', 'rynek']);
const plan: PlanOptions = { days: 2, pace: 'steady', interests: ['history', 'food'], dayTrips: false, exclude: ['wawel'], seed: 12 };

describe('the last plan, kept on the phone', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('comes back as the same plan', async () => {
    await saveLastPlan(planToParams(plan));
    const params = await loadLastPlan(KNOWN);
    expect(params).not.toBeNull();
    expect(paramsToPlan({ ...params! }, KNOWN)).toEqual(paramsToPlan({ ...planToParams(plan) }, KNOWN));
  });

  it('is nothing when nothing was kept', async () => {
    expect(await loadLastPlan(KNOWN)).toBeNull();
  });

  it('trusts only a complete, valid plan', () => {
    for (const raw of [null, '', 'oops', '5', '[]', 'null', '{}', '{"days":"9"}', '{"days":2}', '{"pace":"steady"}']) {
      expect(parseLastPlan(raw, KNOWN)).toBeNull();
    }
  });

  it('keeps only known settings, as short text', () => {
    const raw = JSON.stringify({ ...planToParams(plan), evil: 'x', likes: 'history,' + 'a'.repeat(5000) });
    const params = parseLastPlan(raw, KNOWN);
    expect(params).not.toBeNull();
    expect(Object.keys(params!)).not.toContain('evil');
    expect(params!.likes.length).toBeLessThanOrEqual(2000);
  });

  it('a trip that is over is not put back: dated after its last day, undated after a week', () => {
    const dated = JSON.stringify({ ...planToParams(plan), days: '2', date: '2026-10-19' });
    expect(parseLastPlan(dated, KNOWN, new Date('2026-10-20T10:00:00Z'))).not.toBeNull();
    expect(parseLastPlan(dated, KNOWN, new Date('2026-10-21T10:00:00Z'))).toBeNull();
    const undated = (savedAt: number) => JSON.stringify({ ...planToParams(plan), date: '', savedAt });
    const now = new Date('2026-10-20T10:00:00Z');
    expect(parseLastPlan(undated(now.getTime() - 86400000), KNOWN, now)).not.toBeNull();
    expect(parseLastPlan(undated(now.getTime() - 8 * 86400000), KNOWN, now)).toBeNull();
  });

  it('is dropped by a stored value that is no longer a plan', async () => {
    await AsyncStorage.setItem(LAST_PLAN_KEY, '{"days":"2","seed":"5"}');
    expect(await loadLastPlan(KNOWN)).not.toBeNull();
    await AsyncStorage.setItem(LAST_PLAN_KEY, 'garbage');
    expect(await loadLastPlan(KNOWN)).toBeNull();
  });

  it('keeps the chosen day with the trip: edits keep it, other days/date/start go back to the first day', async () => {
    const params = planToParams(plan);
    expect(await loadLastDay(params)).toBe(0);
    await saveLastPlan(params, 1);
    expect(await loadLastDay(params)).toBe(1);
    // an edit of the same trip (a skipped stop, another shuffle) saves the plan again and keeps the day
    await saveLastPlan(planToParams({ ...plan, exclude: [], seed: 99 }));
    expect(await loadLastDay(params)).toBe(1);
    expect(await loadLastPlan(KNOWN)).not.toBeNull();
    // another length, date or start is another trip
    expect(await loadLastDay({ ...params, days: '3' })).toBe(0);
    expect(await loadLastDay({ ...params, date: '2026-11-02' })).toBe(0);
    await saveLastPlan({ ...params, days: '3' });
    expect(await loadLastDay(params)).toBe(0);
    expect(await loadLastDay({ ...params, days: '3' })).toBe(0);
  });

  it('trusts a stored day only as a small whole number', async () => {
    const params = planToParams(plan);
    for (const day of [-1, 1.5, 'x', null, 500]) {
      await AsyncStorage.setItem(LAST_PLAN_KEY, JSON.stringify({ ...params, day }));
      expect(await loadLastDay(params)).toBe(0);
    }
  });
});
