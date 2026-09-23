import { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoopMap from '../../src/components/LoopMap';
import type { MapPoint } from '../../src/components/mapHtml';
import { Button, Eyebrow, TopBar } from '../../src/components/ui';
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
import { nearbyTransit } from '../../src/lib/transit';
import { useMyLocation } from '../../src/lib/useMyLocation';
import { FoodDetails } from '../../src/components/FoodDetails';
import { RideToggle } from '../../src/components/RideButtons';
import { t } from '../../src/i18n';
import { colors, fonts, space } from '../../src/theme';

const DAYS = [t('day.0'), t('day.1'), t('day.2'), t('day.3'), t('day.4'), t('day.5'), t('day.6')];

export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = placeById(String(id));
  if (!place) {
    return (
      <SafeAreaView style={s.safe}>
        <TopBar title={t('place.title')} />
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

  const media = PLACE_MEDIA[place.id];
  const about = aboutOf(place.id);
  const week = weekHours(place.id, today);
  const todayIndex = (today.getDay() + 6) % 7;
  const stops = nearbyTransit(place);
  const lens = place.lensId ? lensById(place.lensId) : undefined;
  const here = me.status === 'ok' && me.coords && !me.outsideCity ? me.coords : undefined;

  const points: MapPoint[] = [
    { id: place.id, lat: place.lat, lon: place.lon, color: CATEGORY_COLOR[place.cat], glyph: place.cat, label: place.name, rank: 3 },
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

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TopBar title={place.name} />
      <ScrollView contentContainerStyle={s.scroll}>
        {media?.image ? (
          <View>
            <Image source={media.image} style={s.photo} resizeMode="cover" accessibilityLabel={t('place.photoAlt', { name: place.name })} />
            <Pressable accessibilityRole="link" onPress={() => openLink(media.sourceUrl!)} style={s.col}>
              <Text style={s.credit} numberOfLines={2}>
                {t('ui.photo')}: {media.credit} · {media.license} · Wikimedia Commons
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[s.col, s.head]}>
          <Eyebrow>
            {CATEGORY_LABEL[place.cat]} · {ZONE_LABEL[place.zone]} · {t('place.about', { minutes: place.minutes })}
          </Eyebrow>
          <Text style={s.name} accessibilityRole="header">
            {place.name}
          </Text>
          {place.local ? <Text style={s.local}>{place.local}</Text> : null}
          {place.address ? <Text style={s.local}>{place.address}</Text> : null}
          <Text style={s.blurb}>{place.blurb}</Text>
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

        <View style={[s.col, s.actions]}>
          {/* the phone's own maps app does the walking directions: Apple Maps on an iPhone, Google Maps elsewhere */}
          <Button label={t('walk.here')} onPress={() => openWalkingDirections(place)} style={s.grow} />
        </View>
        <Text style={[s.col, s.small]}>{t('place.directionsNote')}</Text>
        <View style={[s.col, s.actions]}>
          <Button label={t('place.routeHere')} kind="quiet" onPress={walkHere} style={s.grow} />
        </View>
        <View style={[s.col, s.ride]}>
          <RideToggle to={place} />
        </View>
        {lens ? (
          <View style={s.col}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${t('place.pastTitle')}. ${t('place.pastLine')}`}
              onPress={() => router.push(`/lens/${lens.id}`)}
              style={({ pressed }) => [s.past, pressed && { opacity: 0.85 }]}
            >
              {lens.layers[0] ? <Image source={lens.layers[0].image} style={s.pastImage} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
              <View style={{ flex: 1 }}>
                <Text style={s.pastTitle}>{t('place.pastTitle')}</Text>
                <Text style={s.pastLine}>{t('place.pastLine')}</Text>
              </View>
            </Pressable>
          </View>
        ) : null}
        {walk ? (
          <Text style={[s.col, s.walk]} accessibilityLiveRegion="polite">
            {t('walk.result', { minutes: walk.minutes, distance: formatDistance(walk.metres) })}
            {walk.estimate ? t('walk.estimate') : ''}
          </Text>
        ) : null}
        {note ? (
          <Text style={[s.col, s.note]} accessibilityLiveRegion="polite">
            {note}
          </Text>
        ) : null}

        <View style={[s.col, s.mapBox]}>
          <LoopMap
            style={s.map}
            points={points}
            route={walk?.coordinates}
            focus={walk ? null : { lat: place.lat, lon: place.lon, key: 1 }}
            fit={!!walk}
          />
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
          {place.booking ? <Button label={place.booking.label} kind="quiet" onPress={() => openLink(place.booking!.url)} style={s.grow} /> : null}
        </View>
        {place.booking?.affiliate ? <Text style={[s.col, s.note]}>{AFFILIATE_NOTE}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  scroll: { paddingBottom: space.xl },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.m },
  photo: { width: '100%', maxWidth: 560, alignSelf: 'center', height: 220, backgroundColor: colors.line },
  credit: { fontFamily: fonts.body, fontSize: 11, color: colors.mute, marginTop: 4 },
  head: { marginTop: space.m, gap: 4 },
  name: { fontFamily: fonts.bodyBold, fontSize: 26, lineHeight: 31, color: colors.ink },
  local: { fontFamily: fonts.mono, fontSize: 12, color: colors.mute },
  about: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink, marginTop: space.s },
  aboutCredit: { fontFamily: fonts.body, fontSize: 13, color: colors.vistula, textDecorationLine: 'underline', marginTop: 4 },
  blurb: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink, marginTop: space.s },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.m },
  grow: { flexGrow: 1 },
  ride: { marginTop: space.s },
  walk: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, marginTop: space.s },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.mute, marginTop: space.s },
  mapBox: { height: 230, marginTop: space.m },
  map: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  section: { marginTop: space.l },
  h2: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink, marginBottom: space.s },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, paddingHorizontal: space.s, borderRadius: 8 },
  today: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  dayName: { fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  dayHours: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink },
  todayText: { fontFamily: fonts.bodyBold },
  small: { fontFamily: fonts.body, fontSize: 13, color: colors.mute, marginTop: 6 },
  past: { flexDirection: 'row', alignItems: 'center', gap: space.m, marginTop: space.m, padding: space.s, paddingRight: space.m, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  pastImage: { width: 76, height: 76, borderRadius: 10, backgroundColor: colors.line },
  pastTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  pastLine: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.mute, marginTop: 2 },
  tramRow: { paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.line },
  tramName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  tramMeta: { fontFamily: fonts.body, fontSize: 14, color: colors.mute, marginTop: 2 },
  empty: { fontFamily: fonts.body, fontSize: 16, color: colors.ink, padding: space.m },
});
