import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace, useTopSpace } from '../../src/lib/useTabBarSpace';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { placeName } from '../../src/components/placeName';
import LoopMap from '../../src/components/LoopMap';
import type { MapPoint } from '../../src/components/mapHtml';
import { CATEGORY_COLOR } from '../../src/data/categoryColor';
import { EventsSection } from '../../src/components/EventsSection';
import { CITY } from '../../src/config/city';
import { CuisineKey } from '../../src/data/cuisines';
import { lensPoints } from '../../src/data/lens';
import { PLACE_MEDIA } from '../../src/data/placeMedia';
import { Experience, experiences, placeById, places } from '../../src/data/places';
import { cuisineCounts } from '../../src/data/restaurants';
import { STAYS } from '../../src/data/stays';
import { byDistance, topCuisines } from '../../src/lib/discover';
import { walkMinutes } from '../../src/lib/moments';
import { openLink } from '../../src/lib/openLink';
import { useSaved } from '../../src/lib/saved';
import { t } from '../../src/i18n';
import type { StringKey } from '../../src/i18n/en';
import { colors, fonts, space } from '../../src/theme';

const RYNEK = { lat: CITY.mapCentre.lat, lon: CITY.mapCentre.lon };
const COUNTS = cuisineCounts();
/** the sights in town, for the map at the top of Discover */
const MAP_POINTS: MapPoint[] = places
  .filter((p) => p.zone !== 'out' && p.cat !== 'food' && p.cat !== 'night')
  .map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, color: CATEGORY_COLOR[p.cat], glyph: p.cat, label: placeName(p), rank: p.priority }));
const CUISINES = topCuisines(COUNTS, 8);
const TILE_COLORS = [colors.brick, colors.gilt, colors.patina, colors.vistula, colors.night, colors.ink];
const MORE = [
  { href: '/trips', image: PLACE_MEDIA.wieliczka?.image, title: 'home.trips.title', line: 'home.tripsLine' },
  { href: '/city', image: PLACE_MEDIA['wawel-cathedral']?.image, title: 'home.knownFor', line: 'home.knownForLine' },
] as const;
type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const KIND_ICON: Record<string, Icon> = { extreme: 'lightning-bolt', sightseeing: 'binoculars', food: 'silverware-fork-knife', water: 'waves', night: 'glass-cocktail' };

/** An activity's name or note in the app language, the English original otherwise. */
function expText(id: string, field: 'name' | 'note', fallback: string): string {
  const key = `exp.${id}.${field}` as StringKey;
  const v = t(key);
  return v && v !== key ? v : fallback;
}

/**
 * Discover, as a magazine of the city: sights in photographs, food by what you crave, things to do,
 * the city in the past and places to sleep. The map is a tool behind a button, not the page.
 */
// a failure on this screen shows its message instead of an empty screen
export { ScreenError as ErrorBoundary } from '../../src/components/ScreenError';

export default function DiscoverScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const topSpace = useTopSpace();
  const { width } = useWindowDimensions();
  const tileW = (width - space.l * 2 - space.s) / 2;
  // a fixed height, not aspectRatio: on iOS a tile sized by aspectRatio, holding only absolutely placed
  // children, took its place in the grid but was never drawn (seen on the simulator tour)
  const tileH = Math.round(tileW / 0.78);

  const sights = useMemo(
    () => byDistance(places.filter((p) => p.zone !== 'out' && p.cat !== 'food' && p.cat !== 'night' && PLACE_MEDIA[p.id]?.image), RYNEK).slice(0, 8),
    [],
  );
  const savedIds = useSaved();
  const saved = useMemo(() => savedIds.map((id) => placeById(id)).filter((p) => p !== undefined), [savedIds]);
  const lens = useMemo(() => lensPoints.map((l) => ({ l, old: l.layers.find((x) => x.kind === 'photo') ?? l.layers[0] })).filter((x) => x.old), []);

  const go = (href: Parameters<typeof router.push>[0]) => {
    Haptics.selectionAsync().catch(() => {});
    router.push(href);
  };

  return (
    <View style={s.root}>
      <ScrollView style={s.root} contentContainerStyle={{ paddingTop: topSpace + space.m, paddingBottom: Math.max(insets.bottom, tabSpace) + space.xl }}>
      <View style={s.head}>
        <Text style={s.title} accessibilityRole="header">
          {t('discover.native.title')}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('story.openMap')} onPress={() => go('/map')} style={({ pressed }) => [s.mapBtn, pressed && s.pressed]}>
          <MaterialCommunityIcons name="map-outline" size={24} color={colors.white} />
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={() => go('/wish')} style={({ pressed }) => [s.search, pressed && s.pressed]}>
        <MaterialCommunityIcons name="microphone" size={22} color={colors.brick} />
        <Text style={s.searchText}>{t('moment.ask')}</Text>
      </Pressable>

      {/* the map, visible at once: a picture of the sights that opens the full map on a tap */}
      <Pressable accessibilityRole="button" accessibilityLabel={t('story.openMap')} onPress={() => go('/map')} style={({ pressed }) => [s.mapCard, pressed && s.pressed]}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LoopMap style={StyleSheet.absoluteFill} points={MAP_POINTS} fit inactive />
        </View>
        <View style={s.mapCardChip} pointerEvents="none">
          <MaterialCommunityIcons name="map-search-outline" size={18} color={colors.white} />
          <Text style={s.mapCardText}>{t('discover.native.mapCta')}</Text>
        </View>
      </Pressable>

      {/* places kept for later with the heart on a place's screen */}
      {saved.length ? (
        <>
          <Text style={s.eyebrow}>{t('saved.eyebrow', { n: saved.length })}</Text>
          <Text style={s.h2}>{t('saved.title')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
            {saved.map((p) => (
              <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={placeName(p)} onPress={() => go(`/place/${p.id}`)} style={({ pressed }) => [s.savedTile, pressed && s.pressed]}>
                {PLACE_MEDIA[p.id]?.image ? (
                  <View style={s.fill} pointerEvents="none"><Image source={PLACE_MEDIA[p.id]!.image!} style={s.photo} resizeMode="cover" accessibilityIgnoresInvertColors /></View>
                ) : (
                  <View style={[s.fill, { backgroundColor: CATEGORY_COLOR[p.cat] }]} />
                )}
                <LinearGradient colors={['rgba(8,11,30,0)', 'rgba(8,11,30,0.85)']} locations={[0.35, 1]} style={s.fill} />
                <MaterialCommunityIcons name="heart" size={18} color={colors.white} style={s.savedHeart} />
                <Text style={[s.tileName, s.savedName]} numberOfLines={2}>
                  {placeName(p)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {/* concerts, sport, theatre: today, tomorrow, the weekend */}
        <EventsSection from={RYNEK} />

        {/* sights to walk to, in photographs */}
      <Text style={s.eyebrow}>{t('discover.native.nearRynek')}</Text>
      <Text style={s.h2}>{t('discover.native.sights')}</Text>
      <View style={s.grid}>
        {sights.map(({ item: p, metres }) => (
          <Pressable key={p.id} accessibilityRole="button" accessibilityLabel={placeName(p)} onPress={() => go(`/place/${p.id}`)} style={({ pressed }) => [{ width: tileW, height: tileH }, s.tile, pressed && s.pressed]}>
            <View style={s.fill} pointerEvents="none"><Image source={PLACE_MEDIA[p.id]!.image!} style={s.photo} resizeMode="cover" accessibilityIgnoresInvertColors /></View>
            <LinearGradient colors={['rgba(8,11,30,0)', 'rgba(8,11,30,0.85)']} locations={[0.4, 1]} style={s.fill} />
            <View style={s.tileWords}>
              <Text style={s.tileMeta} numberOfLines={1}>
                {t('story.walk', { n: walkMinutes(metres ?? 0) })}
              </Text>
              <Text style={s.tileName} numberOfLines={2}>
                {placeName(p)}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
      <Pressable accessibilityRole="link" onPress={() => go({ pathname: '/map', params: { mode: 'see' } })} style={s.more}>
        <Text style={s.moreText}>{t('discover.native.allOnMap')}</Text>
        <MaterialCommunityIcons name="arrow-right" size={20} color={colors.ink} />
      </Pressable>

      {/* food by what you crave */}
      <Text style={s.eyebrow}>{t('discover.native.hungry')}</Text>
      <Text style={s.h2}>{t('discover.native.food')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {CUISINES.map((c: CuisineKey, i) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            onPress={() => go({ pathname: '/map', params: { mode: 'eat', cuisine: c } })}
            style={({ pressed }) => [s.food, { backgroundColor: TILE_COLORS[i % TILE_COLORS.length] }, pressed && s.pressed]}
          >
            <Text style={s.foodName} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.6}>
              {t(`cuisine.${c}` as StringKey)}
            </Text>
            <Text style={s.foodCount}>{t('discover.native.places', { n: COUNTS[c] })}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* things to do */}
      <Text style={s.eyebrow}>{t('discover.native.doEyebrow')}</Text>
      <Text style={s.h2}>{t('discover.native.do')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {experiences.map((x) => {
          const e = x as Experience & { kind?: string; minutes?: number; pickup?: boolean };
          const meta = [e.minutes ? t('discover.do.minutes', { h: Math.round((e.minutes / 60) * 10) / 10 }) : null, e.pickup ? t('discover.do.pickup') : null].filter(Boolean).join(' · ');
          return (
            <View key={x.id} style={[s.exp, e.kind === 'extreme' && s.expHot]}>
              <MaterialCommunityIcons name={KIND_ICON[e.kind ?? 'sightseeing'] ?? 'star-outline'} size={30} color={colors.white} />
              <Text style={s.expName} numberOfLines={2}>
                {expText(x.id, 'name', x.name)}
              </Text>
              <Text style={s.expNote} numberOfLines={2}>
                {meta || expText(x.id, 'note', x.note)}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => openLink(x.booking.url)} style={({ pressed }) => [s.expBtn, pressed && s.pressed]}>
                <Text style={s.expBtnText}>{t('discover.native.book')}</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      {/* the city in the past */}
      <Text style={s.eyebrow}>{t('discover.native.pastEyebrow')}</Text>
      <Text style={s.h2}>{t('discover.native.past')}</Text>
      {/* one door to the Time Lens tab, not a second gallery of the same old photos */}
      {lens[0] ? (
        <Pressable accessibilityRole="link" onPress={() => go('/obiektyw')} style={({ pressed }) => [s.pastDoor, pressed && s.pressed]}>
          <View style={s.fill} pointerEvents="none"><Image source={lens[0].old!.image} style={s.photo} resizeMode="cover" accessibilityIgnoresInvertColors /></View>
          <LinearGradient colors={['rgba(8,11,30,0.15)', 'rgba(8,11,30,0.88)']} style={s.fill} />
          <Text style={s.pastYear}>{lens[0].old!.year}</Text>
          <Text style={s.pastName}>{t('discover.native.pastDoor', { n: lens.length })}</Text>
        </Pressable>
      ) : null}

      {/* where to sleep */}
      <Pressable accessibilityRole="button" onPress={() => go({ pathname: '/map', params: { mode: 'stay' } })} style={({ pressed }) => [s.stay, pressed && s.pressed]}>
        <MaterialCommunityIcons name="bed-outline" size={40} color={colors.white} />
        <View style={s.stayWords}>
          <Text style={s.stayTitle}>{t('discover.native.stay')}</Text>
          <Text style={s.stayLine}>{t('discover.native.stayLine', { n: STAYS.length })}</Text>
        </View>
        <MaterialCommunityIcons name="arrow-right" size={26} color={colors.white} />
      </Pressable>

        {/* the rest of the city: day trips, what Kraków is known for, and where every fact comes from */}
        <Text style={s.eyebrow}>{t('home.more')}</Text>
        {MORE.map((m) => (
          <Pressable
            key={m.href}
            accessibilityRole="link"
            accessibilityLabel={`${t(m.title)}. ${t(m.line)}`}
            onPress={() => go(m.href)}
            style={({ pressed }) => [s.moreCard, pressed && s.pressed]}
          >
            {m.image ? <View style={s.fill} pointerEvents="none"><Image source={m.image} style={s.photo} resizeMode="cover" accessibilityIgnoresInvertColors /></View> : null}
            <LinearGradient colors={['rgba(8,11,30,0.05)', 'rgba(8,11,30,0.85)']} style={s.fill} />
            <Text style={s.moreTitle}>{t(m.title)}</Text>
            <Text style={s.moreLine} numberOfLines={2}>
              {t(m.line)}
            </Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="link" onPress={() => go('/about')} style={s.about}>
          <MaterialCommunityIcons name="information-outline" size={20} color={colors.ink} />
          <Text style={s.moreText}>{t('home.about')}</Text>
        </Pressable>
      </ScrollView>
      {/* the page scrolls under the phone's clock: a strip of paper keeps the two apart */}
      <View style={[s.statusStrip, { height: topSpace }]} pointerEvents="none" />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  mapCard: { height: 210, marginHorizontal: space.l, marginTop: space.m, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.stone },
  mapCardChip: { position: 'absolute', left: space.m, bottom: space.m, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(14,19,48,0.85)' },
  mapCardText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  statusStrip: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.paper, opacity: 0.96 },
  pressed: { transform: [{ scale: 0.97 }] },
  // a frame pinned to all four edges (on iOS a 100% size leaves out the card's padding), and the
  // photo 100% of that frame: an Image left to the edges alone takes the file's own size
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  photo: { width: '100%', height: '100%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.l },
  title: { fontFamily: fonts.display, fontSize: 48, lineHeight: 52, color: colors.ink },
  mapBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: space.l,
    marginTop: space.m,
    minHeight: 56,
    paddingHorizontal: space.m,
    borderRadius: 28,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  searchText: { fontFamily: fonts.body, fontSize: 17, color: colors.mute },
  eyebrow: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 1, color: colors.mute, textTransform: 'uppercase', marginTop: space.xl, marginHorizontal: space.l },
  h2: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, color: colors.ink, marginHorizontal: space.l, marginTop: 4, marginBottom: space.m },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, paddingHorizontal: space.l },
  tile: { borderRadius: 22, overflow: 'hidden', backgroundColor: colors.stone },
  tileWords: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 2 },
  tileMeta: { fontFamily: fonts.monoBold, fontSize: 10, letterSpacing: 0.6, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' },
  tileName: { fontFamily: fonts.display, fontSize: 22, lineHeight: 24, color: colors.white },
  more: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginHorizontal: space.l, marginTop: space.m, minHeight: 44 },
  moreText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink, textDecorationLine: 'underline' },
  row: { gap: space.s, paddingHorizontal: space.l },
  savedTile: { width: 150, height: 190, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.stone, justifyContent: 'flex-end', padding: 12 },
  savedHeart: { position: 'absolute', top: 12, right: 12 },
  savedName: { fontSize: 20, lineHeight: 22 },
  food: { width: 150, height: 170, borderRadius: 22, padding: space.m, justifyContent: 'space-between' },
  foodName: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, color: colors.white },
  foodCount: { fontFamily: fonts.monoBold, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  exp: { width: 230, borderRadius: 22, padding: space.m, backgroundColor: colors.ink, gap: 8 },
  expHot: { backgroundColor: colors.patina },
  expName: { fontFamily: fonts.display, fontSize: 26, lineHeight: 28, color: colors.white, minHeight: 56 },
  expNote: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: 'rgba(255,255,255,0.85)', minHeight: 38 },
  expBtn: { alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.white, justifyContent: 'center' },
  expBtnText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  past: { width: 220, height: 290, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.stone, justifyContent: 'flex-end', padding: space.m },
  pastDoor: { height: 200, marginHorizontal: space.l, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end', padding: space.l, backgroundColor: colors.ink },
  pastYear: { fontFamily: fonts.display, fontSize: 44, color: colors.white },
  pastName: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.white },
  stay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    marginHorizontal: space.l,
    marginTop: space.xl,
    padding: space.l,
    borderRadius: 24,
    backgroundColor: colors.vistula,
  },
  stayWords: { flex: 1, gap: 4 },
  moreCard: { height: 200, marginHorizontal: space.l, marginTop: space.m, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end', padding: space.l, backgroundColor: colors.ink },
  moreTitle: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, color: colors.white },
  moreLine: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: 'rgba(255,255,255,0.88)', marginTop: 4 },
  about: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginHorizontal: space.l, marginTop: space.l, minHeight: 44 },
  stayTitle: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, color: colors.white },
  stayLine: { fontFamily: fonts.body, fontSize: 15, color: 'rgba(255,255,255,0.9)' },
});
