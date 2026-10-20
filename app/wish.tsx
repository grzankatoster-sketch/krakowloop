import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { t } from '../src/i18n';
import { colors, fonts, layout, space } from '../src/theme';

const EXAMPLES = ['wish.sheet.ex1', 'wish.sheet.ex2', 'wish.sheet.ex3', 'wish.sheet.ex4'] as const;

/**
 * The wish, in a native sheet (presentation: formSheet in app/_layout.tsx). The keyboard's own
 * microphone turns speech into text on the phone; Discover then reads the sentence.
 */
export default function WishSheet() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const isWeb = Platform.OS === 'web';
  const ready = text.trim().length > 0;
  // Android shows the sheet full height: keep the title clear of the status bar
  const insets = useSafeAreaInsets();

  const send = (value: string) => {
    const said = value.trim();
    if (!said) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const to = { pathname: '/map', params: { wish: said, at: String(Date.now()) } } as const;
    if (isWeb) {
      // on the web this is a plain page, not a sheet: there is nothing to dismiss, and Back should not return here
      router.replace(to);
      return;
    }
    router.dismiss();
    router.navigate(to);
  };

  // the web preview has no grabber or swipe: a close button (a sheet on a phone closes by dragging it down)
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={[s.root, { paddingTop: Math.max(space.l, insets.top + space.s) }]}>
      <View style={s.column}>
        <View style={s.head}>
          <Text style={s.title} accessibilityRole="header">
            {t('wish.sheet.title')}
          </Text>
          {isWeb ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('moment.close')} onPress={close} hitSlop={4} style={({ pressed }) => [s.close, pressed && s.pressed]}>
              <MaterialCommunityIcons name="close" size={24} color={colors.ink} aria-hidden />
            </Pressable>
          ) : null}
        </View>
        <Text style={s.hint}>{t('wish.sheet.hint')}</Text>
        {/* the frame carries the focus: the field inside draws no outline of its own */}
        <View style={[s.box, focused && s.boxFocus]}>
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => send(text)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
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
            accessibilityState={{ disabled: !ready }}
            disabled={!ready}
            onPress={() => send(text)}
            style={({ pressed }) => [s.send, !ready && s.sendOff, pressed && s.pressed]}
          >
            <MaterialCommunityIcons name="arrow-up" size={24} color={ready ? colors.white : colors.mute} aria-hidden />
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
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: space.l, paddingBottom: space.l },
  // one reading column; on a wide window (the web preview) it sits in the middle
  column: { flex: 1, width: '100%', maxWidth: layout.column, alignSelf: 'center', gap: space.m },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 34, lineHeight: 36, color: colors.ink },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.stone, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.mute },
  box: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s, borderWidth: 2, borderColor: colors.mute, borderRadius: 20, backgroundColor: colors.white, padding: space.s, paddingLeft: space.m },
  boxFocus: { borderColor: colors.ink, ...Platform.select({ web: { boxShadow: `0 0 0 3px ${colors.gilt}55` }, default: {} }) },
  input: {
    flex: 1,
    minHeight: 64,
    maxHeight: 140,
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.ink,
    paddingVertical: 8,
    // the browser's own rectangular focus outline would double the rounded frame
    ...Platform.select({ web: { outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle, default: {} }),
  },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brick, alignItems: 'center', justifyContent: 'center' },
  // plainly switched off (flat and quiet), not a faded version of the live button
  sendOff: { backgroundColor: colors.stone },
  pressed: { transform: [{ scale: 0.97 }] },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  example: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.stone },
  exampleText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
});
