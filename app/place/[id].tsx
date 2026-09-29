import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import LoopMap from '../../src/components/LoopMap';
import type { MapPoint } from '../../src/components/mapHtml';
import { Button, card, ScreenHeader } from '../../src/components/ui';
import { bookingLabel, placeAltName, placeName, placeText } from '../../src/components/placeName';
import { AFFILIATE_NOTE } from '../../src/config/affiliates';
import { CATEGORY_COLOR } from '../../src/data/categoryColor';
import { aboutOf } from '../../src/data/placeAbout';
import { PLACE_MEDIA } from '../../src/data/placeMedia';
import { CATEGORY_LABEL, Place, ZONE_LABEL, placeById } from '../../src/data/places';
import { walkingRoute } from '../../src/lib/directions';
import { DETOUR, distance, formatDistance, walkingMinutes } from '../../src/lib/geo';
import { formatHours, weekHours } from '../../src/lib/hours';
import { openLink } from '../../src/lib/openLink';
import { lensById } from '../../src/data/lens';
import { openWalkingDirections } from '../../src/lib/navigate';
import { toggleSaved, useSaved } from '../../src/lib/saved';
import { nearbyTransit } from '../../src/lib/transit';
import { useMyLocation } from '../../src/lib/useMyLocation';
import { useStatusBarOnFocus } from '../../src/lib/useStatusBarOnFocus';
import { FoodDetails } from '../../src/components/FoodDetails';
import { ReconBadge } from '../../src/components/ReconBadge';
import { RideToggle } from '../../src/components/RideButtons';
import { LANG, t } from '../../src/i18n';
import { colors, fonts, space, typeScale } from '../../src/theme';

const DAYS = [t('day.0'), t('day.1'), t('day.2'), t('day.3'), t('day.4'), t('day.5'), t('day.6')];

export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = placeById(String(id));
  if (!place) {
    return (
      <SafeAreaView style={s.safe}>
        <ScreenHeader title={t('place.title')} />
        <Text style={s.empty}>{t('place.unknown')}</Text>
      </SafeAreaView>
    );
  }
  return <PlaceDetails key={place.id} place={place} />;
}

interface Walk {
  coordinates: [number, number][];
  minutes: number;
  metres: number;
  estimate: boolean;
}

function PlaceDetails({ place }: { place: Place }) {
  const router = useRouter();
  const me = useMyLocation();
  const [today] = useState(() => new Date());
  const [walk, setWalk] = useState<Walk | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /** where the shown route starts: set with the route, so the marker and the line always agree */
  const [walkFrom, setWalkFrom] = useState<{ lat: number; lon: number } | null>(null);
  const request = useRef(0);
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const heroH = Math.round(screenH * 0.58);
  useStatusBarOnFocus('light');
  const isSaved = useSaved().includes(place.id);
  useEffect(() => () => void Speech.stop(), []);

  // the photo drifts slower than the page and grows when pulled down: the page feels held by a finger
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.set(e.contentOffset.y);
  });
  const heroStyle = useAnimatedStyle(() => {
    const v = y.get();
    return {
      transform: [
        { translateY: v < 0 ? v : v * 0.45 },
        { scale: interpolate(v, [-200, 0], [1.35, 1], Extrapolation.CLAMP) },
      ],
    };
  });
  // once the photo is gone, a paper bar with the name takes over the top
  const barStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.get(), [heroH - 160, heroH - 90], [0, 1], Extrapolation.CLAMP) }));

  const media = PLACE_MEDIA[place.id];
  const name = placeName(place);
  const altName = placeAltName(place);
  // English readers get the app's blurb and the English Wikipedia lead; others one text in their
  // language when Wikipedia has it, else the English blurb with its language marked
  const about = LANG === 'en' ? aboutOf(place.id) : null;
  const text = placeText(place);
  const week = weekHours(place.id, today);
  const todayIndex = (today.getDay() + 6) % 7;
  const stops = nearbyTransit(place);
  const lens = place.lensId ? lensById(place.lensId) : undefined;
  const here = me.status === 'ok' && me.coords && !me.outsideCity ? me.coords : undefined;

  const points: MapPoint[] = [
    { id: place.id, lat: place.lat, lon: place.lon, color: CATEGORY_COLOR[place.cat], glyph: place.cat, label: name, rank: 3 },
  ];
  // with a route, the marker is its start (a slower, older location answer can't move it)
  const marker = walkFrom ?? here;
  if (marker) points.push({ id: '__me', lat: marker.lat, lon: marker.lon, color: colors.vistula, kind: 'me' });

  const walkHere = async () => {
    const mine = ++request.current;
    // a new attempt replaces the old route: a failed attempt must not leave it on screen
    setWalk(null);
    setWalkFrom(null);
    setNote(t('walk.findingYou'));
    const loc = await me.locate();
    if (mine !== request.current) return;
    if (loc.status !== 'ok' || !loc.coords) {
      setNote(loc.message ?? t('walk.needLocation'));
      return;
    }
    if (loc.outsideCity) {
      setNote(t('walk.outside'));
      return;
    }
    const from = loc.coords;
    setNote(t('walk.findingWay'));
    const real = await walkingRoute([from, place]);
    if (mine !== request.current) return;
    const straight = distance(from, place) * DETOUR;
    setWalk(
      real
        ? { coordinates: real.coordinates, minutes: real.legMinutes[0], metres: real.distanceMetres ?? straight, estimate: false }
        : { coordinates: [[from.lon, from.lat], [place.lon, place.lat]], minutes: walkingMinutes(from, place), metres: straight, estimate: true },
    );
    setWalkFrom(from);
    setNote(null);
  };

  const listen = () => {
    Haptics.selectionAsync().catch(() => {});
    Speech.stop();
    Speech.speak(`${name}. ${text.text}`, { language: text.lang === 'pl' ? 'pl-PL' : text.lang === 'de' ? 'de-DE' : 'en-GB', rate: 0.95 });
  };
  const barH = 58 + space.s * 2 + insets.bottom;

  return (
    <View style={s.root}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: barH + space.l }} style={s.root}>
        {/* the place itself, filling the top of the screen, with its name on it */}
        <View style={{ height: heroH, overflow: 'visible' }}>
          <Animated.View style={[StyleSheet.absoluteFill, heroStyle]}>
            {media?.image ? (
              <View style={s.fill} pointerEvents="none"><Image source={media.image} style={s.photo} resizeMode="cover" accessibilityLabel={t('place.photoAlt', { name })} /></View>
            ) : (
              <View style={[s.fill, { backgroundColor: CATEGORY_COLOR[place.cat] }]} />
            )}
          </Animated.View>
          <LinearGradient colors={['rgba(8,11,30,0.55)', 'rgba(8,11,30,0)']} style={s.heroTop} pointerEvents="none" />
          <LinearGradient colors={['rgba(8,11,30,0)', 'rgba(8,11,30,0.9)']} locations={[0.35, 1]} style={s.heroBottom} pointerEvents="none" />
          <View style={s.heroWords}>
            <Text style={s.eyebrow} numberOfLines={1}>
              {CATEGORY_LABEL[place.cat]} · {ZONE_LABEL[place.zone]} · {t('place.about', { minutes: place.minutes })}
            </Text>
            <Text style={s.title} accessibilityRole="header" numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.7}>
              {name}
            </Text>
            {altName ? <Text style={s.heroLocal}>{altName}</Text> : null}
          </View>
        </View>
        <View style={s.body}>
        {media?.image ? (
          <Pressable accessibilityRole="link" onPress={() => openLink(media.sourceUrl!)} style={s.col}>
            <Text style={s.credit} numberOfLines={2}>
              {t('ui.photo')}: {media.credit} · {media.license} · Wikimedia Commons
            </Text>
          </Pressable>
        ) : null}

        <View style={[s.col, s.head]}>
          {place.address ? <Text style={s.local}>{place.address}</Text> : null}
          <Text style={s.blurb}>{text.text}</Text>
          {text.lang !== LANG ? <Text style={s.langTag}>{t('ui.inEnglish')}</Text> : null}
          {text.url ? (
            <Pressable accessibilityRole="link" onPress={() => openLink(text.url!)} hitSlop={6}>
              <Text style={s.aboutCredit}>{t('place.aboutCredit')}</Text>
            </Pressable>
          ) : null}
          {about ? (
            <>
              <Text style={s.about}>{about.text}</Text>
              <Pressable accessibilityRole="link" onPress={() => openLink(about.url)} hitSlop={6}>
                <Text style={s.aboutCredit}>{t('place.aboutCredit')}</Text>
              </Pressable>
            </>
          ) : null}
          {/* cuisine and diet from OpenStreetMap, and a live Google rating once the proxy is set up */}
          {place.cat === 'food' || place.cat === 'night' ? <FoodDetails placeId={place.id} /> : null}
        </View>

        {lens ? (
          <View style={s.col}>
            {/* the same place in the past, as a picture to step into */}
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${t('place.pastTitle')}. ${t('place.pastLine')}`}
              onPress={() => router.push(`/lens/${lens.id}`)}
              style={({ pressed }) => [s.past, pressed && s.pressed]}
            >
              {lens.layers[0] ? <View style={s.fill} pointerEvents="none"><Image source={lens.layers[0].image} style={s.photo} resizeMode="cover" accessibilityIgnoresInvertColors /></View> : null}
              <LinearGradient colors={['rgba(8,11,30,0.05)', 'rgba(8,11,30,0.85)']} style={s.fill} pointerEvents="none" />
              <ReconBadge show={lens.layers[0]?.reconstruction} />
              {lens.layers[0]?.year ? <Text style={s.pastYear}>{lens.layers[0].year}</Text> : null}
              <Text style={s.pastTitle}>{t('place.pastTitle')}</Text>
              <Text style={s.pastLine}>{t('place.pastLine')}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* the way there: a picture of the map (a finger on it scrolls the page), then the route on request */}
        <View style={[s.col, s.section]}>
          <View style={s.mapBox} pointerEvents="none">
            <LoopMap style={s.map} points={points} route={walk?.coordinates} focus={walk ? null : { lat: place.lat, lon: place.lon, key: 1 }} fit={!!walk} />
          </View>
          {walk ? (
            <Text style={s.walk} accessibilityLiveRegion="polite">
              {t('walk.result', { minutes: walk.minutes, distance: formatDistance(walk.metres) })}
              {walk.estimate ? t('walk.estimate') : ''}
            </Text>
          ) : null}
          {note ? (
            <Text style={s.note} accessibilityLiveRegion="polite">
              {note}
            </Text>
          ) : null}
          <View style={s.actions}>
            <Button label={t('place.routeHere')} kind="quiet" onPress={walkHere} style={s.grow} />
          </View>
          <View style={s.ride}>
            <RideToggle to={place} />
          </View>
        </View>

        <View style={[s.col, s.section]}>
          <Text style={s.h2} accessibilityRole="header">
            {t('place.hours')}
          </Text>
          {week ? (
            <>
              {week.map((intervals, i) => (
                // one named group per day, so a screen reader reads the day with its hours
                <View
                  key={DAYS[i]}
                  role="group"
                  aria-label={`${DAYS[i]}${i === todayIndex ? `, ${t('place.today')}` : ''}: ${formatHours(intervals)}`}
                  style={[s.dayRow, i === todayIndex && s.today]}
                >
                  <Text style={[s.dayName, i === todayIndex && s.todayText]}>
                    {DAYS[i]}
                    {i === todayIndex ? ` · ${t('place.today')}` : ''}
                  </Text>
                  <Text style={[s.dayHours, i === todayIndex && s.todayText]}>{formatHours(intervals)}</Text>
                </View>
              ))}
              <Text style={s.note}>{t('place.hoursNote')}</Text>
            </>
          ) : (
            <Text style={s.note}>{t('place.noHours')}</Text>
          )}
        </View>

        <View style={[s.col, s.section]}>
          <Text style={s.h2} accessibilityRole="header">
            {t('place.transit')}
          </Text>
          {stops.length ? (
            stops.map((stop) => (
              <View key={stop.name} style={s.tramRow}>
                <Text style={s.tramName}>
                  {stop.name} · {formatDistance(stop.metres)}
                </Text>
                {stop.trams.length ? <Text style={s.tramMeta}>{t('place.tramLines', { lines: stop.trams.join(', ') })}</Text> : null}
                {stop.buses.length ? <Text style={s.tramMeta}>{t('place.busLines', { lines: stop.buses.join(', ') })}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={s.note}>{t('place.noTransit')}</Text>
          )}
        </View>

        <View style={[s.col, s.section, s.actions]}>
          {media?.website ? <Button label={t('place.website')} kind="quiet" onPress={() => openLink(media.website!)} style={s.grow} /> : null}
          {place.booking ? <Button label={bookingLabel(place.booking)} kind="quiet" onPress={() => openLink(place.booking!.url)} style={s.grow} /> : null}
        </View>
        {place.booking?.affiliate ? <Text style={[s.col, s.note]}>{AFFILIATE_NOTE}</Text> : null}
        </View>
      </Animated.ScrollView>

      {/* after the photo scrolls away: the name stays on a paper bar */}
      <Animated.View style={[s.topBar, { paddingTop: insets.top, height: insets.top + 56 }, barStyle]} pointerEvents="none">
        <Text style={s.topBarText} numberOfLines={1}>
          {name}
        </Text>
      </Animated.View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('ui.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={8}
        style={({ pressed }) => [s.back, { top: insets.top + 6 }, pressed && s.pressed]}
      >
        <MaterialCommunityIcons name="chevron-left" size={30} color={colors.white} />
      </Pressable>

      {/* the two things a traveller does here, always under the thumb */}
      <View style={[s.bar, { paddingBottom: insets.bottom + space.s }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('moment.go', { name })}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            openWalkingDirections(place);
          }}
          style={({ pressed }) => [s.go, pressed && s.pressed]}
        >
          <MaterialCommunityIcons name="navigation-variant" size={22} color={colors.white} />
          <Text style={s.goText}>{t('story.go')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(isSaved ? 'saved.remove' : 'saved.add', { name })}
          accessibilityState={{ selected: isSaved }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            toggleSaved(place.id);
          }}
          style={({ pressed }) => [s.listen, isSaved && s.savedOn, pressed && s.pressed]}
        >
          <MaterialCommunityIcons name={isSaved ? 'heart' : 'heart-outline'} size={24} color={isSaved ? colors.white : colors.ink} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('moment.listen')} onPress={listen} style={({ pressed }) => [s.listen, pressed && s.pressed]}>
          <MaterialCommunityIcons name="volume-high" size={24} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  root: { flex: 1, backgroundColor: colors.stone },
  body: { backgroundColor: colors.stone, paddingBottom: space.s },
  // a frame pinned to all four edges (on iOS a 100% size leaves out the card's padding), and the
  // photo 100% of that frame: an Image left to the edges alone takes the file's own size
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  photo: { width: '100%', height: '100%' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
  heroTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 160 },
  heroBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
  heroWords: { position: 'absolute', left: space.l, right: space.l, bottom: space.l, gap: 8 },
  eyebrow: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 1, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' },
  title: { fontFamily: fonts.display, fontSize: 46, lineHeight: 48, color: colors.white },
  heroLocal: { fontFamily: fonts.body, fontSize: 16, color: 'rgba(255,255,255,0.85)' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.paper, borderBottomWidth: 1, borderColor: colors.line, justifyContent: 'center', paddingLeft: 76, paddingRight: space.m },
  topBarText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  back: { position: 'absolute', left: space.m, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,19,48,0.55)' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: space.s, paddingHorizontal: space.m, paddingTop: space.s, backgroundColor: colors.paper, borderTopWidth: 1, borderColor: colors.line },
  go: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 58, borderRadius: 29, backgroundColor: colors.ink },
  goText: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.white },
  listen: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.ink },
  savedOn: { backgroundColor: colors.brick, borderColor: colors.brick },
  pastYear: { fontFamily: fonts.display, fontSize: 40, color: colors.white },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.m },
  credit: { fontFamily: fonts.body, fontSize: 13, color: colors.mute, marginTop: 4 },
  head: { marginTop: space.m, gap: space.xs },
  local: { ...typeScale.meta, color: colors.mute },
  langTag: { ...typeScale.meta, color: colors.mute, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 6, marginTop: space.xs },
  about: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink, marginTop: space.s },
  aboutCredit: { fontFamily: fonts.body, fontSize: 15, color: colors.vistula, textDecorationLine: 'underline', marginTop: 4 },
  blurb: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink, marginTop: space.s },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.m },
  grow: { flexGrow: 1 },
  ride: { marginTop: space.s },
  walk: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, marginTop: space.s },
  note: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.mute, marginTop: space.s },
  mapBox: { height: 220, borderRadius: 24, overflow: 'hidden' },
  map: { flex: 1 },
  section: { marginTop: space.l },
  h2: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink, marginBottom: space.s },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: space.s, borderRadius: 8 },
  today: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  dayName: { fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  dayHours: { fontFamily: fonts.mono, fontSize: 14, color: colors.ink },
  todayText: { fontFamily: fonts.bodyBold },
  small: { fontFamily: fonts.body, fontSize: 15, color: colors.mute, marginTop: 6 },
  past: { ...card, height: 220, marginTop: space.l, padding: space.m, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.ink },
  pastTitle: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.white },
  pastLine: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  tramRow: { paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.line },
  tramName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  tramMeta: { fontFamily: fonts.body, fontSize: 15, color: colors.mute, marginTop: 2 },
  empty: { fontFamily: fonts.body, fontSize: 16, color: colors.ink, padding: space.m },
});
