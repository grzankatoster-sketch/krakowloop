import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, space } from '../theme';

// Every line has a source in 03_research/ZRODLA_I_FAKTY.md ("Kraków in brief").
const FACTS: { label: string; text: string }[] = [
  { label: 'Royal city', text: 'Polish kings were crowned in Wawel Cathedral from 1320 to 1734.' },
  {
    label: 'World Heritage',
    text: 'The medieval town, Wawel Hill and Kazimierz were among the first places on the UNESCO World Heritage List, in 1978.',
  },
  { label: 'Visitors', text: 'About 14.7 million people came in 2024, 2.3 million of them from abroad.' },
  { label: 'Good to know', text: 'Money: Polish złoty (PLN). Emergency number: 112.' },
];

/** A short, expandable introduction to the city. */
export function CityBrief({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={s.box}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [s.head, pressed && { opacity: 0.8 }]}
      >
        <Text style={s.title}>Kraków in brief</Text>
        <Text style={s.toggle}>{open ? 'Hide' : 'Show'}</Text>
      </Pressable>
      {open
        ? FACTS.map((f) => (
            <View key={f.label} style={s.fact}>
              <Text style={s.label}>{f.label}</Text>
              <Text style={s.text}>{f.text}</Text>
            </View>
          ))
        : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.m },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  title: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  toggle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.vistula },
  fact: { paddingBottom: 12 },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.mute },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink, marginTop: 2 },
});
