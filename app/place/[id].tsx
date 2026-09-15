import { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoopMap from '../../src/components/LoopMap';
import type { MapPoint } from '../../src/components/mapHtml';
import { Button, Eyebrow, TopBar } from '../../src/components/ui';
import { AFFILIATE_NOTE } from '../../src/config/affiliates';
import { CATEGORY_COLOR } from '../../src/data/categoryColor';
import { PLACE_MEDIA } from '../../src/data/placeMedia';
import { CATEGORY_LABEL, Place, ZONE_LABEL, placeById } from '../../src/data/places';
import { walkingRoute } from '../../src/lib/directions';
import { DETOUR, distance, formatDistance, walkingMinutes } from '../../src/lib/geo';
import { formatHours, weekHours } from '../../src/lib/hours';
import { openLink } from '../../src/lib/openLink';
import { nearbyTramStops } from '../../src/lib/transit';
import { useMyLocation } from '../../src/lib/useMyLocation';
import { colors, fonts, space } from '../../src/theme';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const place = placeById(String(id));
  if (!place) {
    return (
      <SafeAreaView style={s.safe}>
        <TopBar title="Place" />
        <Text style={s.empty}>This place isn’t in KrakowLoop. Go back and pick one from the map.</Text>
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
  const request = useRef(0);

  const media = PLACE_MEDIA[place.id];
  const week = weekHours(place.id, today);
  const todayIndex = (today.getDay() + 6) % 7;
  const trams = nearbyTramStops(place);
  const here = me.status === 'ok' && me.coords && !me.outsideCity ? me.coords : undefined;

  const points: MapPoint[] = [
    { id: place.id, lat: place.lat, lon: place.lon, color: CATEGORY_COLOR[place.cat], glyph: place.cat, label: place.name },
  ];
  if (here) points.push({ id: '__me', lat: here.lat, lon: here.lon, color: colors.vistula, kind: 'me' });

  const walkHere = async () => {
    const mine = ++request.current;
    setNote('Finding you…');
    const loc = await me.locate();
    if (mine !== request.current) return;
    if (loc.status !== 'ok' || !loc.coords) {
      setNote(loc.message ?? 'Your location is needed for a walking route.');
      return;
    }
    if (loc.outsideCity) {
      setNote('You seem to be outside Kraków, so there is no walking route to show.');
      return;
    }
    const from = loc.coords;
    setNote('Finding the way…');
    const real = await walkingRoute([from, place]);
    if (mine !== request.current) return;
    const straight = distance(from, place) * DETOUR;
    setWalk(
      real
        ? { coordinates: real.coordinates, minutes: real.legMinutes[0], metres: real.distanceMetres ?? straight, estimate: false }
        : { coordinates: [[from.lon, from.lat], [place.lon, place.lat]], minutes: walkingMinutes(from, place), metres: straight, estimate: true },
    );
    setNote(null);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TopBar title={place.name} />
      <ScrollView contentContainerStyle={s.scroll}>
        {media?.image ? (
          <View>
            <Image source={media.image} style={s.photo} resizeMode="cover" accessibilityLabel={`Photo of ${place.name}`} />
            <Pressable accessibilityRole="link" onPress={() => openLink(media.sourceUrl!)} style={s.col}>
              <Text style={s.credit} numberOfLines={2}>
                Photo: {media.credit} · {media.license} · Wikimedia Commons
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={[s.col, s.head]}>
          <Eyebrow>
            {CATEGORY_LABEL[place.cat]} · {ZONE_LABEL[place.zone]} · about {place.minutes} min
          </Eyebrow>
          <Text style={s.name} accessibilityRole="header">
            {place.name}
          </Text>
          {place.local ? <Text style={s.local}>{place.local}</Text> : null}
          <Text style={s.blurb}>{place.blurb}</Text>
        </View>

        <View style={[s.col, s.actions]}>
          <Button label="Walk here" onPress={walkHere} style={s.grow} />
          {place.lensId ? <Button label="Time Lens here" kind="quiet" onPress={() => router.push(`/lens/${place.lensId}`)} style={s.grow} /> : null}
        </View>
        {walk ? (
          <Text style={[s.col, s.walk]}>
            {walk.minutes} min walk · {formatDistance(walk.metres)}
            {walk.estimate ? ' (estimate)' : ''}
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
            Opening hours
          </Text>
          {week ? (
            <>
              {week.map((intervals, i) => (
                <View key={DAYS[i]} style={[s.dayRow, i === todayIndex && s.today]}>
                  <Text style={[s.dayName, i === todayIndex && s.todayText]}>
                    {DAYS[i]}
                    {i === todayIndex ? ' · today' : ''}
                  </Text>
                  <Text style={[s.dayHours, i === todayIndex && s.todayText]}>{formatHours(intervals)}</Text>
                </View>
              ))}
              <Text style={s.note}>Hours for this month from OpenStreetMap, without public holidays. Check before you go.</Text>
            </>
          ) : (
            <Text style={s.note}>We have no opening hours for this place. The official website has them.</Text>
          )}
        </View>

        <View style={[s.col, s.section]}>
          <Text style={s.h2} accessibilityRole="header">
            Trams nearby
          </Text>
          {trams.length ? (
            trams.map((t) => (
              <View key={t.name} style={s.tramRow}>
                <Text style={s.tramName}>{t.name}</Text>
                <Text style={s.tramMeta}>
                  {formatDistance(t.metres)} · {t.lines.length === 1 ? 'line' : 'lines'} {t.lines.join(', ')}
                </Text>
              </View>
            ))
          ) : (
            <Text style={s.note}>No tram stop within a short walk.</Text>
          )}
        </View>

        <View style={[s.col, s.section, s.actions]}>
          {media?.website ? <Button label="Official website" kind="quiet" onPress={() => openLink(media.website!)} style={s.grow} /> : null}
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
  blurb: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink, marginTop: space.s },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.m },
  grow: { flexGrow: 1 },
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
  tramRow: { paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.line },
  tramName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  tramMeta: { fontFamily: fonts.body, fontSize: 14, color: colors.mute, marginTop: 2 },
  empty: { fontFamily: fonts.body, fontSize: 16, color: colors.ink, padding: space.m },
});
