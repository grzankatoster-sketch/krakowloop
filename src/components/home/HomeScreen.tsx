import { useState } from 'react';
import { ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Href, Link } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Photo } from '../ui';
import { t } from '../../i18n';
import type { StringKey } from '../../i18n/en';
import { lensPoints } from '../../data/lens';
import { PLACE_MEDIA } from '../../data/placeMedia';
import { experiences, places } from '../../data/places';
import { krakowWallClock } from '../../lib/cityTime';
import { hoursOn } from '../../lib/hours';
import { groupOpenNow } from '../../lib/openNow';
import { openLink } from '../../lib/openLink';
import { colors, fonts, radius, space, typeScale } from '../../theme';
import { EAT_COUNT } from './counts';

const HERO_SOURCE = 'https://commons.wikimedia.org/wiki/File:Krakow_-_Cloth_Hall_from_Basilica_-_1.jpg';

type Mode = 'see' | 'eat' | 'do' | 'stay';

const SEE_CATS = new Set(['history', 'museum', 'jewish', 'view', 'remembrance']);
/** Counts from the app's own data only; a tile without data says what it is instead of a number. */
const COUNTS: Record<Mode, number | null> = {
  see: places.filter((p) => p.zone !== 'out' && SEE_CATS.has(p.cat)).length,
  eat: EAT_COUNT,
  do: experiences.length,
  stay: null,
};

const TILES: { mode: Mode; color: string }[] = [
  { mode: 'see', color: colors.brick },
  { mode: 'eat', color: colors.gilt },
  { mode: 'do', color: colors.patina },
  { mode: 'stay', color: colors.vistula },
];

function Tile({ mode, color }: { mode: Mode; color: string }) {
  const title = t(`home.tile.${mode}` as StringKey);
  const n = COUNTS[mode];
  const line = t(`home.tile.${mode}Line` as StringKey, n === null ? undefined : { n });
  return (
    <Link href={{ pathname: '/map', params: { mode } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${title}. ${line}`}
        style={StyleSheet.flatten([s.tile, { backgroundColor: color }])}
      >
        <Text style={s.tileTitle}>{title}</Text>
        <Text style={s.tileLine}>{line}</Text>
      </Pressable>
    </Link>
  );
}

function MoreCard({ href, image, title, line }: { href: Href; image?: ImageSourcePropType; title: string; line: string }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={`${title}. ${line}`} style={s.more}>
        {image ? <Photo source={image} height={148} /> : null}
        <View style={s.moreText}>
          <Text style={s.moreTitle}>{title}</Text>
          <Text style={s.moreLine} numberOfLines={2}>
            {line}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

/**
 * The home screen, round five (23.09.2026): a visual entry. The hero says where you are in the
 * city's own gothic letters; below it, what is open now, four big doors into Discover, the planner,
 * and the rest of the app as picture cards. Every number on it is counted from the app's data.
 */
export function HomeScreen() {
  const [instant] = useState(() => new Date());
  const openCount = groupOpenNow(places, krakowWallClock(instant), hoursOn).open.length;
  const lensImage = lensPoints[0]?.layers.find((l) => l.kind === 'photo')?.image;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.scroll}>
      <View style={s.hero}>
        <View style={s.col}>
          <Text style={s.brand}>{t('home.brand')}</Text>
          <Text style={s.h1} role="heading" aria-level={1}>
            {t('home.headline')}
          </Text>
          <Text style={s.lead}>{t('home.cityLine')}</Text>
        </View>
      </View>
      <View style={s.col}>
        <Link href="/now" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${t('home.whatNow')} ${openCount ? t('home.whatNowLine', { n: openCount }) : t('home.whatNowNone')}`}
            style={s.now}
          >
            <View style={[s.nowDot, !openCount && { backgroundColor: colors.remembrance }]} />
            <View style={s.grow}>
              <Text style={s.nowTitle}>{t('home.whatNow')}</Text>
              <Text style={s.nowLine}>{openCount ? t('home.whatNowLine', { n: openCount }) : t('home.whatNowNone')}</Text>
            </View>
            <View aria-hidden importantForAccessibility="no-hide-descendants">
              <MaterialCommunityIcons name="chevron-right" size={28} color={colors.mute} />
            </View>
          </Pressable>
        </Link>

        <Text style={s.section} role="heading" aria-level={2}>
          {t('home.discover')}
        </Text>
        <View style={s.grid}>
          {TILES.map((tile) => (
            <Tile key={tile.mode} {...tile} />
          ))}
        </View>
      </View>
      <View style={s.photoCol}>
        <Photo source={require('../../../assets/home/hero-main-square.jpg')} ratio={1280 / 841} accessibilityLabel={t('home.heroAlt')} />
        <Pressable accessibilityRole="link" onPress={() => openLink(HERO_SOURCE)} style={s.captionHit}>
          <Text style={s.caption}>
            {t('home.heroCaption')} · {t('ui.photo')}: Ingo Mehling · CC BY-SA 4.0
          </Text>
        </Pressable>
      </View>

      <View style={s.col}>

        <Link href="/plan" asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={`${t('home.plan.cta')}. ${t('home.planCardLine')}`} style={s.plan}>
            <View style={s.grow}>
              <Text style={s.planTitle}>{t('home.plan.cta')}</Text>
              <Text style={s.planLine}>{t('home.planCardLine')}</Text>
            </View>
            <View aria-hidden importantForAccessibility="no-hide-descendants">
              <MaterialCommunityIcons name="arrow-right" size={28} color={colors.white} />
            </View>
          </Pressable>
        </Link>

        <Text style={s.section} role="heading" aria-level={2}>
          {t('home.more')}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
        <MoreCard href="/lens" image={lensImage} title={t('home.past.title')} line={t('home.pastLine')} />
        <MoreCard href="/trips" image={PLACE_MEDIA.wieliczka?.image} title={t('home.trips.title')} line={t('home.tripsLine')} />
        <MoreCard href="/city" image={PLACE_MEDIA['wawel-cathedral']?.image} title={t('home.knownFor')} line={t('home.knownForLine')} />
      </ScrollView>

      <View style={s.col}>
        <Link href="/about" asChild>
          <Pressable accessibilityRole="link" style={s.quietHit}>
            <Text style={s.quietText}>{t('home.about')}</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.stone },
  scroll: { paddingBottom: space.xl },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.m },
  photoCol: { width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: colors.ink },
  grow: { flex: 1 },
  pressed: { opacity: 0.8 },
  hero: { backgroundColor: colors.ink, paddingTop: space.l, paddingBottom: space.l },
  brand: { ...typeScale.meta, color: colors.white, textTransform: 'uppercase', opacity: 0.85 },
  h1: { ...typeScale.hero, color: colors.white, marginTop: space.s },
  lead: { fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: colors.white, marginTop: space.m },
  captionHit: { paddingHorizontal: space.m, paddingVertical: space.s, minHeight: 44, justifyContent: 'center' },
  caption: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: colors.white, opacity: 0.9 },
  now: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: 72,
    marginTop: space.l,
    paddingHorizontal: space.m,
    borderRadius: radius.m,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  nowDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.patina },
  nowTitle: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink },
  nowLine: { fontFamily: fonts.body, fontSize: 16, color: colors.mute, marginTop: 2 },
  section: { ...typeScale.meta, color: colors.mute, textTransform: 'uppercase', marginTop: space.xl, marginBottom: space.s },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  tile: { flexGrow: 1, flexBasis: '45%', minHeight: 132, borderRadius: radius.l, padding: space.m, justifyContent: 'flex-end' },
  tileTitle: { fontFamily: fonts.display, fontSize: 38, lineHeight: 42, color: colors.white },
  tileLine: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20, color: colors.white, marginTop: 2 },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    marginTop: space.m,
    padding: space.m,
    paddingVertical: space.l,
    borderRadius: radius.l,
    backgroundColor: colors.ink,
  },
  planTitle: { fontFamily: fonts.bodyBold, fontSize: 21, color: colors.white },
  planLine: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.white, opacity: 0.9, marginTop: 4 },
  rail: { gap: space.s, paddingHorizontal: space.m },
  more: { borderRadius: radius.m, overflow: 'hidden', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  moreText: { padding: space.s, paddingHorizontal: space.m, gap: 2, maxWidth: 240 },
  moreTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  moreLine: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: colors.mute },
  quietHit: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', marginTop: space.l },
  quietText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.vistula, textDecorationLine: 'underline' },
});
