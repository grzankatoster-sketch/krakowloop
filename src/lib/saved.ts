// Places kept "for later": a heart on a place's screen, a row of them in Discover. Kept on the
// phone only (AsyncStorage), newest first; read once at start, then held in memory for every screen.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SAVED_KEY = 'kl.saved.v1';

/** The list after a heart is tapped: a saved place leaves it, a new one goes first. */
export function toggled(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];
}

/** What was stored, trusted only as far as it is a list of names. */
export function parseSaved(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string'))] : [];
  } catch {
    return [];
  }
}

let current: string[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(SAVED_KEY)
    .then((raw) => {
      current = parseSaved(raw);
      emit();
    })
    .catch(() => {});
}

function subscribe(l: () => void) {
  listeners.add(l);
  load();
  return () => void listeners.delete(l);
}

export function toggleSaved(id: string) {
  current = toggled(current, id);
  emit();
  AsyncStorage.setItem(SAVED_KEY, JSON.stringify(current)).catch(() => {});
}

/** The saved places' ids, newest first; every screen that shows them updates together. */
export function useSaved(): string[] {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
