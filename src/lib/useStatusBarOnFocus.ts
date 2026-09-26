import { useCallback } from 'react';
import { setStatusBarStyle } from 'expo-status-bar';
import { useFocusEffect } from 'expo-router';
import { colors } from '../theme';

/**
 * The phone's clock and battery in the colour this screen needs while it is on top: white over a
 * full-screen photo, the app's own everywhere else. Tabs stay mounted, so it follows focus, not mount.
 */
export function useStatusBarOnFocus(style: 'light' | 'dark') {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style, true);
      return () => setStatusBarStyle(colors.dark ? 'light' : 'dark', true);
    }, [style]),
  );
}
