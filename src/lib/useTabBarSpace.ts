import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * How much of the bottom of a tab screen is covered by the tab bar. On iOS the native tab bar floats
 * over the screen (the content runs under it), so buttons at the bottom must sit above it; on Android
 * the bar takes its own space and on the web the tabs are elsewhere, so nothing needs to move there.
 */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'ios' ? insets.bottom + 58 : 0;
}

/** On the web the tabs float over the top of the page (y 24–64): what a tab screen keeps clear there. */
export const WEB_TABS_TOP = Platform.OS === 'web' ? 72 : 0;

/** The top of a tab screen that is free to use: under the phone's clock, and under the web's tabs. */
export function useTopSpace(): number {
  return useSafeAreaInsets().top + WEB_TABS_TOP;
}
