import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CityBrief } from '../src/components/CityBrief';
import LoopMap from '../src/components/LoopMap';
import type { MapPoint } from '../src/components/mapHtml';
import { Button, Chip, Eyebrow, TopBar } from '../src/components/ui';
import { AFFILIATE_NOTE } from '../src/config/affiliates';
import { CATEGORY_COLOR } from '../src/data/categoryColor';
import { lensPoints } from '../src/data/lens';
import { PLACE_MEDIA } from '../src/data/placeMedia';
import { CATEGORY_LABEL, Category, Place, ZONE_LABEL, placeById, places } from '../src/data/places';
import { walkingRoute } from '../src/lib/directions';
import { DETOUR, distance, formatDistance, walkingMinutes } from '../src/lib/geo';
import { formatHours, hoursOn } from '../src/lib/hours';
import { openLink } from '../src/lib/openLink';
import { TRAM_STOPS } from '../src/lib/transit';
import { useMyLocation } from '../src/lib/useMyLocation';
import { colors, fonts, space } from '../src/theme';

const ORDER: Category[] = ['history', 'museum', 'jewish', 'view', 'food', 'daytrip', 'remembrance'];
const ME = '__me';
const LENS_PREFIX = 'lens:';

const LENS_MARKERS: MapPoint[] = lensPoints.map((l) => ({
  id: `${LENS_PREFIX}${l.id}`,
  lat: l.lat,
  lon: l.lon,
  color: colors.gilt,
  kind: 'lens',
  glyph: 'lens',
  label: `Time Lens: ${l.name}`,
}));
const STOP_MARKERS: MapPoint[] = TRAM_STOPS.map(([name, lat, lon], i) => ({
  id: `stop:${i}`,
  lat,
  lon,
  color: colors.ink,
  kind: 'stop',
  label: name,
}));

/** case and accent insensitive, so "wawel" finds "Wawel" and "krakow" finds "Kraków" */
const normalise = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase();

type Focus = { lat: number; lon: number; key: number } | null;

interface WalkPreview {
  placeId: string;
  coordinates: [number, number][];
  minutes: number;
  metres: number;
  source: 'mapbox' | 'estimate';
}

function MapButton({ label, active, onPress, hint }: { label: string; active?: boolean; onPress: () => void; hint: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint}
      accessibilityState={active === undefined ? undefined : { selected: active }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [s.mapButton, active && s.mapButtonOn, pressed && { opacity: 0.8 }]}
    >
      <Text style={[s.mapButtonText, active && s.mapButtonTextOn]}>{label}</Text>
    </Pressable>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const [active, setActive] = useState<Set<Category>>(() => new Set(ORDER.filter((c) => c !== 'daytrip')));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapWarning, setMapWarning] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<Focus>(null);
  const [threeD, setThreeD] = useState(false);
  const [showTrams, setShowTrams] = useState(false);
  const [fit, setFit] = useState<{ key: number; target: 'route' | 'points' }>({ key: 0, target: 'points' });
  const [walk, setWalk] = useState<WalkPreview | null>(null);
  const [walkNote, setWalkNote] = useState<string | null>(null);
  /** bumped whenever a pending walking route stops being wanted (another place, card closed) */
  const walkRequest = useRef(0);
  const [today] = useState(() => new Date());
  const me = useMyLocation();

  const place = selectedId ? placeById(selectedId) : undefined;
  const media = place ? PLACE_MEDIA[place.id] : undefined;
  const here = me.status === 'ok' ? me.coords : undefined;
  const q = normalise(query.trim());

  const visible = useMemo(
    () => places.filter((p) => active.has(p.cat) && (!q || normalise(`${p.name} ${p.local ?? ''}`).includes(q))),
    [active, q],
  );
  const points = useMemo<MapPoint[]>(() => {
    const pts: MapPoint[] = showTrams ? [...STOP_MARKERS] : [];
    for (const p of visible) pts.push({ id: p.id, lat: p.lat, lon: p.lon, color: CATEGORY_COLOR[p.cat], label: p.name, glyph: p.cat });
    pts.push(...LENS_MARKERS);
    if (here) pts.push({ id: ME, lat: here.lat, lon: here.lon, color: colors.vistula, kind: 'me' });
    return pts;
  }, [visible, here, showTrams]);
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
  const route = walk && walk.placeId === selectedId ? walk.coordinates : undefined;
  const refit = (target: 'route' | 'points') => setFit((f) => ({ key: f.key + 1, target }));

  const toggle = (c: Category) => {
    const next = new Set(active);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setActive(next);
    // a hidden pin can't stay selected
    if (place && !next.has(place.cat)) setSelectedId(null);
    // day trips are far away: zoom out to show them
    if (c === 'daytrip' && next.has(c)) {
      setView('map');
      refit('points');
    }
  };

  const select = useCallback(
    (id: string) => {
      if (id === ME) return;
      if (id.startsWith(LENS_PREFIX)) {
        router.push(`/lens/${id.slice(LENS_PREFIX.length)}`);
        return;
      }
      walkRequest.current += 1;
      setSelectedId(id);
      setDetails(false);
      setWalk(null);
      setWalkNote(null);
    },
    [router],
  );
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
    select(p.id);
    setView('map');
    flyTo(p.lat, p.lon);
  };
  const close = () => {
    walkRequest.current += 1;
    setSelectedId(null);
    setWalk(null);
    setWalkNote(null);
  };

  const walkHere = async (p: Place) => {
    // a slower answer for an earlier request must never replace a newer one
    const request = ++walkRequest.current;
    const stale = () => request !== walkRequest.current;
    setWalkNote('Finding you…');
    const loc = await me.locate();
    if (stale()) return;
    if (loc.status !== 'ok' || !loc.coords) {
      setWalkNote(loc.message ?? 'Your location is needed for a walking route.');
      return;
    }
    if (loc.outsideCity) {
      setWalkNote('You seem to be outside Kraków, so there is no walking route to show.');
      return;
    }
    const from = loc.coords;
    setWalkNote('Finding the way…');
    const real = await walkingRoute([from, p]);
    if (stale()) return;
    const straight = distance(from, p) * DETOUR;
    setWalk(
      real
        ? { placeId: p.id, coordinates: real.coordinates, minutes: real.legMinutes[0], metres: real.distanceMetres ?? straight, source: 'mapbox' }
        : { placeId: p.id, coordinates: [[from.lon, from.lat], [p.lon, p.lat]], minutes: walkingMinutes(from, p), metres: straight, source: 'estimate' },
    );
    setWalkNote(null);
    refit('route');
  };

  const locationNote =
    me.status === 'asking'
      ? 'Finding you…'
      : me.status === 'ok' && me.outsideCity
        ? 'You seem to be outside Kraków, so the map stays on the city.'
        : me.message ?? null;
  const hoursToday = place ? formatHours(hoursOn(place.id, today)) : null;
  const walkShown = walk && place && walk.placeId === place.id ? walk : null;
  const listOpen = view === 'list';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TopBar
        title="Map"
        right={
          <Pressable
            accessibilityRole="button"
            onPress={() => setView(listOpen ? 'map' : 'list')}
            hitSlop={8}
            style={({ pressed }) => [s.viewSwitch, pressed && { opacity: 0.75 }]}
          >
            <Text style={s.viewSwitchText}>{listOpen ? 'Show map' : 'Show list'}</Text>
          </Pressable>
        }
      />
      <View style={s.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search sights and museums"
          placeholderTextColor={colors.mute}
          style={s.search}
          accessibilityLabel="Search places"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={s.chipRow}>
        {ORDER.map((c) => (
          <Chip key={c} label={CATEGORY_LABEL[c]} active={active.has(c)} color={CATEGORY_COLOR[c]} onPress={() => toggle(c)} />
        ))}
      </ScrollView>
      {locationNote ? <Text style={s.locNote}>{locationNote}</Text> : null}

      <View style={s.mapWrap}>
        {/* the map stays mounted under the list (no reload), but is hidden from screen readers there */}
        <View
          style={s.map}
          aria-hidden={listOpen}
          accessibilityElementsHidden={listOpen}
          importantForAccessibility={listOpen ? 'no-hide-descendants' : 'auto'}
        >
          <LoopMap
            key={mapKey}
            style={s.map}
            points={points}
            route={route}
            selectedId={selectedId}
            focus={focus}
            fitKey={fit.key}
            fitTarget={fit.target}
            threeD={threeD}
            inactive={listOpen}
            onSelect={select}
            onError={onError}
            onWarning={onWarning}
            onReady={onReady}
          />
          {listOpen ? null : (
            <View style={s.mapButtons}>
              <MapButton label="3D" active={threeD} onPress={() => setThreeD((v) => !v)} hint="3D buildings" />
              <MapButton label="Trams" active={showTrams} onPress={() => setShowTrams((v) => !v)} hint="Show tram stops" />
              <MapButton label="Near me" onPress={nearMe} hint="Show where I am" />
            </View>
          )}
          {mapError ? (
            <View style={s.error}>
              <Text style={s.errorTitle}>The map didn’t load</Text>
              <Text style={s.errorText}>{mapError} Check your internet connection and try again.</Text>
              <Button label="Try again" onPress={retry} />
            </View>
          ) : null}
          {mapWarning && !mapError ? <Text style={s.warning}>Some map details didn’t load. Check your connection.</Text> : null}
        </View>

        {listOpen ? (
          <FlatList
            style={[StyleSheet.absoluteFill, s.list]}
            data={rows}
            keyExtractor={(r) => r.place.id}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={s.briefWrap}>
                <CityBrief />
              </View>
            }
            ListEmptyComponent={<Text style={s.hint}>Nothing matches. Try another word or turn on more categories.</Text>}
            renderItem={({ item }) => {
              const h = formatHours(hoursOn(item.place.id, today));
              const photo = PLACE_MEDIA[item.place.id]?.image;
              return (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openFromList(item.place)}
                  style={({ pressed }) => [s.row, pressed && { opacity: 0.8 }]}
                >
                  {photo ? (
                    <Image source={photo} style={s.rowPhoto} resizeMode="cover" accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={[s.rowPhoto, { backgroundColor: CATEGORY_COLOR[item.place.cat] }]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{item.place.name}</Text>
                    <Eyebrow>
                      {CATEGORY_LABEL[item.place.cat]}
                      {item.metres !== null ? ` · ${formatDistance(item.metres)}` : ` · ${ZONE_LABEL[item.place.zone]}`}
                    </Eyebrow>
                    {h ? <Text style={s.rowHours}>Today: {h}</Text> : null}
                  </View>
                </Pressable>
              );
            }}
          />
        ) : null}
      </View>

      {place && !listOpen ? (
        <View style={s.card}>
          <View style={s.cardHead}>
            <View style={{ flex: 1 }}>
              <Eyebrow>
                {CATEGORY_LABEL[place.cat]} · {place.minutes} min visit
                {here ? ` · ${formatDistance(distance(here, place))}` : ''}
              </Eyebrow>
              <Text style={s.name} accessibilityRole="header">
                {place.name}
              </Text>
              {hoursToday ? <Text style={s.hours}>Today: {hoursToday}</Text> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`Close ${place.name}`} onPress={close} hitSlop={10}>
              <Text style={s.close}>Close</Text>
            </Pressable>
          </View>
          {walkShown ? (
            <View style={s.walkRow}>
              <Text style={s.walkText}>
                {walkShown.minutes} min walk · {formatDistance(walkShown.metres)}
                {walkShown.source === 'estimate' ? ' (estimate)' : ''}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => setWalk(null)} hitSlop={8}>
                <Text style={s.close}>Clear route</Text>
              </Pressable>
            </View>
          ) : null}
          {walkNote ? (
            <Text style={s.hours} accessibilityLiveRegion="polite">
              {walkNote}
            </Text>
          ) : null}
          <View style={s.actions}>
            <Button label="Walk here" onPress={() => walkHere(place)} style={s.actionMain} />
            <Button
              label={details ? 'Less' : 'More'}
              kind="quiet"
              onPress={() => setDetails((v) => !v)}
              style={s.actionSide}
            />
          </View>
          {details ? (
            <ScrollView style={s.details} contentContainerStyle={s.detailsInner}>
              {media?.image ? (
                <View>
                  <Image source={media.image} style={s.photo} resizeMode="cover" accessibilityLabel={`Photo of ${place.name}`} />
                  <Pressable accessibilityRole="link" onPress={() => openLink(media.sourceUrl!)}>
                    <Text style={s.photoCredit} numberOfLines={2}>
                      Photo: {media.credit} · {media.license} · Wikimedia Commons
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              {place.local ? <Text style={s.local}>{place.local} · {ZONE_LABEL[place.zone]}</Text> : null}
              <Text style={s.blurb}>{place.blurb}</Text>
              {hoursToday ? <Text style={s.hours}>Opening hours from OpenStreetMap. Check before you go.</Text> : null}
              <View style={s.actions}>
                {place.lensId ? (
                  <Button label="Time Lens here" kind="quiet" onPress={() => router.push(`/lens/${place.lensId}`)} style={{ flexGrow: 1 }} />
                ) : null}
                {place.booking ? (
                  <Button label={place.booking.label} kind="quiet" onPress={() => openLink(place.booking!.url)} style={{ flexGrow: 1 }} />
                ) : null}
                {media?.website ? (
                  <Button label="Official website" kind="quiet" onPress={() => openLink(media.website!)} style={{ flexGrow: 1 }} />
                ) : null}
              </View>
              {place.booking?.affiliate ? <Text style={s.note}>{AFFILIATE_NOTE}</Text> : null}
            </ScrollView>
          ) : null}
        </View>
      ) : !listOpen ? (
        <Text style={s.hint}>Tap a pin to see what it is. Gold pins open Time Lens.</Text>
      ) : null}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  viewSwitch: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.ink },
  viewSwitchText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  searchRow: { paddingHorizontal: space.m, paddingBottom: space.s },
  search: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chipRow: { flexGrow: 0 },
  chips: { gap: space.s, paddingHorizontal: space.m, paddingBottom: space.s },
  locNote: { fontFamily: fonts.body, fontSize: 13, color: colors.mute, paddingHorizontal: space.m, paddingBottom: space.s },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  // above the map's own attribution button in the bottom corner, which must stay reachable
  mapButtons: { position: 'absolute', right: space.m, bottom: 56, gap: space.s, alignItems: 'flex-end' },
  mapButton: {
    minWidth: 52,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapButtonOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  mapButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  mapButtonTextOn: { color: colors.white },
  list: { backgroundColor: colors.stone },
  briefWrap: { marginHorizontal: space.m, marginBottom: space.s },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    marginHorizontal: space.m,
    marginBottom: space.s,
    padding: space.s,
    paddingRight: space.m,
    borderRadius: 14,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowPhoto: { width: 64, height: 64, borderRadius: 10 },
  rowName: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink, marginBottom: 2 },
  rowHours: { fontFamily: fonts.body, fontSize: 13, color: colors.mute, marginTop: 2 },
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
    right: 96,
    bottom: space.s,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderRadius: 10,
    padding: space.s,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: colors.paper,
    paddingHorizontal: space.m,
    paddingTop: space.m,
    paddingBottom: space.s,
    borderTopWidth: 1,
    borderColor: colors.line,
    gap: space.s,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s },
  name: { fontFamily: fonts.bodyBold, fontSize: 21, color: colors.ink, marginTop: 2 },
  local: { fontFamily: fonts.mono, fontSize: 12, color: colors.mute },
  close: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.vistula, paddingVertical: 4 },
  walkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s },
  walkText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  actionMain: { flexGrow: 2 },
  actionSide: { flexGrow: 1 },
  details: { maxHeight: 280 },
  detailsInner: { gap: space.s, paddingBottom: space.s },
  photo: { width: '100%', height: 130, borderRadius: 10, backgroundColor: colors.line },
  photoCredit: { fontFamily: fonts.body, fontSize: 11, color: colors.mute, marginTop: 4 },
  blurb: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  hours: { fontFamily: fonts.body, fontSize: 13, color: colors.mute },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.mute },
  hint: { fontFamily: fonts.body, fontSize: 14, color: colors.mute, padding: space.m, textAlign: 'center' },
});
