import { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, Eyebrow, TopBar } from '../src/components/ui';
import { CATEGORY_LABEL, places } from '../src/data/places';
import { krakowWallClock } from '../src/lib/cityTime';
import { formatDay } from '../src/lib/dates';
import { formatTime, hoursOn, HOURS_EXPORTED } from '../src/lib/hours';
import { closingSoon, groupOpenNow, OpenRow, statusLabel } from '../src/lib/openNow';
import { colors, fonts, space } from '../src/theme';

type Filter = 'all' | 'museum';

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
    <View style={s.group}>
      <Text style={s.h2} accessibilityRole="header">
        {title} ({rows.length})
      </Text>
      {rows.length ? (
        rows.map((row) => (
          <View key={row.place.id} style={s.row}>
            <Link href={`/place/${row.place.id}`} asChild>
              <Pressable
                nativeID={linkId(row.place.id)}
                accessibilityRole="link"
                accessibilityLabel={`Open ${row.place.name}`}
                onFocus={() => onFocusPlace(row.place.id)}
                onBlur={() => onFocusPlace(null)}
              >
                <Text style={s.name}>{row.place.name}</Text>
              </Pressable>
            </Link>
            <Text style={[s.status, closingSoon(row.status, minutes) && s.soon]}>
              {CATEGORY_LABEL[row.place.cat]} · {statusLabel(row.status, minutes)}
            </Text>
          </View>
        ))
      ) : (
        <Text style={s.empty}>{empty}</Text>
      )}
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
  const groups = groupOpenNow(filter === 'museum' ? places.filter((p) => p.cat === 'museum') : places, now, hoursOn);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TopBar title="Open now" />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.col}>
          <Eyebrow>
            {formatDay(now)} · {formatTime(minutes)} in Kraków
          </Eyebrow>
          <View style={s.chips}>
            <Chip label="Everything" active={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label="Museums" active={filter === 'museum'} onPress={() => setFilter('museum')} />
          </View>
          <Group title="Open now" rows={groups.open} minutes={minutes} empty="Nothing we know of is open right now." onFocusPlace={setFocusedPlace} />
          <Group title="Opens later today" rows={groups.later} minutes={minutes} empty="Nothing else opens later today." onFocusPlace={setFocusedPlace} />
          <Group title="Closed" rows={groups.closed} minutes={minutes} empty="Nothing is closed for the day." onFocusPlace={setFocusedPlace} />
          <Text style={s.note}>
            Hours from OpenStreetMap (exported {HOURS_EXPORTED}), without public holidays or last entry times.
            {groups.unknown ? ` We have no hours for ${groups.unknown} more places; their place pages link to the official websites.` : ''}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  scroll: { paddingBottom: space.xl },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.m, gap: space.m, paddingTop: space.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  group: { backgroundColor: colors.paper, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: space.m, gap: space.s },
  h2: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink },
  row: { gap: 2, paddingVertical: 4 },
  name: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink, textDecorationLine: 'underline', textDecorationColor: colors.line },
  status: { fontFamily: fonts.body, fontSize: 14, color: colors.mute },
  soon: { color: colors.brick, fontFamily: fonts.bodyBold },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.mute },
  note: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.mute },
});
