import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * A screen that failed shows what failed, instead of an empty screen: the message and the first
 * lines of the stack, readable on a phone screenshot, and a button to try again.
 */
export function ScreenError({ error, retry }: ErrorBoundaryProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, gap: 12 }}>
      <Text style={s.title}>Ten ekran się nie wczytał</Text>
      <Text style={s.msg} selectable>
        {String(error?.message ?? error)}
      </Text>
      <Text style={s.stack} selectable>
        {String(error?.stack ?? '').split('\n').slice(0, 14).join('\n')}
      </Text>
      <Pressable accessibilityRole="button" onPress={retry} style={s.btn}>
        <Text style={s.btnText}>Spróbuj ponownie</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF4F0' },
  title: { fontSize: 22, fontWeight: '700', color: '#7A1F12' },
  msg: { fontSize: 16, color: '#1B1F3B' },
  stack: { fontSize: 11, color: '#444', fontFamily: 'Courier' },
  btn: { alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22, backgroundColor: '#1B1F3B' },
  btnText: { color: '#fff', fontWeight: '700' },
});
