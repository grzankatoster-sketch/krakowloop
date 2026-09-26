import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { GrenzeGotisch_600SemiBold } from '@expo-google-fonts/grenze-gotisch';
import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { MartianMono_400Regular, MartianMono_600SemiBold } from '@expo-google-fonts/martian-mono';
import { LANG } from '../src/i18n';
import { colors } from '../src/theme';

// the language comes from the phone (src/i18n): tell the browser too, for screen readers and translation offers
if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = LANG;

// open on the tabs, whatever screen a deep link or a restored session names first
export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  // If the fonts fail to load, the app still opens with system fonts.
  const [loaded, fontError] = useFonts({
    GrenzeGotisch_600SemiBold,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
    MartianMono_400Regular,
    MartianMono_600SemiBold,
  });

  if (!loaded && !fontError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.stone, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={colors.dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.stone } }}>
          {/* the tabs come first: the first listed screen is where the app opens */}
          <Stack.Screen name="(tabs)" />
          {/* the wish: a real platform sheet, half height, pulled up to full */}
          <Stack.Screen
            name="wish"
            options={{ presentation: 'formSheet', sheetAllowedDetents: [0.55, 0.95], sheetGrabberVisible: true, sheetCornerRadius: 28, contentStyle: { backgroundColor: colors.paper } }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
