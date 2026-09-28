import { describe, expect, it } from '@jest/globals';
import { appleWalking, googleAppWalking, googleWalking, isAppleMobile, googleDayRoute, MAX_WAYPOINTS } from '../src/lib/navigate';

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

describe('a whole day as one route', () => {
  const a = { lat: 50.0617, lon: 19.9373 };
  const b = { lat: 50.0547, lon: 19.9355 };
  const c = { lat: 50.0513, lon: 19.9447 };
  it('goes from the first stop through the middle ones to the last, on foot', () => {
    const u = new URL(googleDayRoute([a, b, c])!);
    expect(u.origin + u.pathname).toBe('https://www.google.com/maps/dir/');
    expect(u.searchParams.get('origin')).toBe('50.061700,19.937300');
    expect(u.searchParams.get('waypoints')).toBe('50.054700,19.935500');
    expect(u.searchParams.get('destination')).toBe('50.051300,19.944700');
    expect(u.searchParams.get('travelmode')).toBe('walking');
  });
  it('starts at the hotel when the plan has one, and keeps every stop', () => {
    const hotel = { lat: 50.064, lon: 19.945 };
    const u = new URL(googleDayRoute([a, b, c], hotel)!);
    expect(u.searchParams.get('origin')).toBe('50.064000,19.945000');
    expect(u.searchParams.get('waypoints')).toBe('50.061700,19.937300|50.054700,19.935500');
  });
  it('keeps within the Google Maps limit and gives nothing for a single place', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ lat: 50 + i / 1000, lon: 19.9 }));
    expect(new URL(googleDayRoute(many)!).searchParams.get('waypoints')!.split('|')).toHaveLength(MAX_WAYPOINTS);
    expect(googleDayRoute([a])).toBeNull();
  });
});

