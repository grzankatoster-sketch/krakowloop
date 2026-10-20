import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type ErrorBoundaryProps } from 'expo-router';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { colors, fonts, layout, space, typeScale } from '../theme';

/**
 * A screen that failed says so in the traveller's language and offers a way on (try again, or back
 * to the start), instead of an empty screen. The message and the first lines of the stack are shown
 * only in development builds, where they help; a traveller never sees them. It is the boundary of the
 * whole app (app/_layout.tsx), so it brings its own safe area: it may stand in for the root layout.
 */
export function ScreenError(props: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <ErrorBody {...props} />
    </SafeAreaProvider>
  );
}

function ErrorBody({ error, retry }: ErrorBoundaryProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // At the root the navigator itself may be what failed: navigating then throws ("before mounting the
  // Root Layout"). The web reloads at the start instead; a phone tries the router and, failing that,
  // leaves "Try again" as the way on.
  const home = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign('/');
      return;
    }
    try {
      router.replace('/');
    } catch {
      retry();
    }
  };
  return (
    <ScrollView style={s.root} contentContainerStyle={[s.content, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.l }]}>
      <View style={s.col}>
        <Text style={s.title} role="heading" aria-level={1}>
          {t('error.title')}
        </Text>
        <Text style={s.text}>{t('error.text')}</Text>
        <Pressable accessibilityRole="button" onPress={retry} style={({ pressed }) => [s.btn, pressed && s.pressed]}>
          <Text style={s.btnText}>{t('error.retry')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={home} style={({ pressed }) => [s.btn, s.quiet, pressed && s.pressed]}>
          <Text style={[s.btnText, s.quietText]}>{t('error.home')}</Text>
        </Pressable>
        {__DEV__ ? (
          <>
            <Text style={s.msg} selectable>
              {String(error?.message ?? error)}
            </Text>
            <Text style={s.stack} selectable>
              {String(error?.stack ?? '').split('\n').slice(0, 14).join('\n')}
            </Text>
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.stone },
  content: { paddingHorizontal: space.m },
  col: { width: '100%', maxWidth: layout.column, alignSelf: 'center', gap: space.m },
  title: { ...typeScale.title, color: colors.ink },
  text: { ...typeScale.body, color: colors.ink },
  btn: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 999, backgroundColor: colors.ink },
  quiet: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
  quietText: { color: colors.ink },
  pressed: { opacity: 0.75 },
  msg: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.brick, marginTop: space.l },
  stack: { fontFamily: fonts.mono, fontSize: 11, color: colors.mute },
});
