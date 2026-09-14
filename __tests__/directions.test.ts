import { describe, expect, it } from '@jest/globals';
import { fetchWalkingRoute } from '../src/lib/directions';

const A = { lat: 50.0615, lon: 19.9374 };
const B = { lat: 50.0547, lon: 19.9355 };
const C = { lat: 50.0513, lon: 19.9486 };

const answer = (body: unknown, ok = true) => async () => ({ ok, json: async () => body });
const route = (coordinates: unknown, legs: unknown) => ({ code: 'Ok', routes: [{ geometry: { coordinates }, legs }] });
const LINE = [
  [19.9374, 50.0615],
  [19.9355, 50.0547],
  [19.9486, 50.0513],
];

describe('fetchWalkingRoute', () => {
  it('reads one time per leg and the street geometry', async () => {
    let calledWith = '';
    const fetcher = async (url: string) => {
      calledWith = url;
      return { ok: true, json: async () => route(LINE, [{ duration: 120 }, { duration: 610 }]) };
    };
    const r = await fetchWalkingRoute([A, B, C], 'pk.test', fetcher);
    expect(r).toEqual({ coordinates: LINE, legMinutes: [2, 10], distanceMetres: null });
    const withDistance = async () => ({
      ok: true,
      json: async () => ({ ...route(LINE, [{ duration: 120 }, { duration: 610 }]), routes: [{ geometry: { coordinates: LINE }, legs: [{ duration: 120 }, { duration: 610 }], distance: 1234.5 }] }),
    });
    expect((await fetchWalkingRoute([A, B, C], 'pk.test', withDistance))?.distanceMetres).toBe(1234.5);
    expect(calledWith).toContain('/mapbox/walking/19.93740,50.06150;19.93550,50.05470;19.94860,50.05130');
    expect(calledWith).toContain('access_token=pk.test');
  });

  it('rejects answers that do not describe the requested legs', async () => {
    const cases = [
      route([], [{ duration: 60 }, { duration: 60 }]),
      route(LINE, [{ duration: 60 }]),
      route(LINE, [{ duration: 60 }, { duration: 'soon' }]),
      route([[19.9, 'x'], [19.9, 50]], [{ duration: 60 }, { duration: 60 }]),
      { code: 'NoRoute', routes: [] },
      null,
    ];
    for (const body of cases) expect(await fetchWalkingRoute([A, B, C], 'pk.test', answer(body))).toBeNull();
  });

  it('returns null on HTTP and network errors, and for too few points', async () => {
    expect(await fetchWalkingRoute([A, B], 'pk.test', answer({}, false))).toBeNull();
    const failing = async () => {
      throw new Error('offline');
    };
    expect(await fetchWalkingRoute([A, B], 'pk.test', failing)).toBeNull();
    expect(await fetchWalkingRoute([A], 'pk.test', answer(route(LINE, [])))).toBeNull();
  });
});
