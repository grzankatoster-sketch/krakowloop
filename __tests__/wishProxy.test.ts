import { describe, expect, it, jest } from '@jest/globals';
import { proxyReachable } from '../src/lib/wishProxy';

describe('whether the wish proxy can be reached from where the app runs', () => {
  it('does nothing when no proxy is configured', () => {
    expect(proxyReachable(undefined, 'localhost')).toBe(false);
    expect(proxyReachable('', null)).toBe(false);
  });

  it('ignores an address that is not a URL', () => {
    expect(proxyReachable('not a url', 'example.com')).toBe(false);
  });

  it('keeps the local proxy working in development on localhost', () => {
    expect(proxyReachable('http://localhost:8787', 'localhost')).toBe(true);
    expect(proxyReachable('http://localhost:8787', '127.0.0.1')).toBe(true);
    expect(proxyReachable('http://127.0.0.1:8787', 'localhost')).toBe(true);
  });

  it('skips a local proxy from a static build served from a real host', () => {
    expect(proxyReachable('http://localhost:8787', 'krakowloop.example.com')).toBe(false);
    expect(proxyReachable('http://127.0.0.1:8787', 'krakowloop.pages.dev')).toBe(false);
    expect(proxyReachable('http://[::1]:8787', 'krakowloop.pages.dev')).toBe(false);
  });

  it('skips a local proxy from a production build, even one served from localhost', () => {
    expect(proxyReachable('http://localhost:8787', 'localhost', false)).toBe(false);
    expect(proxyReachable('https://wish.krakowloop.workers.dev', 'localhost', false)).toBe(true);
  });

  it('uses a hosted proxy from anywhere', () => {
    expect(proxyReachable('https://wish.krakowloop.workers.dev', 'krakowloop.pages.dev')).toBe(true);
    expect(proxyReachable('https://wish.krakowloop.workers.dev', 'localhost')).toBe(true);
  });

  it('uses any proxy on a phone, where there is no page host', () => {
    expect(proxyReachable('http://192.168.1.20:8787', null)).toBe(true);
    expect(proxyReachable('http://localhost:8787', undefined)).toBe(true);
  });
});

describe('whether the screen may say a wish goes to the server', () => {
  const load = (url: string | undefined) => {
    const before = process.env.EXPO_PUBLIC_WISH_PROXY_URL;
    if (url === undefined) delete process.env.EXPO_PUBLIC_WISH_PROXY_URL;
    else process.env.EXPO_PUBLIC_WISH_PROXY_URL = url;
    try {
      let inUse = false;
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        inUse = (require('../src/lib/wishProxy') as typeof import('../src/lib/wishProxy')).wishProxyInUse();
      });
      return inUse;
    } finally {
      if (before === undefined) delete process.env.EXPO_PUBLIC_WISH_PROXY_URL;
      else process.env.EXPO_PUBLIC_WISH_PROXY_URL = before;
    }
  };

  it('is false without a proxy', () => {
    expect(load(undefined)).toBe(false);
  });

  it('is true for a proxy that is called (a phone has no page host)', () => {
    expect(load('https://wish.krakowloop.workers.dev')).toBe(true);
  });

  it('is false for a bad address, which the calls skip too', () => {
    expect(load('not a url')).toBe(false);
  });
});
