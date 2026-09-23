import { describe, expect, it } from '@jest/globals';
import { appleWalking, googleAppWalking, googleWalking, isAppleMobile } from '../src/lib/navigate';

const wawel = { lat: 50.054, lon: 19.9355 };

describe('handing directions to a maps app', () => {
  it('asks Google Maps for a walking route to the place, with no starting point', () => {
    const url = new URL(googleWalking(wawel));
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('api')).toBe('1');
    expect(url.searchParams.get('destination')).toBe('50.054000,19.935500');
    expect(url.searchParams.get('travelmode')).toBe('walking');
    expect(url.searchParams.has('origin')).toBe(false);
  });

  it('asks Apple Maps for a walking route the same way', () => {
    expect(appleWalking(wawel)).toBe('https://maps.apple.com/?daddr=50.054000,19.935500&dirflg=w');
    expect(googleAppWalking(wawel)).toBe('comgooglemaps://?daddr=50.054000,19.935500&directionsmode=walking');
  });

  it('recognises iPhones and iPads, including iPads that say they are a Mac', () => {
    expect(isAppleMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(true);
    expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isAppleMobile('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe(false);
  });
});
