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
