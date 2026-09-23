import { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { card, Chip, ScreenHeader } from '../src/components/ui';
import { placeName } from '../src/components/placeName';
import { CATEGORY_COLOR } from '../src/data/categoryColor';
import { CATEGORY_LABEL, Category, places } from '../src/data/places';
import { krakowWallClock } from '../src/lib/cityTime';
import { formatDay } from '../src/lib/dates';
import { formatTime, hoursOn, HOURS_EXPORTED } from '../src/lib/hours';
import { closingSoon, groupOpenNow, OpenRow, statusLabel } from '../src/lib/openNow';
import { t } from '../src/i18n';
import { colors, fonts, space, typeScale } from '../src/theme';

type Filter = 'all' | Category;

/** The categories that have opening hours at all, in the order of CATEGORY_LABEL: only those get a chip. */
const FILTERS: Category[] = (Object.keys(CATEGORY_LABEL) as Category[]).filter((cat) =>
  places.some((p) => p.cat === cat && p.zone !== 'out' && hoursOn(p.id, new Date()) !== null),
);

/** DOM id of a place's link on web, so focus can follow it when the clock moves it to another group. */
const linkId = (placeId: string) => `open-now-${placeId}`;

function Group({
  title,
  rows,
  minutes,
  empty,
  onFocusPlace,
}: {
  title: string;
  rows: OpenRow[];
  minutes: number;
  empty: string;
  onFocusPlace: (placeId: string | null) => void;
}) {
  return (
    <View style={s.groupWrap}>
      <Text style={s.h2} accessibilityRole="header">
        {title} · {rows.length}
      </Text>
      <View style={s.group}>
        {rows.length ? (
          rows.map((row, i) => {
            const name = placeName(row.place);
            const status = statusLabel(row.status, minutes);
            return (
              <Link key={row.place.id} href={`/place/${row.place.id}`} asChild>
                <Pressable
                  nativeID={linkId(row.place.id)}
                  accessibilityRole="link"
                  accessibilityLabel={`${t('now.openLabel', { name })}. ${CATEGORY_LABEL[row.place.cat]}, ${status}`}
                  onFocus={() => onFocusPlace(row.place.id)}
                  onBlur={() => onFocusPlace(null)}
                  style={StyleSheet.flatten([s.row, i > 0 && s.rowLine])}
                >
                  <View style={[s.dot, { backgroundColor: CATEGORY_COLOR[row.place.cat] }]} />
                  <View style={s.rowBody}>
                    <Text style={s.name}>{name}</Text>
                    <Text style={s.cat}>{CATEGORY_LABEL[row.place.cat]}</Text>
                    <Text style={[s.status, closingSoon(row.status, minutes) && s.soon]}>{status}</Text>
                  </View>
                  <View aria-hidden importantForAccessibility="no-hide-descendants">
                    <MaterialCommunityIcons name="chevron-right" size={26} color={colors.mute} />
                  </View>
                </Pressable>
              </Link>
            );
          })
        ) : (
          <Text style={s.empty}>{empty}</Text>
        )}
      </View>
    </View>
  );
}

export default function OpenNow() {
  const [instant, setInstant] = useState(() => new Date());
  const [filter, setFilter] = useState<Filter>('all');
  // the place whose link has keyboard focus: a minute tick can move its row to another group, which
  // remounts the link, so focus is put back on it (web; native screen readers keep their own place)
  const [focusedPlace, setFocusedPlace] = useState<string | null>(null);
  // The list moves with the clock: refresh on each new minute, and when the app comes back to the
  // front, so a place that has just closed leaves "Open now" without a reload.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setInstant(new Date());
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setInstant(new Date());
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web' || !focusedPlace) return;
    const el = document.getElementById(linkId(focusedPlace));
    if (el && document.activeElement !== el) el.focus({ preventScroll: true });
  }, [instant, focusedPlace]);
  // opening hours are Kraków times, whatever zone the phone is set to
  const now = krakowWallClock(instant);
  const minutes = now.getHours() * 60 + now.getMinutes();
  // a few dozen places: cheap enough to sort on every render, and the React Compiler memoizes it
  const groups = groupOpenNow(filter === 'all' ? places : places.filter((p) => p.cat === filter), now, hoursOn);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <ScreenHeader title={t('now.title')} eyebrow={t('now.clock', { day: formatDay(now), time: formatTime(minutes) })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} accessibilityLabel={t('now.filter')}>
          <Chip label={t('now.everything')} active={filter === 'all'} onPress={() => setFilter('all')} />
          {FILTERS.map((cat) => (
            <Chip key={cat} label={CATEGORY_LABEL[cat]} color={CATEGORY_COLOR[cat]} active={filter === cat} onPress={() => setFilter(cat)} />
          ))}
        </ScrollView>
        <View style={s.col}>
          <Group title={t('now.open')} rows={groups.open} minutes={minutes} empty={t('now.emptyOpen')} onFocusPlace={setFocusedPlace} />
          <Group title={t('now.later')} rows={groups.later} minutes={minutes} empty={t('now.emptyLater')} onFocusPlace={setFocusedPlace} />
          <Group title={t('now.closed')} rows={groups.closed} minutes={minutes} empty={t('now.emptyClosed')} onFocusPlace={setFocusedPlace} />
          <Text style={s.note}>
            {t('now.note', { date: HOURS_EXPORTED })}
            {groups.unknown ? t('now.unknown', { n: groups.unknown }) : ''}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  scroll: { paddingBottom: space.xl },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.m, gap: space.l, paddingTop: space.m },
  chips: { flexDirection: 'row', gap: space.s, paddingHorizontal: space.m },
  groupWrap: { gap: space.s },
  group: { ...card },
  h2: { ...typeScale.meta, color: colors.mute, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 64, paddingVertical: space.s + 2, paddingHorizontal: space.m },
  rowLine: { borderTopWidth: 1, borderColor: colors.line },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowBody: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bodyBold, fontSize: 17, lineHeight: 22, color: colors.ink },
  cat: { fontFamily: fonts.body, fontSize: 15, color: colors.mute },
  status: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  soon: { color: colors.brick },
  empty: { fontFamily: fonts.body, fontSize: 15, color: colors.mute, padding: space.m },
  note: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.mute },
});
