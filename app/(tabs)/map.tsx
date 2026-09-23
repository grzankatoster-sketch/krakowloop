import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoopMap from '../../src/components/LoopMap';
import type { MapPoint } from '../../src/components/mapHtml';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Chip, Eyebrow, TopBar } from '../../src/components/ui';
import { CATEGORY_COLOR } from '../../src/data/categoryColor';
import { lensPoints } from '../../src/data/lens';
import { PLACE_MEDIA } from '../../src/data/placeMedia';
import { CATEGORY_LABEL, Category, ZONE_LABEL, places } from '../../src/data/places';
import { distance, formatDistance } from '../../src/lib/geo';
import { krakowWallClock } from '../../src/lib/cityTime';
import { hoursOn } from '../../src/lib/hours';
import { openState, statusLabel } from '../../src/lib/openNow';
import { BUS_STOP_LIST, TRAM_STOPS } from '../../src/lib/transit';
import { useMyLocation } from '../../src/lib/useMyLocation';
import { t } from '../../src/i18n';
import { colors, fonts, space } from '../../src/theme';

const ORDER: Category[] = ['history', 'museum', 'jewish', 'view', 'food', 'daytrip', 'remembrance', 'night'];
const ME = '__me';
const LENS_PREFIX = 'lens:';

const LENS_MARKERS: MapPoint[] = lensPoints.map((l) => ({
  id: `${LENS_PREFIX}${l.id}`,
  lat: l.lat,
  lon: l.lon,
  color: colors.gilt,
  kind: 'lens',
  glyph: 'lens',
  rank: 3,
  label: t('map.lensPin', { name: l.name }),
}));
// tram stops ringed in ink, bus stops in green: two kinds of stop, one switch
const STOP_MARKERS: MapPoint[] = [
  ...TRAM_STOPS.map(([name, lat, lon], i): MapPoint => ({ id: `stop:t${i}`, lat, lon, color: colors.ink, kind: 'stop', label: name })),
  ...BUS_STOP_LIST.map((b, i): MapPoint => ({ id: `stop:b${i}`, lat: b.lat, lon: b.lon, color: colors.patina, kind: 'stop', label: b.name })),
];

/** case and accent insensitive, so "wawel" finds "Wawel" and "krakow" finds "Kraków" */
const normalise = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .toLowerCase();

type Focus = { lat: number; lon: number; key: number } | null;

/** Open at this moment, by Kraków's clock. A place with unknown hours is not counted as open. */
function isOpenNow(id: string): boolean {
  const now = krakowWallClock(new Date());
  const hours = hoursOn(id, now);
  return !!hours && openState(hours, now.getHours() * 60 + now.getMinutes()).state === 'open';
}

/** Closed at this moment, from hours we have. A place with unknown hours is never called closed. */
function closedNow(id: string): boolean {
  const now = krakowWallClock(new Date());
  const hours = hoursOn(id, now);
  return !!hours && openState(hours, now.getHours() * 60 + now.getMinutes()).state !== 'open';
}




/** A category, or the stops layer, as one large row with a box to tick. */
function FilterRow({ label, color, on, onPress }: { label: string; color?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      aria-checked={on}
      onPress={onPress}
      style={({ pressed }) => [s.filterItem, pressed && { opacity: 0.8 }]}
    >
      <View aria-hidden importantForAccessibility="no-hide-descendants">
        <MaterialCommunityIcons name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={28} color={colors.ink} />
      </View>
      {color ? <View style={[s.filterDot, { backgroundColor: color }]} /> : null}
      <Text style={s.filterItemText}>{label}</Text>
    </Pressable>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const [active, setActive] = useState<Set<Category>>(() => new Set(ORDER.filter((c) => c !== 'daytrip' && c !== 'night')));
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapWarning, setMapWarning] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<Focus>(null);
  // the map is always 3D: one less switch to find, and buildings help people recognise where they are
  const threeD = true;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [showStops, setShowStops] = useState(false);
  // one line of help, shown until the traveller closes it or taps a place
  const [tipShown, setTipShown] = useState(true);
  const [fit, setFit] = useState<{ key: number; target: 'route' | 'points' }>({ key: 0, target: 'points' });
  // opening status in the list is read in Kraków time, whatever zone the phone is on
  const krakowNow = krakowWallClock(new Date());
  const krakowMinutes = krakowNow.getHours() * 60 + krakowNow.getMinutes();
  const me = useMyLocation();

  const here = me.status === 'ok' ? me.coords : undefined;
  const q = normalise(query.trim());

  const visible = useMemo(
    () =>
      places.filter(
        (p) => active.has(p.cat) && (!q || normalise(`${p.name} ${p.local ?? ''}`).includes(q)) && (!openOnly || isOpenNow(p.id)),
      ),
    [active, q, openOnly],
  );
  const points = useMemo<MapPoint[]>(() => {
    const pts: MapPoint[] = showStops ? [...STOP_MARKERS] : [];
    for (const p of visible)
      pts.push({
        id: p.id,
        lat: p.lat,
        lon: p.lon,
        color: CATEGORY_COLOR[p.cat],
        label: p.name,
        glyph: p.cat,
        rank: p.priority,
        // places to eat and drink are faded while they are closed: our own hours only, never Google's
        dim: (p.cat === 'food' || p.cat === 'night') && closedNow(p.id),
      });
    pts.push(...LENS_MARKERS);
    if (here) pts.push({ id: ME, lat: here.lat, lon: here.lon, color: colors.vistula, kind: 'me' });
    return pts;
  }, [visible, here, showStops]);
  const rows = useMemo(
    () =>
      visible
        .map((p) => ({ place: p, metres: here ? distance(here, p) : null }))
        .sort((a, b) =>
          // places outside Kraków (day trips, the memorial) come after everything in the city
          Number(a.place.zone === 'out') - Number(b.place.zone === 'out') ||
          (a.metres !== null && b.metres !== null
            ? a.metres - b.metres
            : b.place.priority - a.place.priority || a.place.name.localeCompare(b.place.name)),
        ),
    [visible, here],
  );
  const refit = (target: 'route' | 'points') => setFit((f) => ({ key: f.key + 1, target }));

  const toggle = (c: Category) => {
    const next = new Set(active);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setActive(next);
    // day trips are far away: zoom out to show them
    if (c === 'daytrip' && next.has(c)) {
      setView('map');
      refit('points');
    }
  };
  const allOn = active.size === ORDER.length;
  const toggleAll = () => setActive(new Set(allOn ? [] : ORDER));

  // A tap on a pin opens the place itself: photo, description, hours and the way there, in one step.
  const select = useCallback(
    (id: string) => {
      if (id === ME) return;
      setTipShown(false);
      if (id.startsWith(LENS_PREFIX)) {
        router.push(`/lens/${id.slice(LENS_PREFIX.length)}`);
        return;
      }
      router.push(`/place/${id}`);
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

  const locationNote =
    me.status === 'asking'
      ? t('walk.findingYou')
      : me.status === 'ok' && me.outsideCity
        ? t('map.outsideCity')
        : me.message ?? null;
  const listOpen = view === 'list';
  const covered = listOpen || filtersOpen;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <TopBar
        back={false}
        title={t('map.title')}
        right={
          <Pressable
            accessibilityRole="button"
            onPress={() => setView(listOpen ? 'map' : 'list')}
            hitSlop={8}
            style={({ pressed }) => [s.viewSwitch, pressed && { opacity: 0.75 }]}
          >
            <Text style={s.viewSwitchText}>{listOpen ? t('map.showMap') : t('map.showList')}</Text>
          </Pressable>
        }
      />
      <View style={s.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('map.searchPlaceholder')}
          placeholderTextColor={colors.mute}
          style={s.search}
          accessibilityLabel={t('map.searchLabel')}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <Pressable
          accessibilityRole="button"
          aria-expanded={filtersOpen}
          accessibilityLabel={t('map.filterLabel', { shown: active.size, total: ORDER.length })}
          onPress={() => setFiltersOpen((v) => !v)}
          style={({ pressed }) => [s.filterButton, filtersOpen && s.filterButtonOn, pressed && { opacity: 0.85 }]}
        >
          <View aria-hidden importantForAccessibility="no-hide-descendants">
            <MaterialCommunityIcons name="tune-variant" size={22} color={filtersOpen ? colors.white : colors.ink} />
          </View>
          <Text style={[s.filterButtonText, filtersOpen && s.onInk]}>{t('map.filterShort', { shown: active.size, total: ORDER.length })}</Text>
        </Pressable>
      </View>
      {/* always mounted, so screen readers announce each new message about the traveller's location */}
      <Text style={locationNote ? s.locNote : s.liveEmpty} accessibilityLiveRegion="polite">
        {locationNote ?? ''}
      </Text>

      <View style={s.mapWrap}>
        {/* the map stays mounted under the list and the filters (no reload), hidden from screen readers there */}
        <View
          style={s.map}
          aria-hidden={covered}
          accessibilityElementsHidden={covered}
          importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}
        >
          <LoopMap
            key={mapKey}
            style={s.map}
            points={points}
            focus={focus}
            fitKey={fit.key}
            fitTarget={fit.target}
            threeD={threeD}
            inactive={covered}
            onSelect={select}
            onError={onError}
            onWarning={onWarning}
            onReady={onReady}
          />
          {listOpen ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityHint={t('map.nearMeHint')}
              onPress={nearMe}
              hitSlop={6}
              style={({ pressed }) => [s.nearMe, pressed && { opacity: 0.8 }]}
            >
              <View aria-hidden importantForAccessibility="no-hide-descendants">
                <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.ink} />
              </View>
              <Text style={s.nearMeText}>{t('map.nearMe')}</Text>
            </Pressable>
          )}
          {tipShown && !covered ? (
            <View style={s.tip}>
              <Text style={s.tipText}>{t('map.tip')}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('map.tipClose')} onPress={() => setTipShown(false)} hitSlop={10}>
                <View aria-hidden importantForAccessibility="no-hide-descendants">
                  <MaterialCommunityIcons name="close" size={22} color={colors.white} />
                </View>
              </Pressable>
            </View>
          ) : null}
          {mapError ? (
            <View style={s.error} accessibilityRole="alert">
              <Text style={s.errorTitle}>{t('map.errorTitle')}</Text>
              <Text style={s.errorText}>
                {mapError} {t('map.errorHelp')}
              </Text>
              <Button label={t('map.tryAgain')} onPress={retry} />
            </View>
          ) : null}
          {mapWarning && !mapError ? (
            <Text style={s.warning} accessibilityRole="alert">
              {t('map.warning')}
            </Text>
          ) : null}
        </View>

        {filtersOpen ? (
          // a panel over the map instead of chips pushing it down: the map keeps its size behind
          <View style={s.sheet}>
            <ScrollView contentContainerStyle={s.sheetInner}>
              <Text style={s.sheetTitle} accessibilityRole="header">
                {t('map.categories')}
              </Text>
              <FilterRow label={t('map.allCategories')} on={allOn} onPress={toggleAll} />
              {ORDER.map((c) => (
                <FilterRow key={c} label={CATEGORY_LABEL[c]} color={CATEGORY_COLOR[c]} on={active.has(c)} onPress={() => toggle(c)} />
              ))}
              <View style={s.stopsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.filterItemText}>{t('map.stops')}</Text>
                  <Text style={s.stopsLine}>{t('map.stopsLine')}</Text>
                </View>
                <Switch
                  value={showStops}
                  onValueChange={setShowStops}
                  trackColor={{ true: colors.ink, false: colors.line }}
                  thumbColor={colors.paper}
                  accessibilityLabel={t('map.stops')}
                />
              </View>
            </ScrollView>
            <View style={s.sheetFoot}>
              <Button label={t('map.done')} onPress={() => setFiltersOpen(false)} />
            </View>
          </View>
        ) : null}

        {listOpen ? (
          <FlatList
            style={[StyleSheet.absoluteFill, s.list]}
            data={rows}
            keyExtractor={(r) => r.place.id}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={s.briefWrap}>
                {/* what is open now lives here, in the same list, instead of on a screen of its own */}
                <View style={s.openToggle}>
                  <Chip label={t('map.openOnly')} active={openOnly} onPress={() => setOpenOnly((v) => !v)} />
                </View>
                {/* stays mounted while the traveller types, so each new count is announced */}
                <Text style={s.count} accessibilityLiveRegion="polite">
                  {rows.length === 1 ? t('map.count.one') : t('map.count.many', { n: rows.length })}
                </Text>
              </View>
            }
            ListEmptyComponent={<Text style={s.hint}>{t('map.nothing')}</Text>}
            renderItem={({ item }) => {
              const dayHours = hoursOn(item.place.id, krakowNow);
              const status = dayHours ? openState(dayHours, krakowMinutes) : null;
              const photo = PLACE_MEDIA[item.place.id]?.image;
              return (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/place/${item.place.id}`)}
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
                    {status ? (
                      <Text style={[s.rowHours, status.state === 'open' && s.rowOpen]}>
                        {status.state === 'open' ? t('open.nowPrefix') : ''}
                        {statusLabel(status, krakowMinutes)}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  viewSwitch: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.ink },
  viewSwitchText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.s, paddingHorizontal: space.m, paddingBottom: space.s },
  search: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterButtonOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  filterButtonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  onInk: { color: colors.white },
  sheet: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.paper },
  sheetInner: { paddingHorizontal: space.m, paddingTop: space.s, paddingBottom: space.m },
  sheetTitle: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.ink, marginBottom: space.s },
  sheetFoot: { padding: space.m, borderTopWidth: 1, borderColor: colors.line },
  filterItem: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderBottomWidth: 1, borderColor: colors.line },
  filterDot: { width: 14, height: 14, borderRadius: 7 },
  filterItemText: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.ink },
  stopsRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 72, paddingTop: space.s },
  stopsLine: { fontFamily: fonts.body, fontSize: 14, color: colors.mute, marginTop: 2 },
  nearMe: {
    position: 'absolute',
    right: space.m,
    top: space.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 26,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  nearMeText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  // above the map's own attribution button in the bottom corner, which must stay reachable
  tip: {
    position: 'absolute',
    left: space.m,
    right: space.m,
    bottom: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.scrim,
  },
  tipText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, color: colors.onScrim },
  locNote: { fontFamily: fonts.body, fontSize: 13, color: colors.mute, paddingHorizontal: space.m, paddingBottom: space.s },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
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
  rowHours: { fontFamily: fonts.body, fontSize: 15, color: colors.mute, marginTop: 2 },
  rowOpen: { fontFamily: fonts.bodyBold, color: colors.patina },
  openToggle: { flexDirection: 'row', marginTop: space.s },
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
  hint: { fontFamily: fonts.body, fontSize: 15, color: colors.mute, padding: space.m, textAlign: 'center' },
  count: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.mute, marginTop: space.s },
  liveEmpty: { height: 0 },
});
