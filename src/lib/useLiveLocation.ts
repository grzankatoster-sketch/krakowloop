import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import type { LatLon } from './geo';

/**
 * The traveller's position while the app is open, for "You are standing at…". Nothing starts until
 * the traveller turns it on (the same promise as elsewhere: location only after a tap), and once the
 * phone already allows it, it resumes by itself. Positions stay on the phone.
 */
export function useLiveLocation() {
  const [here, setHere] = useState<LatLon | null>(null);
  const [on, setOn] = useState(false);
  const sub = useRef<Location.LocationSubscription | null>(null);
  // false once the screen is gone: a watch that starts after that is stopped at once
  const mounted = useRef(true);

  const [problem, setProblem] = useState<'services' | null>(null);

  const start = useCallback(async () => {
    if (sub.current) return true;
    try {
      const watch = await Location.watchPositionAsync(
        // every ~20 m of walking is enough to notice a place 60 m away, and kind to the battery
        { accuracy: Location.Accuracy.High, distanceInterval: 20, timeInterval: 5000 },
        (p) => setHere({ lat: p.coords.latitude, lon: p.coords.longitude }),
      );
      if (!mounted.current) {
        watch.remove();
        return false;
      }
      sub.current = watch;
    } catch {
      // permission given, but location is switched off in the phone's settings
      setProblem('services');
      return false;
    }
    setProblem(null);
    setOn(true);
    return true;
  }, []);

  /** asks for permission (a tap by the traveller), then follows the position */
  const turnOn = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return false;
      if (!(await Location.hasServicesEnabledAsync())) {
        setProblem('services');
        return false;
      }
      return await start();
    } catch {
      return false;
    }
  }, [start]);

  useEffect(() => {
    mounted.current = true;
    let alive = true;
    Location.getForegroundPermissionsAsync()
      .then((p) => {
        if (alive && p.status === 'granted') start().catch(() => {});
      })
      .catch(() => {});
    return () => {
      alive = false;
      mounted.current = false;
      sub.current?.remove();
      sub.current = null;
    };
  }, [start]);

  return { here, on, turnOn, problem };
}
