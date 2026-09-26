import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View, ViewToken } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import Animated, { FadeInDown, FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import LoopMap from '../../src/components/LoopMap';
import type { MapPoint } from '../../src/components/mapHtml';
import { placeName } from '../../src/components/placeName';
import { CITY } from '../../src/config/city';
import { lensPoints } from '../../src/data/lens';
import { aboutOf } from '../../src/data/placeAbout';
import { places } from '../../src/data/places';
import { RESTAURANTS, restaurantHoursOn } from '../../src/data/restaurants';
import { krakowWallClock } from '../../src/lib/cityTime';
import { formatTime, hoursOn, Interval } from '../../src/lib/hours';
import { Moment, MomentSource, pickMoments, standingAt } from '../../src/lib/moments';
import { openWalkingDirections } from '../../src/lib/navigate';
import { openState } from '../../src/lib/openNow';
import { useLiveLocation } from '../../src/lib/useLiveLocation';
import { LANG, t } from '../../src/i18n';
import { colors, fonts, space } from '../../src/theme';

const RYNEK = { lat: CITY.mapCentre.lat, lon: CITY.mapCentre.lon };
const SIGHTS = places.filter((p) => p.zone !== 'out' && p.cat !== 'food' && p.cat !== 'night');
const PICKS = RESTAURANTS.filter((r) => r.pick);
const KIND_COLOR = { sight: colors.brick, lens: colors.gilt, eat: colors.patina } as const;

function openInfo(hours: Interval[] | null, minutes: number): { open: boolean | null; closesIn: number | null; until: string | null } {
  if (!hours) return { open: null, closesIn: null, until: null };
  const st = openState(hours, minutes);
  if (st.state !== 'open') return { open: false, closesIn: null, until: null };
  return { open: true, closesIn: st.closesAt - minutes, until: st.closesAt >= 1440 ? '24:00' : formatTime(st.closesAt) };
}

/** Everything that could be a "now" card, with its opening state at this minute in Kraków. */
function momentSources(): (MomentSource & { until: string | null; cat?: string })[] {
  const now = krakowWallClock(new Date());
  const minutes = now.getHours() * 60 + now.getMinutes();
  const out: (MomentSource & { until: string | null; cat?: string })[] = [];
  for (const p of SIGHTS) {
    const o = openInfo(hoursOn(p.id, now), minutes);
    out.push({ id: p.id, name: placeName(p), kind: 'sight', lat: p.lat, lon: p.lon, rank: p.priority, cat: p.cat, ...o });
  }
  for (const l of lensPoints) out.push({ id: `lens:${l.id}`, name: l.name, kind: 'lens', lat: l.lat, lon: l.lon, rank: 3, open: null, closesIn: null, until: null });
  for (const r of PICKS) {
    const o = openInfo(restaurantHoursOn(r, new Date()), minutes);
    out.push({ id: r.id, name: r.name, kind: 'eat', lat: r.lat, lon: r.lon, rank: 2, ...o });
  }
  return out;
}

export default function NowScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const live = useLiveLocation();
  const origin = live.here ?? RYNEK;

  // recomputed when the traveller moves ~20 m (a new position), not on every render
  const sources = useMemo(() => momentSources(), [live.here]); // eslint-disable-line react-hooks/exhaustive-deps
  const moments = useMemo(() => pickMoments(sources, origin, 8), [sources, origin]);
  const until = useMemo(() => new Map(sources.map((s) => [s.id, s.until])), [sources]);
  // one sentence about the place, in the app language when we have it
  const line = useCallback((id: string) => {
    const a = aboutOf(id);
    const text = a && a.lang === LANG ? a.text : places.find((p) => p.id === id)?.blurb;
    return text ? text.split(/(?<=\.)\s/)[0] : null;
  }, []);

  const [active, setActive] = useState(0);
  const [focus, setFocus] = useState<{ lat: number; lon: number; key: number } | null>(null);
  const current = moments[active] as Moment | undefined;

  // "You are standing at…": the nearest sight within 60 m, once per place per session
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [dismissed, setDismissed] = useState<string | null>(null);
  const standing = useMemo(() => (live.here ? standingAt(SIGHTS, live.here, seen) : null), [live.here, seen]);
  const [announced, setAnnounced] = useState<string | null>(null);
  if (standing && standing.id !== announced && standing.id !== dismissed) {
    setAnnounced(standing.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
  const about = standing ? aboutOf(standing.id) : null;

  const closeStanding = () => {
    if (!standing) return;
    Speech.stop();
    setDismissed(standing.id);
    setSeen((s) => new Set(s).add(standing.id));
  };
  const listen = () => {
    if (!standing) return;
    const text = `${placeName(standing)}. ${about?.lang === LANG ? about.text : standing.blurb}`;
    Speech.stop();
    Speech.speak(text, { language: about?.lang === LANG ? (LANG === 'pl' ? 'pl-PL' : LANG === 'de' ? 'de-DE' : 'en-GB') : 'en-GB', rate: 0.95 });
  };

  const points = useMemo<MapPoint[]>(() => {
    const pts: MapPoint[] = moments.map((m) => ({
      id: m.id,
      lat: m.lat,
      lon: m.lon,
      color: KIND_COLOR[m.kind],
      label: m.name,
      glyph: m.kind === 'lens' ? 'lens' : m.kind === 'eat' ? 'food' : 'history',
      rank: 3,
    }));
    if (live.here) pts.push({ id: '__me', lat: live.here.lat, lon: live.here.lon, color: colors.vistula, kind: 'me' });
    return pts;
  }, [moments, live.here]);

  const cardW = width - 56;
  // made once: FlatList refuses a new onViewableItemsChanged function on a later render
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems.find((v) => v.isViewable);
    if (first?.index == null) return;
    setActive((prev) => {
      if (prev !== first.index) {
        // one tick per card that settles, the same moment the map starts to fly
        Haptics.selectionAsync().catch(() => {});
        const m = first.item as Moment;
        setFocus((f) => ({ lat: m.lat, lon: m.lon, key: (f?.key ?? 0) + 1 }));
      }
      return first.index as number;
    });
  });

  const open = useCallback(
    (m: Moment) => {
      if (m.kind === 'lens') router.push(`/lens/${m.id.slice(5)}`);
      else if (m.kind === 'eat') router.push({ pathname: '/map', params: { mode: 'eat' } });
      else router.push(`/place/${m.id}`);
    },
    [router],
  );

  const now = krakowWallClock(new Date());
  const clock = `${now.toLocaleDateString(LANG === 'pl' ? 'pl-PL' : LANG === 'de' ? 'de-DE' : 'en-GB', { weekday: 'short' })} ${formatTime(now.getHours() * 60 + now.getMinutes())}`;

  return (
    <View style={s.root}>
      <LoopMap style={StyleSheet.absoluteFill} points={points} selectedId={current?.id ?? null} focus={focus} threeD />

      {/* the moment and the place: a small glass label, not a page header */}
      <View style={[s.top, { top: insets.top + space.s }]} pointerEvents="box-none">
        <BlurView intensity={40} tint="light" style={s.pill}>
          <Text style={s.pillBrand}>KRAKÓW · {clock.toUpperCase()}</Text>
          <Text style={s.pillLine}>{live.here ? t('moment.nearYou') : t('moment.nearRynek')}</Text>
        </BlurView>
        {!live.on ? (
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              if (await live.turnOn()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }}
            style={({ pressed }) => [s.liveChip, pressed && s.pressed]}
          >
            <MaterialCommunityIcons name="walk" size={18} color={colors.white} />
            <Text style={s.liveChipText}>{live.problem === 'services' ? t('moment.servicesOff') : t('moment.turnOn')}</Text>
          </Pressable>
        ) : null}
      </View>

      {standing && standing.id !== dismissed ? (
        <Animated.View
          key={standing.id}
          entering={FadeInDown.duration(280).reduceMotion(ReduceMotion.System)}
          exiting={FadeOutUp.duration(200).reduceMotion(ReduceMotion.System)}
          style={[s.standing, { top: insets.top + 92 }]}
          accessibilityLiveRegion="polite"
        >
          <Text style={s.standingEyebrow}>{t('moment.standingAt')}</Text>
          <Text style={s.standingTitle}>{placeName(standing)}</Text>
          <Text style={s.standingText} numberOfLines={3}>
            {about?.lang === LANG ? about.text : standing.blurb}
          </Text>
          <View style={s.row}>
            <Pressable accessibilityRole="button" onPress={listen} style={({ pressed }) => [s.btnDark, pressed && s.pressed]}>
              <MaterialCommunityIcons name="volume-high" size={18} color={colors.white} />
              <Text style={s.btnDarkText}>{t('moment.listen')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push(`/place/${standing.id}`)} style={({ pressed }) => [s.btnLight, pressed && s.pressed]}>
              <Text style={s.btnLightText}>{t('moment.more')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('moment.close')} onPress={closeStanding} hitSlop={10} style={s.close}>
              <MaterialCommunityIcons name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {/* the wish: a round button, the one thing to press on this screen */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('moment.ask')}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push('/wish');
        }}
        style={({ pressed }) => [s.orb, { bottom: 226 }, pressed && s.orbPressed]}
      >
        <MaterialCommunityIcons name="microphone" size={30} color={colors.white} />
      </Pressable>

      {/* above the map's logo and attribution, which must stay visible (Mapbox terms) */}
      <View style={[s.cards, { bottom: 40 }]}>
        <View style={s.cardsLabelPill}>
          <Text style={s.cardsLabel}>{moments.length ? t('moment.title', { n: moments.length }) : t('moment.none')}</Text>
        </View>
        <FlatList
          data={moments}
          keyExtractor={(m) => m.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardW + 12}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: 22, gap: 12 }}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          renderItem={({ item: m }) => {
            const u = until.get(m.id);
            return (
              <Pressable accessibilityRole="button" onPress={() => open(m)} style={({ pressed }) => [s.card, { width: cardW }, pressed && s.pressed]}>
                <View style={s.cardHead}>
                  <View style={[s.kindDot, { backgroundColor: KIND_COLOR[m.kind] }]} />
                  <Text style={s.kind}>{t(`moment.kind.${m.kind}`)}</Text>
                  <Text style={s.walk}>{t('moment.walk', { n: m.walkMinutes })}</Text>
                </View>
                <Text style={s.cardTitle} numberOfLines={2}>
                  {m.name}
                </Text>
                <View style={s.cardFoot}>
                  <Text style={[s.cardMeta, u && s.openText]} numberOfLines={2}>
                    {u ? t('moment.openUntil', { time: u }) : m.kind === 'lens' ? t('moment.lensLine') : m.kind === 'sight' ? line(m.id) ?? t('moment.hoursUnknown') : t('moment.hoursUnknown')}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('moment.go', { name: m.name })}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      openWalkingDirections(m);
                    }}
                    hitSlop={8}
                    style={({ pressed }) => [s.go, pressed && s.pressed]}
                  >
                    <MaterialCommunityIcons name="navigation-variant" size={20} color={colors.white} />
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  pressed: { transform: [{ scale: 0.97 }] },
  top: { position: 'absolute', left: space.m, right: space.m, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.s },
  pill: { borderRadius: 18, overflow: 'hidden', paddingVertical: 10, paddingHorizontal: 14, backgroundColor: 'rgba(246,248,252,0.55)' },
  pillBrand: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 0.8, color: colors.ink },
  pillLine: { fontFamily: fonts.display, fontSize: 24, lineHeight: 26, color: colors.ink, marginTop: 2 },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.vistula },
  liveChipText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  standing: {
    position: 'absolute',
    left: space.m,
    right: space.m,
    padding: space.m,
    gap: 6,
    borderRadius: 22,
    backgroundColor: colors.paper,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  standingEyebrow: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 0.8, color: colors.gilt, textTransform: 'uppercase' },
  standingTitle: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30, color: colors.ink },
  standingText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginTop: 4 },
  btnDark: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.ink },
  btnDarkText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
  btnLight: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, borderColor: colors.ink, justifyContent: 'center' },
  btnLightText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  close: { marginLeft: 'auto', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  orb: {
    position: 'absolute',
    right: space.m + 6,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.brick,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  orbPressed: { transform: [{ scale: 0.94 }] },
  cards: { position: 'absolute', left: 0, right: 0 },
  cardsLabelPill: { alignSelf: 'flex-start', marginLeft: 22, marginBottom: 8, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(28,37,80,0.82)' },
  cardsLabel: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 0.8, color: colors.white, textTransform: 'uppercase' },
  card: {
    height: 150,
    borderRadius: 24,
    padding: space.m,
    backgroundColor: colors.paper,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kindDot: { width: 10, height: 10, borderRadius: 5 },
  kind: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 0.6, color: colors.mute, textTransform: 'uppercase' },
  walk: { marginLeft: 'auto', fontFamily: fonts.monoBold, fontSize: 12, color: colors.ink },
  cardTitle: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30, color: colors.ink },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  cardMeta: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.mute },
  openText: { fontFamily: fonts.bodyBold, color: colors.patina },
  go: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
