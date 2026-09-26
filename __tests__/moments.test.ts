import { describe, expect, it } from '@jest/globals';
import { pickMoments, standingAt, walkMinutes } from '../src/lib/moments';

const RYNEK = { lat: 50.0617, lon: 19.9373 };
const src = [
  { id: 'cloth-hall', name: 'Sukiennice', kind: 'sight' as const, lat: 50.0616, lon: 19.9373, open: true, rank: 3 },
  { id: 'st-marys', name: 'Mariacki', kind: 'sight' as const, lat: 50.0616, lon: 19.9393, open: true, rank: 3 },
  { id: 'museum-closed', name: 'Zamknięte', kind: 'sight' as const, lat: 50.0618, lon: 19.9374, open: false, rank: 3 },
  { id: 'closing', name: 'Zaraz zamykają', kind: 'sight' as const, lat: 50.0619, lon: 19.9375, open: true, closesIn: 10 },
  { id: 'lens:cloth-hall', name: 'Dawny Kraków', kind: 'lens' as const, lat: 50.0617, lon: 19.9372, open: null, rank: 3 },
  { id: 'megami', name: 'Megami', kind: 'eat' as const, lat: 50.0622, lon: 19.9352, open: true, rank: 2 },
  { id: 'far', name: 'Daleko', kind: 'sight' as const, lat: 50.1, lon: 20.1, open: true, rank: 3 },
];

describe('now cards', () => {
  it('leaves out closed places, places about to close and places too far away', () => {
    const ids = pickMoments(src, RYNEK).map((m) => m.id);
    expect(ids).not.toContain('museum-closed');
    expect(ids).not.toContain('closing');
    expect(ids).not.toContain('far');
    expect(ids).toEqual(expect.arrayContaining(['cloth-hall', 'st-marys', 'lens:cloth-hall', 'megami']));
  });
  it('mixes kinds: two sights never follow each other while another kind waits', () => {
    const kinds = pickMoments(src, RYNEK).map((m) => m.kind);
    for (let i = 1; i < kinds.length - 1; i++) expect(kinds[i] === kinds[i - 1] && kinds[i] === 'sight' && kinds.slice(i).some((k) => k !== 'sight')).toBe(false);
  });
  it('counts walking minutes at an easy pace, never zero', () => {
    expect(walkMinutes(0)).toBe(1);
    expect(walkMinutes(750)).toBe(10);
  });
  it('respects the maximum', () => {
    expect(pickMoments(src, RYNEK, 2)).toHaveLength(2);
  });
});

describe('standing at a place', () => {
  it('finds the nearest place within 60 m, once per session', () => {
    const here = { lat: 50.06162, lon: 19.93735 };
    expect(standingAt(src, here, new Set())?.id).toBe('cloth-hall');
    expect(standingAt(src, here, new Set(['cloth-hall', 'lens:cloth-hall', 'museum-closed', 'closing']))).toBeNull();
    expect(standingAt(src, { lat: 50.07, lon: 19.95 }, new Set())).toBeNull();
  });
});
