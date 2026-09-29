import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { Chip } from './ui';
import { CityEvent, EVENT_CATEGORIES, EventCategory, EventWhen, daysFor, eventTime, pickEvents, useCityEvents } from '../lib/events';
import { LatLon } from '../lib/geo';
import { openLink } from '../lib/openLink';
import { openWalkingDirections } from '../lib/navigate';
import { t } from '../i18n';
import type { StringKey } from '../i18n/en';
import { colors, fonts, space } from '../theme';

type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
export const EVENT_ICON: Record<EventCategory, Icon> = { concert: 'music', sport: 'soccer', theatre: 'drama-masks', family: 'human-male-child', other: 'star-four-points' };
export const EVENT_COLOR: Record<EventCategory, string> = { concert: colors.brick, sport: colors.patina, theatre: colors.night, family: colors.gilt, other: colors.vistula };
const WHEN: EventWhen[] = ['today', 'tomorrow', 'weekend'];

/**
 * "Today in Kraków" in Discover: concerts, sport and theatre from our events Worker, for today,
 * tomorrow or the weekend, by kind, soonest or nearest first. Hidden when no Worker is set up.
 */
export function EventsSection({ from }: { from: LatLon }) {
  const { enabled, ready, failed, events } = useCityEvents();
  const [when, setWhen] = useState<EventWhen>('today');
  const [cats, setCats] = useState<EventCategory[]>([]);
  const [sort, setSort] = useState<'time' | 'near'>('time');
  const shown = useMemo(() => pickEvents(events, daysFor(when), cats, sort, from), [events, when, cats, sort, from]);
  if (!enabled) return null;

  const toggle = (c: EventCategory) => {
    Haptics.selectionAsync().catch(() => {});
    setCats((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]));
  };
  const note = !ready ? t('events.loading') : failed && !events.length ? t('events.failed') : !shown.length ? t('events.none') : null;

  return (
    <View>
      <Text style={s.eyebrow}>{t('events.eyebrow')}</Text>
      <Text style={s.h2} accessibilityRole="header">{t('events.title')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {WHEN.map((w) => (
          <Chip key={w} label={t(`events.when.${w}` as StringKey)} active={when === w} onPress={() => setWhen(w)} />
        ))}
        <View style={s.sep} />
        {EVENT_CATEGORIES.map((c) => (
          <Chip key={c} label={t(`events.cat.${c}` as StringKey)} active={cats.includes(c)} onPress={() => toggle(c)} />
        ))}
        <View style={s.sep} />
        <Chip label={t('events.sort.time')} active={sort === 'time'} onPress={() => setSort('time')} />
        <Chip label={t('events.sort.near')} active={sort === 'near'} onPress={() => setSort('near')} />
      </ScrollView>
      {note ? (
        <Text style={s.note} accessibilityLiveRegion="polite">
          {note}
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
          {shown.map((e) => (
            <EventCard key={e.id} e={e} showDay={when === 'weekend'} />
          ))}
        </ScrollView>
      )}
      <Text style={s.credit}>{t('events.credit')}</Text>
    </View>
  );
}

function EventCard({ e, showDay }: { e: CityEvent; showDay: boolean }) {
  const time = eventTime(e);
  const day = showDay ? new Date(`${e.day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }) : null;
  const when = [day, time ?? t('events.allDay')].filter(Boolean).join(' · ');
  return (
    <View style={s.card}>
      <View style={[s.top, { backgroundColor: EVENT_COLOR[e.category] }]}>
        {e.image ? (
          <View style={s.fill} pointerEvents="none"><Image source={{ uri: e.image }} style={s.photo} resizeMode="cover" accessibilityIgnoresInvertColors /></View>
        ) : (
          <MaterialCommunityIcons name={EVENT_ICON[e.category]} size={64} color="rgba(255,255,255,0.3)" />
        )}
        <LinearGradient colors={['rgba(8,11,30,0)', 'rgba(8,11,30,0.8)']} style={s.fill} pointerEvents="none" />
        <Text style={s.when}>{when}</Text>
      </View>
      <View style={s.body}>
        <Text style={s.title} numberOfLines={2}>
          {e.title}
        </Text>
        <Text style={s.venue} numberOfLines={1}>
          {e.venue}
        </Text>
        <View style={s.actions}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('events.ticketsFor', { name: e.title })}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              openLink(e.url);
            }}
            style={({ pressed }) => [s.btn, pressed && s.pressed]}
          >
            <Text style={s.btnText}>{t('events.tickets')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('moment.go', { name: e.venue || e.title })} onPress={() => openWalkingDirections(e)} hitSlop={6}>
            <MaterialCommunityIcons name="navigation-variant" size={24} color={colors.ink} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  eyebrow: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 1, color: colors.mute, textTransform: 'uppercase', marginTop: space.xl, marginHorizontal: space.l },
  h2: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, color: colors.ink, marginHorizontal: space.l, marginTop: 4, marginBottom: space.s },
  chips: { gap: space.s, paddingHorizontal: space.l, paddingBottom: space.m, alignItems: 'center' },
  sep: { width: 1, height: 24, backgroundColor: colors.line, marginHorizontal: 2 },
  row: { gap: space.s, paddingHorizontal: space.l },
  note: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.mute, marginHorizontal: space.l },
  credit: { fontFamily: fonts.body, fontSize: 12, color: colors.mute, marginHorizontal: space.l, marginTop: space.s },
  card: { width: 260, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  top: { height: 150, alignItems: 'center', justifyContent: 'center' },
  // a frame pinned to all four edges (on iOS a 100% size leaves out the card's padding), and the
  // photo 100% of that frame: an Image left to the edges alone takes the file's own size
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  photo: { width: '100%', height: '100%' },
  when: { position: 'absolute', left: space.m, bottom: space.s, fontFamily: fonts.monoBold, fontSize: 13, letterSpacing: 0.6, color: colors.white },
  body: { padding: space.m, gap: 4 },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 25, color: colors.ink, minHeight: 50 },
  venue: { fontFamily: fonts.body, fontSize: 14, color: colors.mute },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.s },
  btn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.ink, justifyContent: 'center' },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
  pressed: { transform: [{ scale: 0.97 }] },
});
