import { describe, expect, it } from '@jest/globals';
import { dispatchMapMessage, parseMapMessage } from '../src/components/mapMessages';
import { places } from '../src/data/places';
import { paramsToPlan, planToParams, shareableParams } from '../src/lib/planParams';
import { PlanOptions } from '../src/lib/planner';

const ids = new Set(places.map((p) => p.id));

describe('plan params', () => {
  const full: PlanOptions = {
    days: 3,
    pace: 'easy',
    interests: ['history', 'jewish'],
    dayTrips: false,
    startDate: '2026-10-12',
    start: { lat: 50.064, lon: 19.945 },
    exclude: ['czartoryski', 'barbican'],
  };

  it('round-trips a plan', () => {
    expect(paramsToPlan({ ...planToParams(full) }, ids)).toEqual(full);
  });

  it('clears unset values with empty strings, and drops them from share links', () => {
    const minimal: PlanOptions = { days: 1, pace: 'steady', interests: [], dayTrips: true };
    expect(planToParams(minimal)).toMatchObject({ date: '', from: '', skip: '' });
    // no interests means an empty `likes`, which a share link can leave out
    expect(Object.keys(shareableParams(minimal)).sort()).toEqual(['days', 'pace', 'trips']);
    expect(paramsToPlan({ ...planToParams(minimal) }, ids)).toEqual({ ...minimal, startDate: undefined, start: undefined, exclude: [] });
  });

  it('rejects or cleans bad input', () => {
    expect(paramsToPlan({}, ids)).toBeNull();
    expect(paramsToPlan({ days: '9' }, ids)).toBeNull();
    expect(paramsToPlan({ days: '2.5' }, ids)).toBeNull();
    const cleaned = paramsToPlan(
      { days: '2', pace: 'sprint', likes: 'history,<script>', date: '2026-02-31', from: '52.23,21.01', skip: 'nope,barbican,barbican' },
      ids,
    );
    expect(cleaned).toEqual({ days: 2, pace: 'steady', interests: ['history'], dayTrips: true, startDate: undefined, start: undefined, exclude: ['barbican'] });
  });

  it('only accepts start dates whose whole plan stays valid', () => {
    for (const date of ['0100-01-01', '0999-10-12', '9999-12-31', '2100-12-31']) {
      const o = paramsToPlan({ days: '4', date }, ids);
      expect(o?.startDate).toBeUndefined();
    }
    expect(paramsToPlan({ days: '4', date: '2099-12-31' }, ids)?.startDate).toBe('2099-12-31');
  });

  it('survives hostile or broken values', () => {
    for (const days of [[], '', '0', '-1', 'Infinity', 'NaN', '1e1']) expect(paramsToPlan({ days }, ids)).toBeNull();
    const o = paramsToPlan({ days: '1', from: '50.064,' }, ids);
    expect(o?.start).toBeUndefined();
    expect(paramsToPlan({ days: '1', from: 'NaN,NaN' }, ids)?.start).toBeUndefined();
    const many = Array.from({ length: 100 }, () => places.map((p) => p.id)).flat().join(',');
    expect(paramsToPlan({ days: '1', skip: many }, ids)?.exclude?.length).toBeLessThanOrEqual(60);
  });

  it('writes a precise start point rounded to about 100 m', () => {
    const precise: PlanOptions = { days: 1, pace: 'steady', interests: [], dayTrips: true, start: { lat: 50.0641234, lon: 19.9456789 } };
    expect(planToParams(precise).from).toBe('50.064,19.946');
  });

  it('reads the first value when a param repeats', () => {
    expect(paramsToPlan({ days: ['2', '4'] }, ids)?.days).toBe(2);
  });
});

describe('map messages', () => {
  it('accepts the protocol', () => {
    expect(parseMapMessage('{"type":"ready"}')).toEqual({ type: 'ready' });
    expect(parseMapMessage('{"type":"select","id":"wawel-castle"}')).toEqual({ type: 'select', id: 'wawel-castle' });
    expect(parseMapMessage('{"type":"warning","message":"tile"}')).toEqual({ type: 'warning', message: 'tile' });
    expect(parseMapMessage('{"type":"error"}')).toEqual({ type: 'error', message: 'Unknown map problem.' });
  });

  it('enforces its limits exactly', () => {
    const padded = (len: number) => {
      const base = '{"type":"ready","pad":""}';
      return base.replace('""', `"${'x'.repeat(len - base.length)}"`);
    };
    expect(padded(2000)).toHaveLength(2000);
    expect(parseMapMessage(padded(2000))).toEqual({ type: 'ready' });
    expect(parseMapMessage(padded(2001))).toBeNull();
    expect(parseMapMessage(JSON.stringify({ type: 'select', id: '' }))).toBeNull();
    expect(parseMapMessage(JSON.stringify({ type: 'select', id: 'a'.repeat(64) }))).toEqual({ type: 'select', id: 'a'.repeat(64) });
    expect(parseMapMessage(JSON.stringify({ type: 'select', id: 'a'.repeat(65) }))).toBeNull();
    const long = parseMapMessage(JSON.stringify({ type: 'error', message: 'm'.repeat(301) }));
    expect(long?.type === 'error' && long.message.length).toBe(300);
  });

  it('dispatches each message to its own handler only', () => {
    const calls: string[] = [];
    const h = {
      onReady: () => calls.push('ready'),
      onSelect: (id: string) => calls.push(`select:${id}`),
      onError: (m: string) => calls.push(`error:${m}`),
      onWarning: (m: string) => calls.push(`warning:${m}`),
    };
    dispatchMapMessage({ type: 'ready' }, h);
    dispatchMapMessage({ type: 'select', id: 'barbican' }, h);
    dispatchMapMessage({ type: 'error', message: 'e' }, h);
    dispatchMapMessage({ type: 'warning', message: 'w' }, h);
    expect(calls).toEqual(['ready', 'select:barbican', 'error:e', 'warning:w']);
    // missing handlers are fine; a throwing handler is not swallowed
    expect(() => dispatchMapMessage({ type: 'ready' }, {})).not.toThrow();
    expect(() =>
      dispatchMapMessage({ type: 'ready' }, {
        onReady: () => {
          throw new Error('screen bug');
        },
      }),
    ).toThrow('screen bug');
  });

  it('ignores anything else', () => {
    expect(parseMapMessage('not json')).toBeNull();
    expect(parseMapMessage({ type: 'ready' })).toBeNull();
    expect(parseMapMessage('{"type":"select","id":42}')).toBeNull();
    expect(parseMapMessage('{"type":"eval"}')).toBeNull();
    expect(parseMapMessage('x'.repeat(3000))).toBeNull();
  });
});
