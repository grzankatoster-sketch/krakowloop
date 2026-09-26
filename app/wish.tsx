import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { t } from '../src/i18n';
import { colors, fonts, space } from '../src/theme';

const EXAMPLES = ['wish.sheet.ex1', 'wish.sheet.ex2', 'wish.sheet.ex3', 'wish.sheet.ex4'] as const;

/**
 * The wish, in a native sheet (presentation: formSheet in app/_layout.tsx). The keyboard's own
 * microphone turns speech into text on the phone; Discover then reads the sentence.
 */
export default function WishSheet() {
  const router = useRouter();
  const [text, setText] = useState('');
  // Android shows the sheet full height: keep the title clear of the status bar
  const insets = useSafeAreaInsets();

  const send = (value: string) => {
    const said = value.trim();
    if (!said) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.dismiss();
    router.navigate({ pathname: '/map', params: { wish: said, at: String(Date.now()) } });
  };

  return (
    <View style={[s.root, { paddingTop: Math.max(space.l, insets.top + space.s) }]}>
      <Text style={s.title} accessibilityRole="header">
        {t('wish.sheet.title')}
      </Text>
      <Text style={s.hint}>{t('wish.sheet.hint')}</Text>
      <View style={s.box}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => send(text)}
          autoFocus
          multiline
          submitBehavior="submit"
          returnKeyType="search"
          placeholder={t('wish.sheet.placeholder')}
          placeholderTextColor={colors.mute}
          accessibilityLabel={t('wish.sheet.title')}
          style={s.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('discover.askSubmit')}
          disabled={!text.trim()}
          onPress={() => send(text)}
          style={({ pressed }) => [s.send, !text.trim() && s.sendOff, pressed && s.pressed]}
        >
          <MaterialCommunityIcons name="arrow-up" size={24} color={colors.white} />
        </Pressable>
      </View>
      <View style={s.examples}>
        {EXAMPLES.map((k) => (
          <Pressable key={k} accessibilityRole="button" onPress={() => send(t(k))} style={({ pressed }) => [s.example, pressed && s.pressed]}>
            <Text style={s.exampleText}>{t(k)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, padding: space.l, gap: space.m },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, color: colors.ink },
  hint: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.mute },
  box: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s, borderWidth: 2, borderColor: colors.ink, borderRadius: 20, backgroundColor: colors.white, padding: space.s, paddingLeft: space.m },
  input: { flex: 1, minHeight: 64, maxHeight: 140, fontFamily: fonts.body, fontSize: 19, color: colors.ink, paddingVertical: 8 },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brick, alignItems: 'center', justifyContent: 'center' },
  sendOff: { opacity: 0.35 },
  pressed: { transform: [{ scale: 0.97 }] },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  example: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.stone },
  exampleText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
});
