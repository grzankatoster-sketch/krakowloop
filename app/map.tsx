import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoopMap from '../src/components/LoopMap';
import { Button, Chip, Eyebrow, TopBar } from '../src/components/ui';
import { CATEGORY_LABEL, Category, ZONE_LABEL, placeById, places } from '../src/data/places';
import { CATEGORY_COLOR } from '../src/data/categoryColor';
import { AFFILIATE_NOTE } from '../src/config/affiliates';
import { openLink } from '../src/lib/openLink';
import { colors, fonts, space } from '../src/theme';

const ORDER: Category[] = ['history', 'museum', 'jewish', 'view', 'food', 'daytrip', 'remembrance'];

export default function MapScreen() {
  const router = useRouter();
  const [active, setActive] = useState<Set<Category>>(() => new Set(ORDER.filter((c) => c !== 'daytrip')));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);

  const place = selectedId ? placeById(selectedId) : undefined;

  const toggle = (c: Category) => {
    const next = new Set(active);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setActive(next);
    // a hidden pin can't stay selected
    if (place && !next.has(place.cat)) setSelectedId(null);
  };

  const points = useMemo(
    () =>
      places
        .filter((p) => active.has(p.cat))
        .map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, color: CATEGORY_COLOR[p.cat] })),
    [active],
  );
  const onSelect = useCallback((id: string) => setSelectedId(id), []);
  const onError = useCallback((message: string) => setMapError(message), []);
  const retry = () => {
    setMapError(null);
    setMapKey((k) => k + 1);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TopBar title="Map" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipRow}>
        {ORDER.map((c) => (
          <Chip key={c} label={CATEGORY_LABEL[c]} active={active.has(c)} color={CATEGORY_COLOR[c]} onPress={() => toggle(c)} />
        ))}
      </ScrollView>

      <View style={s.mapWrap}>
        <LoopMap key={mapKey} style={s.map} points={points} selectedId={selectedId} onSelect={onSelect} onError={onError} />
        {mapError ? (
          <View style={s.error}>
            <Text style={s.errorTitle}>The map didn’t load</Text>
            <Text style={s.errorText}>{mapError} Check your internet connection and try again.</Text>
            <Button label="Try again" onPress={retry} />
          </View>
        ) : null}
      </View>

      {place ? (
        <View style={s.card}>
          <View style={s.cardHead}>
            <View style={{ flex: 1 }}>
              <Eyebrow>
                {CATEGORY_LABEL[place.cat]} · {ZONE_LABEL[place.zone]} · {place.minutes} min
              </Eyebrow>
              <Text style={s.name}>{place.name}</Text>
              {place.local ? <Text style={s.local}>{place.local}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setSelectedId(null)} hitSlop={10}>
              <Text style={s.close}>Close</Text>
            </Pressable>
          </View>
          <Text style={s.blurb}>{place.blurb}</Text>
          <View style={s.actions}>
            {place.booking ? (
              <Button label={place.booking.label} onPress={() => openLink(place.booking!.url)} style={{ flexGrow: 1 }} />
            ) : null}
            {place.lensId ? (
              <Button label="Time Lens here" kind="quiet" onPress={() => router.push(`/lens/${place.lensId}`)} style={{ flexGrow: 1 }} />
            ) : null}
          </View>
          {place.booking?.affiliate ? <Text style={s.note}>{AFFILIATE_NOTE}</Text> : null}
        </View>
      ) : (
        <Text style={s.hint}>Tap a pin to see what it is.</Text>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  chipRow: { flexGrow: 0 },
  chips: { gap: space.s, paddingHorizontal: space.m, paddingBottom: space.s },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  error: {
    position: 'absolute',
    left: space.m,
    right: space.m,
    top: space.l,
    backgroundColor: colors.paper,
    borderRadius: 16,
    padding: space.m,
    gap: space.s,
    borderWidth: 1,
    borderColor: colors.line,
  },
  errorTitle: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.ink },
  errorText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink },
  card: { backgroundColor: colors.paper, padding: space.m, borderTopWidth: 1, borderColor: colors.line, gap: space.s },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s },
  name: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.ink, marginTop: 4 },
  local: { fontFamily: fonts.mono, fontSize: 12, color: colors.mute, marginTop: 2 },
  close: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.vistula, paddingVertical: 4 },
  blurb: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.mute },
  hint: { fontFamily: fonts.body, fontSize: 14, color: colors.mute, padding: space.m, textAlign: 'center' },
});
