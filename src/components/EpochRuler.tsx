import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

interface Item {
  key: string;
  year: string;
}

/** Years sit on a ruler in time order: the order on screen is the order in history. */
export function EpochRuler({ items, index, onChange }: { items: Item[]; index: number; onChange: (i: number) => void }) {
  return (
    <View style={s.wrap} accessibilityRole="tablist">
      <View style={s.rule} />
      {items.map((it, i) => {
        const on = i === index;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="tab"
            accessibilityLabel={`Show ${it.year}`}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(i)}
            style={s.cell}
            hitSlop={8}
          >
            <View style={[s.tick, on && s.tickOn]} />
            <Text style={[s.year, on && s.yearOn]}>{it.year}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
  rule: { position: 'absolute', left: 0, right: 0, top: 14, height: 1, backgroundColor: colors.ink },
  cell: { alignItems: 'center', minWidth: 56 },
  tick: { width: 1, height: 20, backgroundColor: colors.ink, marginBottom: 6 },
  tickOn: { width: 12, height: 20, borderRadius: 2, backgroundColor: colors.gilt, borderWidth: 1, borderColor: colors.ink },
  year: { fontFamily: fonts.mono, fontSize: 12, color: colors.mute },
  yearOn: { fontFamily: fonts.monoBold, color: colors.ink },
});
