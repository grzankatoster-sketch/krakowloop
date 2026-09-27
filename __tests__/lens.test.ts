import { describe, expect, it } from '@jest/globals';
import { cameraProblem, firstShown, lensPoints } from '../src/data/lens';

describe('Kraków in the past data', () => {
  it('gives every viewpoint something to show and a credit for every picture', () => {
    for (const p of lensPoints) {
      expect(p.layers.length + (p.reference ? 1 : 0)).toBeGreaterThan(0);
      for (const l of p.layers) {
        expect(l.credit).not.toBe('');
        expect(l.license).not.toBe('');
        // a picture we found is a Commons file; one we made says it is a reconstruction and where its knowledge comes from
        if (l.reconstruction) {
          expect(l.title).toMatch(/reconstruction/i);
          expect(l.sourceUrl).toMatch(/^https:\/\//);
        } else expect(l.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      }
      if (p.reference?.reconstruction) {
        expect(p.reference.title).toMatch(/model/i);
        expect(p.reference.sourceUrl).toMatch(/^https:\/\//);
      } else if (p.reference) expect(p.reference.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    }
  });

  it('opens on the oldest photo, or on today when a place has only engravings', () => {
    expect(firstShown(lensPoints.find((p) => p.id === 'cloth-hall')!)).toBe('sukiennice-1870');
    expect(firstShown(lensPoints.find((p) => p.id === 'skyline')!)).toBe('today');
  });
});

describe('cameraProblem', () => {
  it('lets native apps ask for the camera', () => {
    expect(cameraProblem({ web: false, secure: false, mediaDevices: false })).toBeNull();
  });

  it('explains a missing https link before anything else on the web', () => {
    expect(cameraProblem({ web: true, secure: false, mediaDevices: false })).toMatch(/https/);
  });

  it('explains a browser without a camera', () => {
    expect(cameraProblem({ web: true, secure: true, mediaDevices: false })).toMatch(/does not offer a camera/);
    expect(cameraProblem({ web: true, secure: true, mediaDevices: true })).toBeNull();
  });
});
