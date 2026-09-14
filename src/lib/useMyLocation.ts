import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { CITY } from '../config/city';
import { LatLon, distance } from './geo';

export interface MyLocation {
  status: 'idle' | 'asking' | 'ok' | 'denied' | 'error';
  coords?: LatLon;
  /** true when the phone is too far from the city for directions to make sense */
  outsideCity?: boolean;
  message?: string;
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
            ? 'Location access was not allowed.'
            : 'Location access is off. Turn it on for KrakowLoop in your phone’s settings.',
        };
      } else {
        const last = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 200 });
        const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        next = { status: 'ok', coords, outsideCity: distance(coords, CITY.centre) > CITY.maxStartMetres };
      }
    } catch {
      next = { status: 'error', message: 'Your location could not be found.' };
    }
    if (alive.current) setState(next);
    return next;
  }, []);

  return { ...state, locate };
}
