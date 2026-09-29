import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, ImageSourcePropType, Pressable, StyleSheet, Text, View, ViewToken } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStatusBarOnFocus } from '../../src/lib/useStatusBarOnFocus';
import { useTabBarSpace, useTopSpace } from '../../src/lib/useTabBarSpace';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { placeName, placeText } from '../../src/components/placeName';
import { CITY } from '../../src/config/city';
import { PLACE_MEDIA } from '../../src/data/placeMedia';
import { CATEGORY_LABEL, places, Place } from '../../src/data/places';
import { RESTAURANTS, restaurantHoursOn } from '../../src/data/restaurants';
import { krakowWallClock } from '../../src/lib/cityTime';
import { distance, LatLon } from '../../src/lib/geo';
import { formatTime, hoursOn, Interval } from '../../src/lib/hours';
import { Moment, MomentSource, pickMoments, standingAt, walkMinutes } from '../../src/lib/moments';
import { openWalkingDirections } from '../../src/lib/navigate';
import { openState } from '../../src/lib/openNow';
import { useLiveLocation } from '../../src/lib/useLiveLocation';
import { daysFor, eventTime, pickEvents, useCityEvents } from '../../src/lib/events';
import { EVENT_COLOR, EVENT_ICON } from '../../src/components/EventsSection';
import { openLink } from '../../src/lib/openLink';
import { LANG, t } from '../../src/i18n';
import type { StringKey } from '../../src/i18n/en';
import { colors, fonts, space } from '../../src/theme';
import { WELCOME_KEY } from '../welcome';

const RYNEK = { lat: CITY.mapCentre.lat, lon: CITY.mapCentre.lon };
let welcomeChecked = false;

/** Sights with a photo of their own: a story needs a picture to stand on. */
const SIGHTS = places.filter((p) => p.zone !== 'out' && p.cat !== 'food' && p.cat !== 'night' && PLACE_MEDIA[p.id]?.image);
const PICKS = RESTAURANTS.filter((r) => r.pick);

interface Story extends Moment {
  image?: ImageSourcePropType;
  eyebrow: string;
  line: string;
  /** an event's tickets */
  url?: string;
  /** without a photo: the colour and the sign of what it is (a fork for food, a ball for a match) */
  tint?: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  /** "standing at": the place the traveller is at right now */
  here?: boolean;
  place?: Place;
  year?: string;
}

function openInfo(hours: Interval[] | null, minutes: number): { open: boolean | null; closesIn: number | null; until: string | null } {
  if (!hours) return { open: null, closesIn: null, until: null };
  const st = openState(hours, minutes);
  if (st.state !== 'open') return { open: false, closesIn: null, until: null };
  return { open: true, closesIn: st.closesAt - minutes, until: st.closesAt >= 1440 ? '24:00' : formatTime(st.closesAt) };
}

const firstSentence = (text: string) => text.split(/(?<=\.)\s/)[0];

/** Everything that could be a story now, each with its picture and the one line that says why now. */
function storySources(): (MomentSource & { image?: ImageSourcePropType; line: string; place?: Place; year?: string; cat?: string })[] {
  const now = krakowWallClock(new Date());
  const minutes = now.getHours() * 60 + now.getMinutes();
  const out: (MomentSource & { image?: ImageSourcePropType; line: string; place?: Place; year?: string; cat?: string })[] = [];
  for (const p of SIGHTS) {
    const o = openInfo(hoursOn(p.id, now), minutes);
    out.push({
      id: p.id,
      name: placeName(p),
      kind: 'sight',
      lat: p.lat,
      lon: p.lon,
      rank: p.priority,
      image: PLACE_MEDIA[p.id]?.image,
      line: o.until ? t('story.openUntil', { time: o.until }) : firstSentence(placeText(p).text),
      place: p,
      cat: CATEGORY_LABEL[p.cat],
      ...o,
    });
  }
  // no Time Lens here: the past has its own tab, and the same old photos in two places read as a copy
  for (const r of PICKS) {
    const o = openInfo(restaurantHoursOn(r, new Date()), minutes);
    out.push({ id: r.id, name: r.name, kind: 'eat', lat: r.lat, lon: r.lon, rank: 2, line: o.until ? t('story.openUntil', { time: o.until }) : t('story.eatLine'), ...o });
  }
  return out;
}

// a failure on this screen shows its message instead of an empty screen
export { ScreenError as ErrorBoundary } from '../../src/components/ScreenError';

export default function TodayScreen() {
  const router = useRouter();
  useStatusBarOnFocus('light');
  const tabSpace = useTabBarSpace();
  const topSpace = useTopSpace();
  const live = useLiveLocation();
  const { events: cityEvents } = useCityEvents();
  // The order of the stories must not change under the finger: GPS ticks every ~20 m, so the stories
  // are sorted from an anchor that only moves after a real walk (the walking times stay close enough).
  const [anchor, setAnchor] = useState<LatLon>(RYNEK);
  const target = live.here ?? RYNEK;
  if (target !== anchor && distance(anchor, target) > 150) setAnchor(target);
  const [height, setHeight] = useState(0);
  const list = useRef<FlatList<Story>>(null);

  useEffect(() => {
    // once per launch: effects can run twice (development, a remount), the welcome must not stack
    if (welcomeChecked) return;
    welcomeChecked = true;
    AsyncStorage.getItem(WELCOME_KEY)
      .then((seen) => {
        if (!seen) router.push('/welcome');
      })
      .catch(() => {});
  }, [router]);

  // opening hours move with the clock: a new minute refreshes the stories too
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60000));
  useEffect(() => {
    const id = setInterval(() => setMinute(Math.floor(Date.now() / 60000)), 30000);
    return () => clearInterval(id);
  }, []);
  // the clock on top follows every minute; the stories themselves are rebuilt every 10 minutes
  const tenMinutes = Math.floor(minute / 10);
  const sources = useMemo(() => storySources(), [tenMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

  // the place the traveller stands at goes first, as its own story
  const [seen] = useState<Set<string>>(() => new Set());
  const standing = useMemo(() => (live.here ? standingAt(SIGHTS, live.here, seen) : null), [live.here, seen]);

  const stories = useMemo<Story[]>(() => {
    const near = pickMoments(sources, anchor, 12, 2000);
    const far = near.length < 3;
    const picked = far ? pickMoments(sources, RYNEK, 12, 2000) : near;
    const byId = new Map(sources.map((s) => [s.id, s]));
    const out: Story[] = picked.map((m) => {
      const src = byId.get(m.id)!;
      const kind = t(`story.kind.${m.kind}` as StringKey);
      return { ...m, image: src.image, line: src.line, place: src.place, year: src.year, eyebrow: far ? `${src.cat ?? kind} · ${t('story.inCentre')}` : `${src.cat ?? kind} · ${t('story.walk', { n: m.walkMinutes })}` };
    });
    // tonight's concert or match: up to two of today's events still to come, after the first story
    const tonight = pickEvents(cityEvents, daysFor('today'), [], 'time', anchor).slice(0, 2).map<Story>((e) => {
      const metres = distance(anchor, e);
      return {
        id: `event:${e.id}`,
        name: e.title,
        kind: 'event',
        lat: e.lat,
        lon: e.lon,
        open: null,
        metres,
        walkMinutes: walkMinutes(metres),
        image: e.image ? { uri: e.image } : undefined,
        line: [eventTime(e) ?? t('events.allDay'), e.venue].filter(Boolean).join(' · '),
        eyebrow: `${t(`events.cat.${e.category}` as StringKey)} · ${t('events.when.today')}`,
        url: e.url,
        tint: EVENT_COLOR[e.category],
        icon: EVENT_ICON[e.category],
      };
    });
    out.splice(Math.min(1, out.length), 0, ...tonight);
    if (standing) {
      const rest = out.filter((s) => s.id !== standing.id);
      const src = byId.get(standing.id);
      rest.unshift({
        ...(src as MomentSource),
        metres: 0,
        walkMinutes: 0,
        image: PLACE_MEDIA[standing.id]?.image,
        line: firstSentence(placeText(standing).text),
        place: standing,
        here: true,
        eyebrow: t('story.standingAt'),
      });
      return rest;
    }
    return out;
  }, [sources, anchor, standing, cityEvents]);

  // arriving somewhere: back to the top, where that place now is, with one nudge
  const standingId = standing?.id ?? null;
  useEffect(() => {
    if (!standingId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    list.current?.scrollToOffset({ offset: 0, animated: true });
  }, [standingId]);

  const [page, setPage] = useState(0);
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const i = viewableItems[0]?.index;
    if (i == null) return;
    setPage((prev) => {
      if (prev !== i) {
        Haptics.selectionAsync().catch(() => {});
        Speech.stop();
      }
      return i;
    });
  });

  const listen = useCallback((s: Story) => {
    const text = s.place ? `${placeName(s.place)}. ${placeText(s.place).text}` : s.name;
    const lang = s.place ? placeText(s.place).lang : LANG;
    Speech.stop();
    Speech.speak(text, { language: lang === 'pl' ? 'pl-PL' : lang === 'de' ? 'de-DE' : 'en-GB', rate: 0.95 });
  }, []);

  const open = useCallback(
    (s: Story) => {
      if (s.kind === 'event' && s.url) openLink(s.url);
      else if (s.kind === 'lens') router.push(`/lens/${s.id.slice(5)}`);
      else if (s.kind === 'eat') router.push({ pathname: '/map', params: { mode: 'eat' } });
      else router.push(`/place/${s.id}`);
    },
    [router],
  );

  // the stories are the centre's when the traveller is too far from anything: say so, and how far
  const awayKm = live.here && pickMoments(sources, anchor, 12, 2000).length < 3 ? Math.round(distance(live.here, RYNEK) / 100) / 10 : null;
  const now = krakowWallClock(new Date());
  const clock = formatTime(now.getHours() * 60 + now.getMinutes());

  return (
    // collapsable={false}: the native tabs reach the list through it (tap the active tab to go back up)
    <View style={s.root} collapsable={false} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 ? (
        <FlatList
          ref={list}
          data={stories}
          keyExtractor={(x) => x.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          getItemLayout={(_d, i) => ({ length: height, offset: height * i, index: i })}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}

          renderItem={({ item }) => <StoryPage st={item} height={height} top={topSpace} bottom={110 + tabSpace} onListen={listen} onOpen={open} />}
        />
      ) : null}

      {/* over every story: the time, how far down the stories are, and the way to the map */}
      <View style={[s.head, { top: topSpace + space.s }]} pointerEvents="box-none">
        <View>
          <Text style={s.brand}>KRAKÓW · {clock}</Text>
          <Text style={s.where}>{!live.here ? t('moment.nearRynek') : awayKm ? t('moment.awayFromCentre', { km: awayKm }) : t('moment.nearYou')}</Text>
        </View>
        <View style={s.headRight}>
          {!live.on ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={live.problem === 'services' ? t('moment.servicesOff') : t('moment.turnOn')}
              onPress={async () => {
                if (await live.turnOn()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }}
              style={({ pressed }) => [s.headBtn, pressed && s.pressed]}
            >
              <MaterialCommunityIcons name="crosshairs-gps" size={22} color={colors.white} />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={t('story.openMap')} onPress={() => router.navigate('/map')} style={({ pressed }) => [s.headBtn, pressed && s.pressed]}>
            <MaterialCommunityIcons name="map-outline" size={22} color={colors.white} />
          </Pressable>
        </View>
      </View>
      <View style={[s.progress, { top: topSpace + space.s + 58 }]} pointerEvents="none">
        <Text style={s.count}>
          {stories.length ? `${Math.min(page + 1, stories.length)} / ${stories.length}` : ''}
        </Text>
      </View>

      {/* the wish, always one tap away */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('moment.ask')}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push('/wish');
        }}
        style={({ pressed }) => [s.ask, { bottom: 24 + tabSpace }, pressed && s.pressed]}
      >
        <MaterialCommunityIcons name="microphone" size={22} color={colors.white} />
        <Text style={s.askText}>{t('moment.ask')}</Text>
      </Pressable>
    </View>
  );
}

/** One story, full screen. Memoised: a new minute on the clock must not redraw every photo. */
const StoryPage = memo(function StoryPage({
  st,
  height,
  top,
  bottom,
  onListen,
  onOpen,
}: {
  st: Story;
  height: number;
  top: number;
  bottom: number;
  onListen: (s: Story) => void;
  onOpen: (s: Story) => void;
}) {
  return (
    <View style={{ height }}>
      {st.image ? (
        <Image source={st.image} style={s.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={[StyleSheet.absoluteFill, s.eatBg, st.tint ? { backgroundColor: st.tint } : null]}>
          <MaterialCommunityIcons name={st.icon ?? 'silverware-fork-knife'} size={220} color="rgba(255,255,255,0.08)" style={s.eatIcon} />
        </View>
      )}
      {/* darker at the top for the clock and at the bottom for the words: the photo stays in the middle */}
      <LinearGradient colors={['rgba(8,11,30,0.6)', 'rgba(8,11,30,0)']} style={s.shadeTop} pointerEvents="none" />
      <LinearGradient colors={['rgba(8,11,30,0)', 'rgba(8,11,30,0.55)', 'rgba(8,11,30,0.92)']} locations={[0, 0.35, 1]} style={s.shadeBottom} pointerEvents="none" />
      {st.kind === 'lens' && st.year ? <Text style={[s.year, { top: top + 70 }]}>{st.year}</Text> : null}

      <View style={[s.words, { paddingBottom: bottom }]}>
        <Text style={[s.eyebrow, st.here && s.eyebrowHere]} numberOfLines={1}>
          {st.eyebrow}
        </Text>
        <Text style={s.title} accessibilityRole="header" numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.7}>
          {st.name}
        </Text>
        <Text style={s.line} numberOfLines={3}>
          {st.line}
        </Text>
        <View style={s.actions}>
          {st.kind !== 'lens' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('moment.go', { name: st.name })}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                openWalkingDirections(st);
              }}
              style={({ pressed }) => [s.primary, pressed && s.pressed]}
            >
              <MaterialCommunityIcons name="navigation-variant" size={20} color={colors.ink} />
              <Text style={s.primaryText}>{t('story.go')}</Text>
            </Pressable>
          ) : null}
          {st.place ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('moment.listen')} onPress={() => onListen(st)} style={({ pressed }) => [s.round, pressed && s.pressed]}>
              <MaterialCommunityIcons name="volume-high" size={22} color={colors.white} />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => onOpen(st)} style={({ pressed }) => [s.ghost, pressed && s.pressed]}>
            <Text style={s.ghostText} numberOfLines={1}>
              {st.kind === 'lens' ? t('story.seeThen') : st.kind === 'event' ? t('events.tickets') : t('moment.more')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E1330' },
  pressed: { transform: [{ scale: 0.97 }] },
  photo: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  eatBg: { backgroundColor: colors.brick, alignItems: 'center', justifyContent: 'center' },
  eatIcon: { transform: [{ rotate: '-12deg' }] },
  shadeTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 200 },
  shadeBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '65%' },
  year: { position: 'absolute', right: space.l, fontFamily: fonts.display, fontSize: 64, color: 'rgba(255,255,255,0.9)' },
  words: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.l, gap: 10 },
  eyebrow: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 1, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' },
  eyebrowHere: { color: '#F2C66D' },
  title: { fontFamily: fonts.display, fontSize: 50, lineHeight: 52, color: colors.white },
  line: { fontFamily: fonts.body, fontSize: 18, lineHeight: 26, color: 'rgba(255,255,255,0.92)' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginTop: space.s },
  primary: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingHorizontal: 22, borderRadius: 26, backgroundColor: colors.white },
  primaryText: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  round: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  ghost: { minHeight: 52, paddingHorizontal: 18, borderRadius: 26, justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)' },
  ghostText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
  head: { position: 'absolute', left: space.l, right: space.m, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 1, color: colors.white },
  where: { fontFamily: fonts.display, fontSize: 26, color: colors.white, marginTop: 2 },
  headRight: { flexDirection: 'row', gap: space.s },
  headBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  progress: { position: 'absolute', left: space.l },
  count: { fontFamily: fonts.monoBold, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  ask: {
    position: 'absolute',
    left: space.l,
    right: space.l,
    bottom: 24,
    minHeight: 58,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.brick,
  },
  askText: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.white },
});
