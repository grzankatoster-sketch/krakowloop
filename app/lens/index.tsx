import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Eyebrow, TopBar } from '../../src/components/ui';
import { lensPoints } from '../../src/data/lens';
import { distance, formatDistance } from '../../src/lib/geo';
import { useMyLocation } from '../../src/lib/useMyLocation';
import { colors, fonts, space } from '../../src/theme';

export default function LensList() {
  const router = useRouter();
  const me = useMyLocation();
  const here = me.status === 'ok' && !me.outsideCity ? me.coords : undefined;

  const rows = useMemo(() => {
    const list = lensPoints.map((p) => ({ point: p, metres: here ? distance(here, p) : null }));
    if (here) list.sort((a, b) => (a.metres ?? 0) - (b.metres ?? 0));
    return list;
  }, [here]);

  const note =
    me.status === 'asking'
      ? 'Finding you…'
      : me.status === 'ok' && me.outsideCity
        ? 'You seem to be outside Kraków. Distances appear when you are in the city.'
        : me.message ?? null;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TopBar title="Time Lens" />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.col}>
          <Text style={s.intro}>Stand at one of these spots, point your phone at the buildings and slide back through the centuries.</Text>
          {here ? null : <Button label="Show the nearest first" kind="quiet" onPress={me.locate} />}
          {note ? <Text style={s.note}>{note}</Text> : null}
          {rows.map(({ point: p, metres }) => {
            const first = p.layers.find((l) => l.image);
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}${metres !== null ? `, ${formatDistance(metres)} away` : ''}. Stand at ${p.where}.`}
                onPress={() => router.push(`/lens/${p.id}`)}
                style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}
              >
                {first?.image ? <Image source={first.image} style={s.thumb} resizeMode="cover" /> : <View style={s.thumb} />}
                <View style={s.rowBody}>
                  <View style={s.titleLine}>
                    <Text style={s.name}>{p.name}</Text>
                    {metres !== null ? <Text style={s.distance}>{formatDistance(metres)}</Text> : null}
                  </View>
                  <Text style={s.where}>Stand at: {p.where}</Text>
                  <Eyebrow>{p.layers.map((l) => l.year).join(' · ')}</Eyebrow>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  scroll: { paddingBottom: space.xl },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.m, gap: space.s },
  intro: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink, marginBottom: space.s },
  note: { fontFamily: fonts.body, fontSize: 14, color: colors.mute },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    backgroundColor: colors.paper,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.s,
  },
  thumb: { width: 84, height: 84, borderRadius: 10, backgroundColor: colors.line },
  rowBody: { flex: 1, gap: 3, paddingRight: space.s },
  titleLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.s },
  name: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.ink, flexShrink: 1 },
  distance: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.vistula },
  where: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.mute },
});
