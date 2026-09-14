import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextStyle, View, ViewStyle, StyleProp } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, space } from '../theme';

export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.eyebrow, style]}>{children}</Text>;
}

export function TopBar({ title, right }: { title: string; right?: ReactNode }) {
  const router = useRouter();
  return (
    <View style={s.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={({ pressed }) => [s.back, pressed && s.pressed]}
      >
        <Text style={s.backText}>Back</Text>
      </Pressable>
      <Text style={s.barTitle} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <View style={s.barRight}>{right}</View>
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  /** category colour; the dot appears only when the colour means something */
  color?: string;
}) {
  const fill = color ?? colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [s.chip, active && { backgroundColor: fill, borderColor: fill }, pressed && s.pressed]}
    >
      {!active && color ? <View style={[s.dot, { backgroundColor: color }]} /> : null}
      <Text style={[s.chipText, active && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

/** Screen-reader names for buttons whose visible label is a symbol. */
const SYMBOL_NAMES: Record<string, string> = {
  '←': 'Move picture left',
  '→': 'Move picture right',
  '↑': 'Move picture up',
  '↓': 'Move picture down',
};

export function Button({
  label,
  onPress,
  kind = 'primary',
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'quiet';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? SYMBOL_NAMES[label]}
      onPress={onPress}
      style={({ pressed }) => [s.button, kind === 'quiet' && s.buttonQuiet, pressed && s.pressed, style]}
    >
      <Text style={[s.buttonText, kind === 'quiet' && { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.6, color: colors.mute, textTransform: 'uppercase' },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.m, paddingVertical: space.s, gap: space.s },
  back: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  backText: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 14 },
  barTitle: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  barRight: { minWidth: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  button: { backgroundColor: colors.ink, paddingVertical: 15, paddingHorizontal: 20, borderRadius: 14, alignItems: 'center' },
  buttonQuiet: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
  pressed: { opacity: 0.75 },
});
