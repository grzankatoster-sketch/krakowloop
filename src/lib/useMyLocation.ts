import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { CITY } from '../config/city';
import { LatLon, distance } from './geo';
import { t } from '../i18n';

export interface MyLocation {
  status: 'idle' | 'asking' | 'ok' | 'denied' | 'error';
  coords?: LatLon;
  /** true when the phone is too far from the city for directions to make sense */
  outsideCity?: boolean;
  message?: string;
}

/** How long a fix may take: indoors or with weak signal the phone can search for ever. */
const FIX_TIMEOUT_MS = 15000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

/** Asks for foreground location only when the user taps a button. Nothing leaves the phone here. */
export function useMyLocation() {
  const [state, setState] = useState<MyLocation>({ status: 'idle' });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const locate = useCallback(async (): Promise<MyLocation> => {
    setState({ status: 'asking' });
    let next: MyLocation;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        next = {
          status: 'denied',
          message: permission.canAskAgain
            ? t('loc.denied')
            : t('loc.off'),
        };
      } else if (!(await Location.hasServicesEnabledAsync())) {
        // allowed, but location is switched off on the phone: "Finding you…" would never end
        next = { status: 'error', message: t('loc.notFound') };
      } else {
        const last = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 200 });
        const pos = last ?? (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), FIX_TIMEOUT_MS));
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        next = { status: 'ok', coords, outsideCity: distance(coords, CITY.centre) > CITY.maxStartMetres };
      }
    } catch {
      next = { status: 'error', message: t('loc.notFound') };
    }
    if (alive.current) setState(next);
    return next;
  }, []);

  return { ...state, locate };
}
