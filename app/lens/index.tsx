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
          <Text style={s.intro}>
            Stand at one of these spots, point your phone at the buildings and slide back through the centuries.
          </Text>
          {here ? null : <Button label="Show the nearest first" kind="quiet" onPress={me.locate} />}
          {note ? <Text style={s.note}>{note}</Text> : null}
          {rows.map(({ point: p, metres }) => {
            const first = p.layers.find((l) => l.image);
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                onPress={() => router.push(`/lens/${p.id}`)}
                style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
              >
                {first?.image ? <Image source={first.image} style={s.thumb} resizeMode="cover" /> : null}
                <View style={s.cardBody}>
                  <Eyebrow>
                    {p.layers.map((l) => l.year).join(' · ')}
                    {metres !== null ? ` · ${formatDistance(metres)} away` : ''}
                  </Eyebrow>
                  <Text style={s.name}>{p.name}</Text>
                  <Text style={s.where}>{p.where}</Text>
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
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.m, gap: space.m },
  intro: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  note: { fontFamily: fonts.body, fontSize: 14, color: colors.mute },
  card: { backgroundColor: colors.paper, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  thumb: { width: '100%', height: 150, backgroundColor: colors.line },
  cardBody: { padding: space.m, gap: 2 },
  name: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.ink },
  where: { fontFamily: fonts.body, fontSize: 15, color: colors.mute },
});
