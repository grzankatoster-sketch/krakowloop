import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../src/i18n';
import { colors, fonts, layout, space, typeScale } from '../src/theme';

/** An address the app does not have (an old or mistyped link): a way back in, in the traveller's language. */
export default function NotFound() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <Stack.Screen options={{ title: t('notFound.title') }} />
      <View style={s.col}>
        <Text style={s.title} role="heading" aria-level={1}>
          {t('notFound.title')}
        </Text>
        <Text style={s.text}>{t('notFound.text')}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={({ pressed }) => [s.btn, pressed && s.pressed]}>
          <Text style={s.btnText}>{t('notFound.home')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  col: { width: '100%', maxWidth: layout.column, alignSelf: 'center', padding: space.m, paddingTop: space.xl, gap: space.m },
  title: { ...typeScale.title, color: colors.ink },
  text: { ...typeScale.body, color: colors.ink },
  btn: { alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 999, backgroundColor: colors.ink },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
  pressed: { opacity: 0.75 },
});
