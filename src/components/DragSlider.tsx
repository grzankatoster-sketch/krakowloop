import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

export function DragSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [width, setWidth] = useState(1);
  const widthRef = useRef(1);
  widthRef.current = width;
  const change = useRef(onChange);
  change.current = onChange;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => change.current(clamp(e.nativeEvent.locationX / widthRef.current)),
        onPanResponderMove: (e) => change.current(clamp(e.nativeEvent.locationX / widthRef.current)),
      }),
    [],
  );

  return (
    <View>
      <View style={s.head}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.value}>{Math.round(value * 100)}%</Text>
      </View>
      <View
        style={s.track}
        onLayout={(e) => setWidth(Math.max(1, e.nativeEvent.layout.width))}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(clamp(value + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1)))}
        {...responder.panHandlers}
      >
        <View style={[s.fill, { width: `${value * 100}%`, pointerEvents: 'none' }]} />
        <View style={[s.thumb, { left: value * width - 11, pointerEvents: 'none' }]} />
      </View>
    </View>
  );
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

const s = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { fontFamily: 'AtkinsonHyperlegible_700Bold', fontSize: 14, color: colors.ink },
  value: { fontFamily: fonts.mono, fontSize: 12, color: colors.mute },
  track: { height: 28, justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: colors.ink },
  thumb: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: colors.gilt, borderWidth: 2, borderColor: colors.ink },
});
