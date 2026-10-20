import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MAX_VISITED_PLANS, VISITED_KEY, loadVisited, parseVisitedStore, planCore, saveVisited, withVisited } from '../src/lib/visited';
import type { PlanOptions } from '../src/lib/planner';

// the native storage isn't there under Jest; its own mock stands in
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const base: PlanOptions = { days: 3, pace: 'steady', interests: ['history'], dayTrips: true, startDate: '2026-10-12' };

describe('the part of a plan that ticks belong to', () => {
  it('does not change when a stop is skipped, a meal or activity is added, or the plan is reshuffled', () => {
    const edited: PlanOptions = {
      ...base,
      exclude: ['wawel'],
      meals: ['lunch'],
      activities: [{ day: 2, id: 'rafting' }],
      seed: 77,
      pace: 'easy',
      interests: ['food'],
    };
    expect(planCore(edited)).toBe(planCore(base));
  });

  it('changes with the number of days, the start date and the starting point', () => {
    expect(planCore({ ...base, days: 2 })).not.toBe(planCore(base));
    expect(planCore({ ...base, startDate: '2026-10-13' })).not.toBe(planCore(base));
    expect(planCore({ ...base, startDate: undefined })).not.toBe(planCore(base));
    expect(planCore({ ...base, start: { lat: 50.06, lon: 19.94 } })).not.toBe(planCore(base));
  });
});

describe('reading what was stored', () => {
  it('survives anything that is not a map of lists of names', () => {
    for (const raw of [null, '', 'not json', '5', '"x"', 'null', '[1,2]', '{"a":5}', '{"a":{"ids":"wawel"}}', '{"a":{"ids":[1,{}],"at":"x"}}']) {
      const store = parseVisitedStore(raw);
      expect(typeof store).toBe('object');
      for (const entry of Object.values(store)) {
        expect(Array.isArray(entry.ids)).toBe(true);
        expect(entry.ids.every((id) => typeof id === 'string')).toBe(true);
      }
    }
    expect(parseVisitedStore('{"a":{"ids":"wawel"}}')).toEqual({});
  });

  it('keeps the names of a good entry once each and drops the rest', () => {
    const store = parseVisitedStore('{"3|2026-10-12|":{"ids":["wawel","rynek","wawel",4,null],"at":12}}');
    expect(store['3|2026-10-12|']).toEqual({ ids: ['wawel', 'rynek'], at: 12 });
  });

  it('is not fooled by a key that names the prototype', () => {
    const store = parseVisitedStore('{"__proto__":{"ids":["x"],"at":1}}');
    expect(Object.getPrototypeOf(store)).toBe(Object.prototype);
    expect(({} as { ids?: string[] }).ids).toBeUndefined();
  });
});

describe('keeping the ticks', () => {
  it('stores a plan’s places and removes the entry when nothing is ticked', () => {
    const one = withVisited({}, 'a', ['wawel'], 5);
    expect(one).toEqual({ a: { ids: ['wawel'], at: 5 } });
    expect(withVisited(one, 'a', [], 6)).toEqual({});
  });

  it('keeps only the newest plans', () => {
    let store = {};
    for (let i = 0; i < MAX_VISITED_PLANS + 5; i++) store = withVisited(store, `plan${i}`, ['x'], i);
    const keys = Object.keys(store);
    expect(keys).toHaveLength(MAX_VISITED_PLANS);
    expect(keys).not.toContain('plan0');
    expect(keys).toContain(`plan${MAX_VISITED_PLANS + 4}`);
  });
});

describe('on the phone', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('gives back what was ticked for a plan, and nothing for another', async () => {
    await saveVisited('a', ['wawel', 'rynek']);
    expect(await loadVisited('a')).toEqual(['wawel', 'rynek']);
    expect(await loadVisited('b')).toEqual([]);
  });

  it('survives a stored value that is not a map', async () => {
    await AsyncStorage.setItem(VISITED_KEY, '5');
    expect(await loadVisited('a')).toEqual([]);
    await saveVisited('a', ['wawel']);
    expect(await loadVisited('a')).toEqual(['wawel']);
  });

  it('does not lose a tick made while another is still being written', async () => {
    await Promise.all([saveVisited('a', ['wawel']), saveVisited('b', ['rynek']), saveVisited('a', ['wawel', 'planty'])]);
    expect(await loadVisited('a')).toEqual(['wawel', 'planty']);
    expect(await loadVisited('b')).toEqual(['rynek']);
  });

  it('clears the old one-key-per-plan entries', async () => {
    await AsyncStorage.setItem('kl.visited.abc', '["x"]');
    await AsyncStorage.setItem('kl.saved.v1', '["keep"]');
    // the clean-up runs once per start of the app: a fresh copy of the module is a fresh start
    let fresh!: typeof import('../src/lib/visited');
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      fresh = require('../src/lib/visited');
    });
    await fresh.loadVisited('a');
    expect(await AsyncStorage.getItem('kl.visited.abc')).toBeNull();
    expect(await AsyncStorage.getItem('kl.saved.v1')).toBe('["keep"]');
  });
});
