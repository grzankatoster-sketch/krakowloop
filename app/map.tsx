import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  LayoutChangeEvent,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import LoopMap from '../src/components/LoopMap';
import type { MapPoint } from '../src/components/mapHtml';
import { Button, Chip, Eyebrow } from '../src/components/ui';
import { stay22Link } from '../src/config/affiliates';
import { CITY } from '../src/config/city';
import { CATEGORY_COLOR } from '../src/data/categoryColor';
import { CUISINE_KEYS, CuisineKey } from '../src/data/cuisines';
import { FOOD_INFO } from '../src/data/foodInfo';
import { lensPoints } from '../src/data/lens';
import { PLACE_MEDIA } from '../src/data/placeMedia';
import { CATEGORY_LABEL, Category, Experience, ZONE_LABEL, experiences, places } from '../src/data/places';
import { RESTAURANTS, Restaurant, cuisineCounts, restaurantHoursOn } from '../src/data/restaurants';
import { STAYS, Stay } from '../src/data/stays';
import { krakowWallClock } from '../src/lib/cityTime';
import {
  DiscoverIntent,
  DiscoverMode,
  EatFilters,
  NO_EAT_FILTERS,
  applyDiscoverIntent,
  byDistance,
  eatChips,
  filterEat,
  fold,
  nearest,
  parseMode,
  removeEatChip,
  toggleCuisine,
  topCuisines,
} from '../src/lib/discover';
import { distance, formatDistance, LatLon } from '../src/lib/geo';
import { formatHours, hoursOn } from '../src/lib/hours';
import { openWalkingDirections } from '../src/lib/navigate';
import { openLink, safeWebUrl } from '../src/lib/openLink';
import { openState, statusLabel } from '../src/lib/openNow';
import { BUS_STOP_LIST, TRAM_STOPS } from '../src/lib/transit';
import { placeName } from '../src/components/placeName';
import { useMyLocation } from '../src/lib/useMyLocation';
import { useReducedMotion } from '../src/lib/useReducedMotion';
import { readWishAnywhere, warmWishProxy } from '../src/lib/wishProxy';
import { t } from '../src/i18n';
import type { StringKey } from '../src/i18n/en';
import { colors, fonts, space } from '../src/theme';

const ME = '__me';
const LENS_PREFIX = 'lens:';
/** pins the map draws at once for a long catalogue: the nearest ones */
const MAX_PINS = 600;
const SEE_CATS: Category[] = ['history', 'museum', 'jewish', 'view', 'remembrance', 'daytrip'];
const DEFAULT_SEE = new Set<Category>(['history', 'museum', 'jewish', 'view', 'remembrance']);
const MODE_ICON: Record<DiscoverMode, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  see: 'bank-outline',
  eat: 'silverware-fork-knife',
  do: 'lightning-bolt-outline',
  stay: 'bed-outline',
};
const MODE_COLOR: Record<DiscoverMode, string> = { see: colors.brick, eat: colors.gilt, do: colors.patina, stay: colors.vistula };
const STAY_KINDS: Stay['kind'][] = ['hotel', 'guest_house', 'hostel', 'apartment'];
const EXP_KINDS = ['extreme', 'sightseeing', 'food', 'water', 'night'] as const;

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
const STOP_MARKERS: MapPoint[] = [
  ...TRAM_STOPS.map(([name, lat, lon], i): MapPoint => ({ id: `stop:t${i}`, lat, lon, color: colors.ink, kind: 'stop', label: name })),
  ...BUS_STOP_LIST.map((b, i): MapPoint => ({ id: `stop:b${i}`, lat: b.lat, lon: b.lon, color: colors.patina, kind: 'stop', label: b.name })),
];
/** the curated food places (src/data/places.ts) by their OpenStreetMap object, to link a pick to its page */
const PLACE_BY_OSM = new Map(Object.entries(FOOD_INFO).map(([placeId, info]) => [info.osm, placeId]));
const RYNEK: LatLon = { lat: CITY.mapCentre.lat, lon: CITY.mapCentre.lon };
const COUNTS = cuisineCounts();
const QUICK_CUISINES = topCuisines(COUNTS, 10);

type Focus = { lat: number; lon: number; key: number } | null;
type Picked = { type: 'eat'; item: Restaurant } | { type: 'stay'; item: Stay } | null;

function nowInKrakow() {
  const d = krakowWallClock(new Date());
  return { date: d, minutes: d.getHours() * 60 + d.getMinutes() };
}

/** open (true), closed (false) or unknown (null) at this moment, from our own hours only */
function restaurantOpen(r: Restaurant): boolean | null {
  const now = nowInKrakow();
  // restaurantHoursOn reads the weekday in Kraków time itself: it takes the real instant
  const h = restaurantHoursOn(r, new Date());
  return h ? openState(h, now.minutes).state === 'open' : null;
}

/** An activity's name or note in the app language (i18n exp.<id>.*), the English original otherwise. */
function expText(id: string, field: 'name' | 'note', fallback: string): string {
  const key = `exp.${id}.${field}` as StringKey;
  const v = t(key);
  return v && v !== key ? v : fallback;
}

/** words for vegetarian food in the three languages: the wish reader does not carry diets */
const VEG_WORDS = ['wege', 'wegan', 'wegetar', 'vegan', 'vegetar', 'vegeta'];

const chipLabel = (key: 'cuisine' | 'openNow' | 'picks' | 'veg', cuisine?: CuisineKey) =>
  key === 'cuisine' && cuisine ? t(`cuisine.${cuisine}` as StringKey) : t(`discover.chip.${key}` as StringKey);

export default function DiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; wish?: string; at?: string; cuisine?: string }>();
  const calm = useReducedMotion();
  const me = useMyLocation();
  const here = me.status === 'ok' && !me.outsideCity ? me.coords ?? null : null;
  const origin: LatLon = here ?? RYNEK;

  const [mode, setMode] = useState<DiscoverMode>(() => parseMode(params.mode));
  // a tile on the start screen opens a door (/map?mode=eat): follow the address when it changes
  // every change of door (a tap, or a tile on the start screen) starts a new epoch: a wish answer
  // that arrives from an older epoch is dropped
  const [epoch, setEpoch] = useState(0);
  const epochRef = useRef(0);
  useEffect(() => {
    epochRef.current = epoch;
  }, [epoch]);
  const [modeParam, setModeParam] = useState(params.mode);
  // the model behind the wish box may be asleep: wake it while the traveller looks at the map
  useEffect(() => warmWishProxy(), []);

  // what the traveller typed, and what the app understood from it
  const [text, setText] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [reading, setReading] = useState<'idle' | 'busy' | 'notUnderstood'>('idle');
  const readRun = useRef(0);

  // a cuisine tile in Discover opens the map on that cuisine (/map?mode=eat&cuisine=sushi)
  const [eat, setEat] = useState<EatFilters>(() =>
    (CUISINE_KEYS as readonly string[]).includes(params.cuisine ?? '') ? { ...NO_EAT_FILTERS, cuisines: [params.cuisine as CuisineKey] } : NO_EAT_FILTERS,
  );
  const [seeCats, setSeeCats] = useState<Set<Category>>(DEFAULT_SEE);
  const [stayKinds, setStayKinds] = useState<Set<Stay['kind']>>(new Set());
  const [expKind, setExpKind] = useState<(typeof EXP_KINDS)[number] | null>(null);
  // activities the traveller said no to ("no vodka tasting"): left out of the do door
  const [refused, setRefused] = useState<string[]>([]);
  const [showStops, setShowStops] = useState(false);
  const [picked, setPicked] = useState<Picked>(null);

  const [focus, setFocus] = useState<Focus>(null);
  const [fit, setFit] = useState({ key: 0 });
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapWarning, setMapWarning] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);

  // ---- the drawer: peek, half, full --------------------------------------------------------------
  const [areaH, setAreaH] = useState(0);
  const [topH, setTopH] = useState(0);
  const [snap, setSnap] = useState<0 | 1 | 2>(0);
  const heights = useMemo(() => {
    const full = Math.max(260, areaH - topH - space.s);
    return [Math.min(176, full), Math.min(Math.round(areaH * 0.52), full), full] as const;
  }, [areaH, topH]);
  // The sheet is always full height, pushed down: at peek or half, its bottom part is off the screen.
  // Lists end that much higher (plus the home indicator), so their last rows can still be scrolled to.
  const insets = useSafeAreaInsets();
  const listPad = { paddingBottom: heights[2] - heights[snap] + insets.bottom + space.m };
  // The drawer is a full-height sheet moved by translateY on the UI thread (no height animation, no
  // re-layout per frame): `shown` is how much of it is visible. A drag hands its speed to the spring.
  const shown = useSharedValue(176);
  const dragFrom = useSharedValue(0);
  const SPRING = { duration: 300, dampingRatio: 0.8 } as const;
  useEffect(() => {
    if (!areaH) return;
    shown.set(calm ? heights[snap] : withSpring(heights[snap], SPRING));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, heights, calm, areaH]);
  // the height caught at the end of a drag: React learns it once, and the phone ticks once
  const settle = useCallback((best: 0 | 1 | 2) => {
    setSnap(best);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);
  const pan = useMemo(() => {
    const [h0, h1, h2] = heights;
    return Gesture.Pan()
      .activeOffsetY([-6, 6])
      .onBegin(() => {
        dragFrom.set(shown.get());
      })
      .onUpdate((e) => {
        const h = dragFrom.get() - e.translationY;
        // past the ends it gives way slowly, instead of stopping dead
        shown.set(h > h2 ? h2 + (h - h2) * 0.2 : h < h0 ? h0 - (h0 - h) * 0.2 : h);
      })
      .onEnd((e) => {
        // the nearest height, nudged in the direction of a flick
        const target = shown.get() - e.velocityY * 0.12;
        const all = [h0, h1, h2];
        let best = 0;
        for (let i = 1; i < 3; i++) if (Math.abs(all[i] - target) < Math.abs(all[best] - target)) best = i;
        shown.set(calm ? all[best] : withSpring(all[best], { ...SPRING, velocity: -e.velocityY }));
        scheduleOnRN(settle, best as 0 | 1 | 2);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heights, calm, settle]);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: heights[2] - shown.get() }] }));

  // ---- what each door lists ------------------------------------------------------------------------
  const seeRows = useMemo(() => {
    const q = fold(nameQuery.trim());
    return byDistance(
      places.filter((p) => seeCats.has(p.cat) && (!q || fold(`${p.name} ${p.local ?? ''}`).includes(q))),
      // nearest to the traveller, or to the Main Square: never alphabetical, which put a day trip third
      origin,
    );
  }, [seeCats, nameQuery, origin]);

  const eatRows = useMemo(() => byDistance(filterEat(RESTAURANTS, eat, nameQuery, restaurantOpen), origin), [eat, nameQuery, origin]);

  const stayRows = useMemo(() => {
    const q = fold(nameQuery.trim());
    return byDistance(
      STAYS.filter((s) => (!stayKinds.size || stayKinds.has(s.kind)) && (!q || fold(s.name).includes(q))),
      origin,
    );
  }, [stayKinds, nameQuery, origin]);

  const nightPlaces = useMemo(() => {
    const q = fold(nameQuery.trim());
    return places.filter((p) => p.cat === 'night' && (!q || fold(`${p.name} ${p.local ?? ''}`).includes(q)));
  }, [nameQuery]);
  const doList = useMemo(() => {
    const q = fold(nameQuery.trim());
    return experiences.filter(
      (x) =>
        !refused.includes(x.id) &&
        (!expKind || (x as Experience & { kind?: string }).kind === expKind) &&
        (!q || fold(`${x.name} ${x.note} ${expText(x.id, 'name', x.name)}`).includes(q)),
    );
  }, [expKind, nameQuery, refused]);

  // ---- pins ----------------------------------------------------------------------------------------
  const points = useMemo<MapPoint[]>(() => {
    const pts: MapPoint[] = showStops ? [...STOP_MARKERS] : [];
    if (mode === 'see') {
      for (const { item: p } of seeRows)
        pts.push({ id: p.id, lat: p.lat, lon: p.lon, color: CATEGORY_COLOR[p.cat], label: placeName(p), glyph: p.cat, rank: p.priority });
      pts.push(...LENS_MARKERS);
    } else if (mode === 'eat') {
      const shown = nearest(eatRows.map((x) => x.item), origin, MAX_PINS);
      if (picked?.type === 'eat' && !shown.includes(picked.item)) shown.push(picked.item);
      for (const r of shown)
        pts.push({
          id: r.id,
          lat: r.lat,
          lon: r.lon,
          color: r.pick ? colors.brick : CATEGORY_COLOR.food,
          label: r.name,
          glyph: r.kind === 'cafe' ? 'coffee' : 'food',
          rank: r.pick ? 3 : 2,
          dim: restaurantOpen(r) === false,
        });
    } else if (mode === 'stay') {
      const shown = nearest(stayRows.map((x) => x.item), origin, MAX_PINS);
      if (picked?.type === 'stay' && !shown.includes(picked.item)) shown.push(picked.item);
      for (const s of shown)
        pts.push({ id: s.id, lat: s.lat, lon: s.lon, color: colors.vistula, label: s.name, glyph: 'stay', rank: s.stars && s.stars >= 4 ? 3 : 2 });
    } else {
      for (const p of nightPlaces)
        pts.push({ id: p.id, lat: p.lat, lon: p.lon, color: CATEGORY_COLOR.night, label: placeName(p), glyph: 'night', rank: p.priority });
    }
    if (here) pts.push({ id: ME, lat: here.lat, lon: here.lon, color: colors.vistula, kind: 'me' });
    return pts;
  }, [mode, seeRows, eatRows, stayRows, nightPlaces, origin, here, showStops, picked]);

  // a new door or new filters: show all their pins
  const refit = () => setFit((f) => ({ key: f.key + 1 }));
  const flyTo = (p: LatLon) => setFocus((f) => ({ lat: p.lat, lon: p.lon, key: (f?.key ?? 0) + 1 }));

  const switchMode = (m: DiscoverMode) => {
    setEpoch((e) => e + 1);
    setRefused([]);
    setReading('idle');
    setMode(m);
    setPicked(null);
    setNameQuery('');
    refit();
  };
  // a tile on the start screen opened a door (/map?mode=eat): the same reset as a tap on the door
  if (params.mode !== modeParam) {
    setModeParam(params.mode);
    if (params.mode) switchMode(parseMode(params.mode));
  }

  const select = useCallback(
    (id: string) => {
      if (id === ME) return;
      if (id.startsWith(LENS_PREFIX)) return router.push(`/lens/${id.slice(LENS_PREFIX.length)}`);
      if (mode === 'eat') {
        const r = RESTAURANTS.find((x) => x.id === id);
        if (r) {
          setPicked({ type: 'eat', item: r });
          setSnap(1);
          return;
        }
      }
      if (mode === 'stay') {
        const s = STAYS.find((x) => x.id === id);
        if (s) {
          setPicked({ type: 'stay', item: s });
          setSnap(1);
          return;
        }
      }
      router.push(`/place/${id}`);
    },
    [mode, router],
  );
  const pickFromList = (p: Picked) => {
    if (!p) return;
    setPicked(p);
    setSnap(1);
    flyTo(p.item);
  };

  // ---- the wish box ------------------------------------------------------------------------------
  const submit = () => submitText(text);
  const submitText = async (value: string) => {
    const said = value.trim();
    if (!said) return;
    const run = ++readRun.current;
    const since = epochRef.current;
    setReading('busy');
    const { intent, understood } = await readWishAnywhere(said);
    // a newer question, or a door changed meanwhile, wins over this late answer
    if (run !== readRun.current || since !== epochRef.current) return;
    const wish = intent as DiscoverIntent & { excludeActivities?: string[]; activities?: string[] };
    const veg = VEG_WORDS.some((w) => fold(said).includes(w));
    const next = applyDiscoverIntent({ ...wish, veg: veg || undefined }, NO_EAT_FILTERS);
    // a diet or "open now" alone is a food wish too, even when nothing else was recognised
    const food = next.eat.cuisines.length > 0 || veg || (understood && wish.openNow === true);
    if (food && !next.mode) next.mode = 'eat';
    if (!next.mode && (wish.activities?.length || wish.excludeActivities?.length)) next.mode = 'do';
    if ((understood && next.mode) || food) {
      setEat(next.eat);
      // the do door opens on the kind of activity asked for, without the refused ones
      const kind = wish.experienceKinds?.find((k): k is (typeof EXP_KINDS)[number] => (EXP_KINDS as readonly string[]).includes(k));
      setExpKind(kind ?? null);
      setRefused(wish.excludeActivities ?? []);
      setNameQuery('');
      if (next.mode) setMode(next.mode);
      setPicked(null);
      setSnap(1);
      setReading('idle');
      refit();
    } else {
      // nothing the tab can act on: search the names on this door instead
      setNameQuery(said);
      setReading('notUnderstood');
    }
  };
  // a wish sent from the sheet on the Now tab (/map?wish=…&at=…): read it once per send
  useEffect(() => {
    const w = params.wish;
    if (!w || !params.at) return;
    // after this render: the reading sets state of its own
    Promise.resolve().then(() => {
      setText(w);
      submitText(w);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.at]);

  const clearText = () => {
    readRun.current++;
    setText('');
    setNameQuery('');
    setReading('idle');
  };

  const onError = useCallback((m: string) => setMapError(m), []);
  const onWarning = useCallback((m: string) => setMapWarning(m), []);
  const onReady = useCallback(() => setMapError(null), []);
  const retry = () => {
    setMapError(null);
    setMapWarning(null);
    setMapKey((k) => k + 1);
  };
  const nearMe = async () => {
    const loc = await me.locate();
    if (loc.status === 'ok' && loc.coords && !loc.outsideCity) flyTo(loc.coords);
  };

  const chips = mode === 'eat' ? eatChips(eat) : [];
  const locationNote = me.status === 'asking' ? t('walk.findingYou') : me.status === 'ok' && me.outsideCity ? t('map.outsideCity') : me.message ?? null;
  const count = mode === 'see' ? seeRows.length : mode === 'eat' ? eatRows.length : mode === 'stay' ? stayRows.length : doList.length;

  // ---- the drawer's contents ---------------------------------------------------------------------
  const filterRow = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow} keyboardShouldPersistTaps="handled">
      {mode === 'see' ? <Chip label={t('discover.stops')} active={showStops} onPress={() => setShowStops((v) => !v)} /> : null}
      {mode === 'see' &&
        SEE_CATS.map((c) => (
          <Chip
            key={c}
            label={CATEGORY_LABEL[c]}
            color={CATEGORY_COLOR[c]}
            active={seeCats.has(c)}
            onPress={() => {
              const n = new Set(seeCats);
              if (n.has(c)) n.delete(c);
              else n.add(c);
              setSeeCats(n);
              refit();
            }}
          />
        ))}
      {mode === 'eat' && (
        <>
          <Chip label={t('discover.chip.openNow')} active={eat.openNow} onPress={() => setEat({ ...eat, openNow: !eat.openNow })} />
          <Chip label={t('discover.chip.picks')} active={eat.picks} onPress={() => setEat({ ...eat, picks: !eat.picks })} />
          <Chip label={t('discover.chip.veg')} active={eat.veg} onPress={() => setEat({ ...eat, veg: !eat.veg })} />
          {QUICK_CUISINES.map((c) => (
            <Chip
              key={c}
              label={`${t(`cuisine.${c}` as StringKey)} · ${COUNTS[c]}`}
              active={eat.cuisines.includes(c)}
              onPress={() => {
                setEat(toggleCuisine(eat, c));
                refit();
              }}
            />
          ))}
        </>
      )}
      {mode === 'do' && (
        <>
          <Chip label={t('discover.all')} active={!expKind} onPress={() => setExpKind(null)} />
          {EXP_KINDS.filter((k) => experiences.some((x) => (x as Experience & { kind?: string }).kind === k)).map((k) => (
            <Chip key={k} label={t(`exp.kind.${k}` as StringKey)} active={expKind === k} onPress={() => setExpKind(expKind === k ? null : k)} />
          ))}
        </>
      )}
      {mode === 'stay' &&
        STAY_KINDS.filter((k) => STAYS.some((x) => x.kind === k)).map((k) => (
          <Chip
            key={k}
            label={t(`stay.${k}` as StringKey)}
            active={stayKinds.has(k)}
            onPress={() => {
              const n = new Set(stayKinds);
              if (n.has(k)) n.delete(k);
              else n.add(k);
              setStayKinds(n);
              refit();
            }}
          />
        ))}
    </ScrollView>
  );

  const header = (
    <View>
      {filterRow}
      <View style={s.countRow}>
        <Text style={s.count} accessibilityLiveRegion="polite">
          {t('discover.count', { n: count })}
          {mode !== 'do' ? ` · ${here ? t('discover.fromYou') : t('discover.fromRynek')}` : ''}
        </Text>
      </View>
      {mode === 'stay' ? (
        <View style={s.stayCta}>
          <Button
            label={t('discover.stay.search')}
            onPress={() => openLink(stay22Link({ lat: origin.lat, lon: origin.lon }).url)}
          />
          <Text style={s.fine}>{t('discover.stay.searchNote')}</Text>
        </View>
      ) : null}
    </View>
  );

  const footer = mode === 'eat' || mode === 'stay' ? <Text style={s.credit}>{t('discover.osmCredit')}</Text> : null;
  const empty = <Text style={s.hint}>{t('discover.nothing')}</Text>;

  const list = () => {
    if (mode === 'see')
      return (
        <FlatList
          data={seeRows}
          keyExtractor={(r) => r.item.id}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={listPad}
          renderItem={({ item: { item: p, metres } }) => {
            const now = nowInKrakow();
            const h = hoursOn(p.id, now.date);
            const st = h ? openState(h, now.minutes) : null;
            const photo = PLACE_MEDIA[p.id]?.image;
            return (
              <Pressable accessibilityRole="button" onPress={() => router.push(`/place/${p.id}`)} style={({ pressed }) => [s.row, pressed && s.pressed]}>
                {photo ? (
                  <Image source={photo} style={s.rowPhoto} resizeMode="cover" accessibilityIgnoresInvertColors />
                ) : (
                  <View style={[s.rowPhoto, { backgroundColor: CATEGORY_COLOR[p.cat] }]} />
                )}
                <View style={s.rowBody}>
                  <Text style={s.rowName}>{placeName(p)}</Text>
                  <Eyebrow>
                    {CATEGORY_LABEL[p.cat]} · {metres !== null ? formatDistance(metres) : ZONE_LABEL[p.zone]}
                  </Eyebrow>
                  {st ? (
                    <Text style={[s.rowMeta, st.state === 'open' && s.open]}>
                      {st.state === 'open' ? t('open.nowPrefix') : ''}
                      {statusLabel(st, now.minutes)}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      );
    if (mode === 'eat')
      return (
        <FlatList
          data={eatRows}
          keyExtractor={(r) => r.item.id}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListEmptyComponent={empty}
          initialNumToRender={12}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={listPad}
          renderItem={({ item: { item: r, metres } }) => {
            const open = restaurantOpen(r);
            return (
              <Pressable accessibilityRole="button" onPress={() => pickFromList({ type: 'eat', item: r })} style={({ pressed }) => [s.row, pressed && s.pressed]}>
                <View style={[s.rowIcon, { backgroundColor: r.pick ? colors.brick : CATEGORY_COLOR.food }]} aria-hidden>
                  <MaterialCommunityIcons name={r.kind === 'cafe' ? 'coffee' : 'silverware-fork-knife'} size={22} color={colors.white} />
                </View>
                <View style={s.rowBody}>
                  <Text style={s.rowName}>{r.name}</Text>
                  <Eyebrow>
                    {[r.cuisines.map((c) => t(`cuisine.${c}` as StringKey)).join(', ') || t(`discover.kind.${r.kind}` as StringKey), metres !== null ? formatDistance(metres) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Eyebrow>
                  <View style={s.rowTags}>
                    {r.pick ? <Text style={s.badge}>{t('discover.pick')}</Text> : null}
                    {open === true ? <Text style={[s.rowMeta, s.open]}>{t('discover.openNow')}</Text> : null}
                    {open === false ? <Text style={s.rowMeta}>{t('discover.closedNow')}</Text> : null}
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      );
    if (mode === 'stay')
      return (
        <FlatList
          data={stayRows}
          keyExtractor={(r) => r.item.id}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListEmptyComponent={empty}
          initialNumToRender={12}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={listPad}
          renderItem={({ item: { item: st, metres } }) => (
            <Pressable accessibilityRole="button" onPress={() => pickFromList({ type: 'stay', item: st })} style={({ pressed }) => [s.row, pressed && s.pressed]}>
              <View style={[s.rowIcon, { backgroundColor: colors.vistula }]} aria-hidden>
                <MaterialCommunityIcons name="bed-outline" size={22} color={colors.white} />
              </View>
              <View style={s.rowBody}>
                <Text style={s.rowName}>{st.name}</Text>
                <Eyebrow>
                  {[t(`stay.${st.kind}` as StringKey), st.stars ? t('discover.stars', { n: st.stars }) : null, metres !== null ? formatDistance(metres) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Eyebrow>
              </View>
            </Pressable>
          )}
        />
      );
    return (
      <FlatList
        data={doList}
        keyExtractor={(x) => x.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={listPad}
        ListFooterComponent={
          <View style={s.nightBlock}>
            <Text style={s.sectionTitle} accessibilityRole="header">
              {t('discover.do.night')}
            </Text>
            {nightPlaces.map((p) => (
              <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/place/${p.id}`)} style={({ pressed }) => [s.rowSlim, pressed && s.pressed]}>
                <View style={[s.dot, { backgroundColor: CATEGORY_COLOR.night }]} />
                <Text style={s.rowNameSlim}>{placeName(p)}</Text>
                <MaterialCommunityIcons name="chevron-right" size={22} color={colors.mute} aria-hidden />
              </Pressable>
            ))}
          </View>
        }
        renderItem={({ item: x }) => {
          const e = x as Experience & { kind?: string; minutes?: number; pickup?: boolean };
          const meta = [
            e.kind ? t(`exp.kind.${e.kind}` as StringKey) : null,
            e.minutes ? t('discover.do.minutes', { h: Math.round((e.minutes / 60) * 10) / 10 }) : null,
            e.pickup ? t('discover.do.pickup') : null,
            e.season ?? null,
          ].filter(Boolean);
          return (
            <View style={s.expCard}>
              <Text style={s.rowName}>{expText(e.id, 'name', e.name)}</Text>
              {meta.length ? <Eyebrow>{meta.join(' · ')}</Eyebrow> : null}
              <Text style={s.expNote}>{expText(e.id, 'note', e.note)}</Text>
              <Button label={t('discover.do.book')} kind="quiet" onPress={() => openLink(e.booking.url)} />
            </View>
          );
        }}
      />
    );
  };

  const detail = () => {
    if (!picked) return null;
    const close = () => setPicked(null);
    if (picked.type === 'eat') {
      const r = picked.item;
      const now = nowInKrakow();
      const h = restaurantHoursOn(r, new Date());
      const st = h ? openState(h, now.minutes) : null;
      const placeId = PLACE_BY_OSM.get(r.osm);
      return (
        <ScrollView contentContainerStyle={[s.detail, listPad]} keyboardShouldPersistTaps="handled">
          <DetailHead title={r.name} onClose={close} />
          <Eyebrow>
            {[r.cuisines.map((c) => t(`cuisine.${c}` as StringKey)).join(', ') || t(`discover.kind.${r.kind}` as StringKey), formatDistance(distance(origin, r))].join(' · ')}
          </Eyebrow>
          {r.pick ? <Text style={[s.badge, s.badgeBig]}>{t('discover.pick')}</Text> : null}
          {r.address ? <Text style={s.detailLine}>{r.address}</Text> : null}
          <Text style={[s.detailLine, st?.state === 'open' && s.open]}>
            {st ? `${st.state === 'open' ? t('open.nowPrefix') : ''}${statusLabel(st, now.minutes)}` : t('discover.hoursUnknown')}
            {h ? ` · ${t('discover.today', { hours: formatHours(h) ?? '' })}` : ''}
          </Text>
          {r.diet?.length ? <Text style={s.detailLine}>{r.diet.map((d) => t(`discover.diet.${d}` as StringKey)).join(', ')}</Text> : null}
          <View style={s.actions}>
            <Button label={t('discover.navigate')} onPress={() => openWalkingDirections(r)} />
            {placeId ? <Button label={t('discover.more')} kind="quiet" onPress={() => router.push(`/place/${placeId}`)} /> : null}
            {safeWebUrl(r.website) ? <Button label={t('discover.website')} kind="quiet" onPress={() => openLink(safeWebUrl(r.website)!)} /> : null}
            {r.phone ? <Button label={t('discover.call')} kind="quiet" onPress={() => Linking.openURL(`tel:${r.phone!.replace(/[^+\d]/g, '')}`).catch(() => {})} /> : null}
          </View>
          <Text style={s.credit}>{t('discover.osmCredit')}</Text>
        </ScrollView>
      );
    }
    const st = picked.item;
    return (
      <ScrollView contentContainerStyle={[s.detail, listPad]}>
        <DetailHead title={st.name} onClose={close} />
        <Eyebrow>
          {[t(`stay.${st.kind}` as StringKey), st.stars ? t('discover.stars', { n: st.stars }) : null, formatDistance(distance(origin, st))].filter(Boolean).join(' · ')}
        </Eyebrow>
        {st.address ? <Text style={s.detailLine}>{st.address}</Text> : null}
        <View style={s.actions}>
          <Button label={t('discover.stay.prices')} onPress={() => openLink(stay22Link({ lat: st.lat, lon: st.lon }).url)} />
          {safeWebUrl(st.website) ? <Button label={t('discover.website')} kind="quiet" onPress={() => openLink(safeWebUrl(st.website)!)} /> : null}
          <Button label={t('discover.navigate')} kind="quiet" onPress={() => openWalkingDirections(st)} />
        </View>
        <Text style={s.fine}>{t('discover.stay.searchNote')}</Text>
        <Text style={s.credit}>{t('discover.osmCredit')}</Text>
      </ScrollView>
    );
  };

  const selectedId = picked?.item.id ?? null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.area} onLayout={(e: LayoutChangeEvent) => setAreaH(e.nativeEvent.layout.height)}>
        <View style={StyleSheet.absoluteFill} aria-hidden={snap === 2} importantForAccessibility={snap === 2 ? 'no-hide-descendants' : 'auto'}>
          <LoopMap
            key={mapKey}
            style={StyleSheet.absoluteFill}
            points={points}
            selectedId={selectedId}
            focus={focus}
            fitKey={fit.key}
            fitTarget="points"
            threeD
            inactive={snap === 2}
            onSelect={select}
            onError={onError}
            onWarning={onWarning}
            onReady={onReady}
          />
        </View>

        {/* the question, the four doors and what was understood, over the top of the map */}
        <View style={s.top} onLayout={(e) => setTopH(e.nativeEvent.layout.height)}>
          <View style={s.ask}>
            {/* the map is a tool opened from Today or Discover: one tap back */}
            <Pressable accessibilityRole="button" accessibilityLabel={t('ui.goBack')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={8} style={s.iconBtn}>
              <MaterialCommunityIcons name="chevron-left" size={28} color={colors.ink} aria-hidden />
            </Pressable>
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v);
                if (!v.trim()) clearText();
              }}
              onSubmitEditing={submit}
              placeholder={t('discover.askPlaceholder')}
              placeholderTextColor={colors.mute}
              style={s.askInput}
              accessibilityLabel={t('discover.askLabel')}
              returnKeyType="search"
              autoCorrect={false}
            />
            {text ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('discover.clear')} onPress={clearText} hitSlop={10} style={s.iconBtn}>
                <MaterialCommunityIcons name="close" size={20} color={colors.ink} aria-hidden />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('discover.askSubmit')}
              onPress={submit}
              disabled={!text.trim() || reading === 'busy'}
              style={({ pressed }) => [s.go, (!text.trim() || reading === 'busy') && s.goOff, pressed && s.pressed]}
            >
              <MaterialCommunityIcons name="arrow-right" size={22} color={colors.white} aria-hidden />
            </Pressable>
          </View>

          <View style={s.modes} accessibilityRole="tablist">
            {(['see', 'eat', 'do', 'stay'] as DiscoverMode[]).map((m) => {
              const on = mode === m;
              return (
                <Pressable
                  key={m}
                  accessibilityRole="tab"
                  aria-selected={on}
                  onPress={() => switchMode(m)}
                  style={({ pressed }) => [s.mode, on && { backgroundColor: MODE_COLOR[m] }, pressed && s.pressed]}
                >
                  <MaterialCommunityIcons name={MODE_ICON[m]} size={20} color={on ? colors.white : colors.ink} aria-hidden />
                  <Text style={[s.modeText, on && s.modeTextOn]}>{t(`discover.mode.${m}` as StringKey)}</Text>
                </Pressable>
              );
            })}
          </View>

          {reading === 'busy' ? (
            <Text style={s.readingNote} accessibilityLiveRegion="polite">
              {t('discover.reading')}
            </Text>
          ) : null}
          {reading === 'notUnderstood' ? (
            <Text style={s.readingNote} accessibilityLiveRegion="polite">
              {t('discover.notUnderstood')}
            </Text>
          ) : null}
          {chips.length ? (
            <View style={s.understood}>
              <Text style={s.understoodLabel}>{t('discover.understood')}</Text>
              <View style={s.understoodChips}>
                {chips.map((c) => {
                  const label = chipLabel(c.label.key, c.label.cuisine);
                  return (
                    <Pressable
                      key={c.key}
                      accessibilityRole="button"
                      accessibilityLabel={t('discover.removeChip', { label })}
                      onPress={() => {
                        setEat(removeEatChip(eat, c.key));
                        refit();
                      }}
                      style={({ pressed }) => [s.uChip, pressed && s.pressed]}
                    >
                      <Text style={s.uChipText}>{label}</Text>
                      <MaterialCommunityIcons name="close" size={16} color={colors.ink} aria-hidden />
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          {locationNote ? (
            <Text style={s.locNote} accessibilityLiveRegion="polite">
              {locationNote}
            </Text>
          ) : null}
        </View>

        {mapError ? (
          <View style={[s.error, { top: topH + space.s }]} accessibilityRole="alert">
            <Text style={s.errorTitle}>{t('map.errorTitle')}</Text>
            <Text style={s.errorText}>
              {/* the map engine reports in English: the traveller gets the translated help only */}
              {t('map.errorHelp')}
            </Text>
            <Button label={t('map.tryAgain')} onPress={retry} />
          </View>
        ) : null}
        {mapWarning && !mapError ? (
          <Text style={[s.warning, { top: topH + space.s }]} accessibilityRole="alert">
            {t('map.warning')}
          </Text>
        ) : null}

        {/* the drawer: a handle to drag or tap, then the list or the chosen place */}
        <Animated.View style={[s.drawer, { height: heights[2] }, sheetStyle]}>
          {/* rides on the sheet's top edge, so it moves with it for free */}
          <View style={s.nearMe} pointerEvents="box-none">
            {snap < 2 ? (
              <Pressable accessibilityRole="button" accessibilityHint={t('map.nearMeHint')} onPress={nearMe} style={({ pressed }) => [s.nearMeBtn, pressed && s.pressed]}>
                <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.ink} aria-hidden />
                <Text style={s.nearMeText}>{t('map.nearMe')}</Text>
              </Pressable>
            ) : null}
          </View>
          <GestureDetector gesture={pan}>
          <View style={s.handleZone}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={snap === 2 ? t('discover.collapse') : t('discover.expand')}
              onPress={() => setSnap(snap === 2 ? 0 : ((snap + 1) as 1 | 2))}
              hitSlop={12}
              style={s.handleBtn}
            >
              <View style={s.handle} />
            </Pressable>
          </View>
          </GestureDetector>
          <View style={s.drawerBody}>{picked ? detail() : list()}</View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function DetailHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={s.detailHead}>
      <Text style={s.detailTitle} accessibilityRole="header">
        {title}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('discover.backToList')} onPress={onClose} hitSlop={10} style={s.iconBtn}>
        <MaterialCommunityIcons name="close" size={24} color={colors.ink} aria-hidden />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  area: { flex: 1 },
  pressed: { opacity: 0.8 },
  top: { position: 'absolute', left: space.m, right: space.m, top: space.s, gap: space.s },
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 56,
  },
  askInput: { flex: 1, fontFamily: fonts.body, fontSize: 17, color: colors.ink, paddingVertical: 12 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  go: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  goOff: { opacity: 0.35 },
  modes: { flexDirection: 'row', gap: 6, backgroundColor: colors.paper, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: colors.line },
  mode: { flex: 1, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 2 },
  modeText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  modeTextOn: { color: colors.white },
  readingNote: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, backgroundColor: colors.paper, borderRadius: 10, padding: space.s, overflow: 'hidden' },
  understood: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1.5, borderColor: colors.gilt, padding: 10, gap: 8 },
  understoodLabel: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.gilt },
  understoodChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  uChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#FBF6EA',
    borderWidth: 1.5,
    borderColor: colors.gilt,
  },
  uChipText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  locNote: { fontFamily: fonts.body, fontSize: 13, color: colors.ink, backgroundColor: colors.paper, borderRadius: 8, padding: 6, overflow: 'hidden' },
  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  handleZone: { alignItems: 'center', paddingTop: 4 },
  handleBtn: { width: 88, height: 28, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line },
  drawerBody: { flex: 1 },
  nearMe: { position: 'absolute', right: space.m, bottom: '100%', marginBottom: space.s },
  nearMeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  nearMeText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  filterRow: { gap: space.s, paddingHorizontal: space.m, paddingBottom: space.s },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.s, paddingHorizontal: space.m, minHeight: 36 },
  count: { flex: 1, fontFamily: fonts.monoBold, fontSize: 12, color: colors.mute, letterSpacing: 0.3 },
  stayCta: { paddingHorizontal: space.m, paddingBottom: space.s, gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    marginHorizontal: space.m,
    marginBottom: space.s,
    padding: space.s,
    paddingRight: space.m,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowPhoto: { width: 60, height: 60, borderRadius: 10 },
  rowIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowName: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  rowMeta: { fontFamily: fonts.body, fontSize: 14, color: colors.mute },
  rowTags: { flexDirection: 'row', alignItems: 'center', gap: space.s, flexWrap: 'wrap' },
  open: { fontFamily: fonts.bodyBold, color: colors.patina },
  badge: {
    fontFamily: fonts.monoBold,
    fontSize: 10.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.gilt,
    borderWidth: 1.5,
    borderColor: colors.gilt,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeBig: { alignSelf: 'flex-start' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowSlim: { flexDirection: 'row', alignItems: 'center', gap: space.s, minHeight: 48, borderBottomWidth: 1, borderColor: colors.line },
  rowNameSlim: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  nightBlock: { paddingHorizontal: space.m, paddingTop: space.m, paddingBottom: space.l },
  sectionTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, marginBottom: space.s },
  expCard: {
    marginHorizontal: space.m,
    marginBottom: space.s,
    padding: space.m,
    gap: 6,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  expNote: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink },
  detail: { paddingHorizontal: space.m, paddingBottom: space.l, gap: space.s },
  detailHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s },
  detailTitle: { flex: 1, fontFamily: fonts.display, fontSize: 30, lineHeight: 32, color: colors.ink },
  detailLine: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.ink },
  actions: { gap: space.s, marginTop: space.s },
  fine: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.mute },
  credit: { fontFamily: fonts.body, fontSize: 12, color: colors.mute, paddingHorizontal: space.m, paddingVertical: space.s },
  hint: { fontFamily: fonts.body, fontSize: 15, color: colors.mute, padding: space.m, textAlign: 'center' },
  error: {
    position: 'absolute',
    left: space.m,
    right: space.m,
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
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderRadius: 10,
    padding: space.s,
    overflow: 'hidden',
  },
});
