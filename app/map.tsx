import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoopMap from '../src/components/LoopMap';
import type { MapPoint } from '../src/components/mapHtml';
import { Button, Chip, Eyebrow, TopBar } from '../src/components/ui';
import { CATEGORY_LABEL, Category, Place, ZONE_LABEL, placeById, places } from '../src/data/places';
import { CATEGORY_COLOR } from '../src/data/categoryColor';
import { AFFILIATE_NOTE } from '../src/config/affiliates';
import { distance, formatDistance } from '../src/lib/geo';
import { formatHours, hoursOn } from '../src/lib/hours';
import { openLink } from '../src/lib/openLink';
import { useMyLocation } from '../src/lib/useMyLocation';
import { colors, fonts, space } from '../src/theme';

const ORDER: Category[] = ['history', 'museum', 'jewish', 'view', 'food', 'daytrip', 'remembrance'];
const ME = '__me';

/** case and accent insensitive, so "wawel" finds "Wawel" and "krakow" finds "Kraków" */
const normalise = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase();

type Focus = { lat: number; lon: number; key: number } | null;

export default function MapScreen() {
  const router = useRouter();
  const [active, setActive] = useState<Set<Category>>(() => new Set(ORDER.filter((c) => c !== 'daytrip')));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapWarning, setMapWarning] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<Focus>(null);
  const [today] = useState(() => new Date());
  const me = useMyLocation();

  const place = selectedId ? placeById(selectedId) : undefined;
  const here = me.status === 'ok' ? me.coords : undefined;
  const q = normalise(query.trim());

  const visible = useMemo(
    () => places.filter((p) => active.has(p.cat) && (!q || normalise(`${p.name} ${p.local ?? ''}`).includes(q))),
    [active, q],
  );
  const points = useMemo<MapPoint[]>(() => {
    const pts: MapPoint[] = visible.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, color: CATEGORY_COLOR[p.cat] }));
    if (here) pts.push({ id: ME, lat: here.lat, lon: here.lon, color: colors.vistula, kind: 'me' });
    return pts;
  }, [visible, here]);
  const rows = useMemo(
    () =>
      visible
        .map((p) => ({ place: p, metres: here ? distance(here, p) : null }))
        .sort((a, b) =>
          a.metres !== null && b.metres !== null
            ? a.metres - b.metres
            : b.place.priority - a.place.priority || a.place.name.localeCompare(b.place.name),
        ),
    [visible, here],
  );

  const toggle = (c: Category) => {
    const next = new Set(active);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setActive(next);
    // a hidden pin can't stay selected
    if (place && !next.has(place.cat)) setSelectedId(null);
  };

  const onSelect = useCallback((id: string) => {
    if (id !== ME) setSelectedId(id);
  }, []);
  const onError = useCallback((message: string) => setMapError(message), []);
  const onWarning = useCallback((message: string) => setMapWarning(message), []);
  // a map that loads after an error (slow network) clears the message by itself
  const onReady = useCallback(() => setMapError(null), []);
  const retry = () => {
    setMapError(null);
    setMapWarning(null);
    setMapKey((k) => k + 1);
  };

  const flyTo = (lat: number, lon: number) => setFocus((f) => ({ lat, lon, key: (f?.key ?? 0) + 1 }));
  const nearMe = async () => {
    const loc = await me.locate();
    if (loc.status === 'ok' && loc.coords && !loc.outsideCity) {
      setView('map');
      flyTo(loc.coords.lat, loc.coords.lon);
    }
  };
  const openFromList = (p: Place) => {
    setSelectedId(p.id);
    setView('map');
    flyTo(p.lat, p.lon);
  };

  const locationNote =
    me.status === 'asking'
      ? 'Finding you…'
      : me.status === 'ok' && me.outsideCity
        ? 'You seem to be outside Kraków, so the map stays on the city.'
        : me.message ?? null;
  const hoursToday = place ? formatHours(hoursOn(place.id, today)) : null;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TopBar
        title="Map"
        right={
          <Pressable accessibilityRole="button" onPress={nearMe} hitSlop={8} style={({ pressed }) => [s.nearMe, pressed && { opacity: 0.75 }]}>
            <Text style={s.nearMeText}>Near me</Text>
          </Pressable>
        }
      />
      <View style={s.tools}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search places"
          placeholderTextColor={colors.mute}
          style={s.search}
          accessibilityLabel="Search places"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <Chip label="Map" active={view === 'map'} onPress={() => setView('map')} />
        <Chip label="List" active={view === 'list'} onPress={() => setView('list')} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipRow}>
        {ORDER.map((c) => (
          <Chip key={c} label={CATEGORY_LABEL[c]} active={active.has(c)} color={CATEGORY_COLOR[c]} onPress={() => toggle(c)} />
        ))}
      </ScrollView>
      {locationNote ? <Text style={s.locNote}>{locationNote}</Text> : null}

      <View style={s.mapWrap}>
        {/* the map stays mounted under the list, so switching views doesn't reload it */}
        <LoopMap
          key={mapKey}
          style={s.map}
          points={points}
          selectedId={selectedId}
          focus={focus}
          onSelect={onSelect}
          onError={onError}
          onWarning={onWarning}
          onReady={onReady}
        />
        {view === 'list' ? (
          <FlatList
            style={[StyleSheet.absoluteFill, s.list]}
            data={rows}
            keyExtractor={(r) => r.place.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={s.hint}>Nothing matches. Try another word or turn on more categories.</Text>}
            renderItem={({ item }) => {
              const h = formatHours(hoursOn(item.place.id, today));
              return (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openFromList(item.place)}
                  style={({ pressed }) => [s.row, pressed && { opacity: 0.8 }]}
                >
                  <View style={[s.rowDot, { backgroundColor: CATEGORY_COLOR[item.place.cat] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{item.place.name}</Text>
                    <Eyebrow>
                      {CATEGORY_LABEL[item.place.cat]} · {ZONE_LABEL[item.place.zone]}
                      {item.metres !== null ? ` · ${formatDistance(item.metres)}` : ''}
                    </Eyebrow>
                    {h ? <Text style={s.rowHours}>Today: {h}</Text> : null}
                  </View>
                </Pressable>
              );
            }}
          />
        ) : null}
        {mapError && view === 'map' ? (
          <View style={s.error}>
            <Text style={s.errorTitle}>The map didn’t load</Text>
            <Text style={s.errorText}>{mapError} Check your internet connection and try again.</Text>
            <Button label="Try again" onPress={retry} />
          </View>
        ) : null}
        {mapWarning && !mapError && view === 'map' ? (
          <Text style={s.warning}>Some map details didn’t load. Check your connection.</Text>
        ) : null}
      </View>

      {place ? (
        <View style={s.card}>
          <View style={s.cardHead}>
            <View style={{ flex: 1 }}>
              <Eyebrow>
                {CATEGORY_LABEL[place.cat]} · {ZONE_LABEL[place.zone]} · {place.minutes} min
                {here ? ` · ${formatDistance(distance(here, place))}` : ''}
              </Eyebrow>
              <Text style={s.name}>{place.name}</Text>
              {place.local ? <Text style={s.local}>{place.local}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setSelectedId(null)} hitSlop={10}>
              <Text style={s.close}>Close</Text>
            </Pressable>
          </View>
          <Text style={s.blurb}>{place.blurb}</Text>
          {hoursToday ? <Text style={s.hours}>Today: {hoursToday} · hours from OpenStreetMap, check before you go</Text> : null}
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
      ) : view === 'map' ? (
        <Text style={s.hint}>Tap a pin to see what it is.</Text>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  nearMe: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.ink },
  nearMeText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  tools: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.m, paddingBottom: space.s },
  search: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipRow: { flexGrow: 0 },
  chips: { gap: space.s, paddingHorizontal: space.m, paddingBottom: space.s },
  locNote: { fontFamily: fonts.body, fontSize: 13, color: colors.mute, paddingHorizontal: space.m, paddingBottom: space.s },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  list: { backgroundColor: colors.stone },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.m,
    marginHorizontal: space.m,
    marginBottom: space.s,
    padding: space.m,
    borderRadius: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowDot: { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  rowName: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink, marginBottom: 2 },
  rowHours: { fontFamily: fonts.body, fontSize: 13, color: colors.mute, marginTop: 4 },
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
  warning: {
    position: 'absolute',
    left: space.m,
    right: space.m,
    bottom: space.s,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderRadius: 10,
    padding: space.s,
    overflow: 'hidden',
    textAlign: 'center',
  },
  card: { backgroundColor: colors.paper, padding: space.m, borderTopWidth: 1, borderColor: colors.line, gap: space.s },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s },
  name: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.ink, marginTop: 4 },
  local: { fontFamily: fonts.mono, fontSize: 12, color: colors.mute, marginTop: 2 },
  close: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.vistula, paddingVertical: 4 },
  blurb: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  hours: { fontFamily: fonts.body, fontSize: 13, color: colors.mute },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.mute },
  hint: { fontFamily: fonts.body, fontSize: 14, color: colors.mute, padding: space.m, textAlign: 'center' },
});
