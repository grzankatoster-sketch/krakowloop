import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { GrenzeGotisch_600SemiBold } from '@expo-google-fonts/grenze-gotisch';
import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { MartianMono_400Regular, MartianMono_600SemiBold } from '@expo-google-fonts/martian-mono';
import { colors } from '../src/theme';

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
    <SafeAreaProvider>
      <StatusBar style={colors.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.stone } }} />
    </SafeAreaProvider>
  );
}
