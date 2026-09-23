// A fixed window per address, kept in memory: a brake against one phone (or script) flooding the
// model. Shared by server.mjs and worker.mjs.
export function rateLimiter(perMinute = 20, now = () => Date.now()) {
  const seen = new Map();
  return (ip) => {
    const t = now();
    const w = seen.get(ip);
    if (!w || t - w.start >= 60_000) {
      seen.set(ip, { start: t, n: 1 });
      if (seen.size > 5000) for (const [k, v] of seen) if (t - v.start >= 60_000) seen.delete(k);
      return true;
    }
    w.n++;
    return w.n <= perMinute;
  };
}
