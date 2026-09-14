import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoopMap from '../src/components/LoopMap';
import { Button, Chip, Eyebrow, TopBar } from '../src/components/ui';
import { Interest, MAX_PLAN_DAYS, Pace, PlanDay, buildPlan } from '../src/lib/planner';
import { DETOUR, Leg } from '../src/lib/geo';
import { experiences } from '../src/data/places';
import { CATEGORY_COLOR } from '../src/data/categoryColor';
import { AFFILIATE_NOTE } from '../src/config/affiliates';
import { openLink } from '../src/lib/openLink';
import { colors, fonts, space } from '../src/theme';

const INTERESTS: { key: Interest; label: string }[] = [
  { key: 'history', label: 'History' },
  { key: 'museums', label: 'Museums' },
  { key: 'jewish', label: 'Jewish heritage' },
  { key: 'views', label: 'Views & parks' },
  { key: 'food', label: 'Food & nights' },
  { key: 'remembrance', label: 'Remembrance' },
];
const PACES: { key: Pace; label: string }[] = [
  { key: 'easy', label: 'Easy' },
  { key: 'steady', label: 'Steady' },
  { key: 'full', label: 'Full' },
];
const DAY_OPTIONS = Array.from({ length: MAX_PLAN_DAYS }, (_, i) => i + 1);

const fmt = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);
const legText = (l: Leg) =>
  l.byTransit ? `Tram or taxi, about ${fmt(l.minutes)} (${fmt(l.onFootMinutes)} on foot)` : `${fmt(l.minutes)} walk`;

export default function PlanScreen() {
  const [days, setDays] = useState(2);
  const [pace, setPace] = useState<Pace>('steady');
  const [interests, setInterests] = useState<Interest[]>(['history', 'food']);
  const [dayTrips, setDayTrips] = useState(true);
  const [plan, setPlan] = useState<PlanDay[] | null>(null);
  const [dayIdx, setDayIdx] = useState(0);

  const toggle = (k: Interest) => setInterests((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]));
  const build = () => {
    setPlan(buildPlan({ days, pace, interests, dayTrips }));
    setDayIdx(0);
  };

  const day = plan?.[dayIdx];
  const points = useMemo(
    () =>
      day?.stops.map((st, i) => ({
        id: st.place.id,
        lat: st.place.lat,
        lon: st.place.lon,
        color: day.kind === 'city' ? colors.ink : CATEGORY_COLOR[st.place.cat],
        order: day.kind === 'city' ? i + 1 : undefined,
      })) ?? [],
    [day],
  );
  const anyAffiliate = experiences.some((x) => x.booking.affiliate);
  const remembrance = interests.includes('remembrance');

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TopBar title="Plan my days" />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.col}>
          <Text style={s.q}>How many days are you in Kraków?</Text>
          <View style={s.row}>
            {DAY_OPTIONS.map((n) => (
              <Chip key={n} label={n === 1 ? '1 day' : `${n} days`} active={days === n} onPress={() => setDays(n)} />
            ))}
          </View>

          <Text style={s.q}>What do you enjoy?</Text>
          <View style={s.row}>
            {INTERESTS.map((i) => (
              <Chip key={i.key} label={i.label} active={interests.includes(i.key)} onPress={() => toggle(i.key)} />
            ))}
          </View>
          {remembrance ? (
            <Text style={s.note}>
              {dayTrips && days >= 2
                ? 'Auschwitz-Birkenau takes a full day. Entry cards come only from the official website, visit.auschwitz.org.'
                : 'To add a day at Auschwitz-Birkenau, choose 2 or more days and turn on day trips.'}
            </Text>
          ) : null}

          <Text style={s.q}>How much in a day?</Text>
          <View style={s.row}>
            {PACES.map((p) => (
              <Chip key={p.key} label={p.label} active={pace === p.key} onPress={() => setPace(p.key)} />
            ))}
          </View>

          <View style={s.switchRow}>
            <Text style={[s.q, { marginTop: 0, flex: 1 }]}>Include day trips out of the city</Text>
            <Switch
              value={dayTrips}
              onValueChange={setDayTrips}
              trackColor={{ true: colors.ink, false: colors.line }}
              thumbColor={colors.paper}
              accessibilityLabel="Include day trips out of the city"
            />
          </View>

          <Button label={plan ? 'Rebuild my loops' : 'Build my loops'} onPress={build} style={{ marginTop: space.l }} />
        </View>

        {plan && !day ? <Text style={[s.col, s.note]}>Nothing fits these choices. Try another pace or more interests.</Text> : null}

        {plan && day ? (
          <View style={[s.col, { marginTop: space.l }]}>
            <View style={s.row}>
              {plan.map((d, i) => (
                <Chip key={d.index} label={`Day ${d.index}`} active={i === dayIdx} onPress={() => setDayIdx(i)} />
              ))}
            </View>

            <Text style={s.dayTitle}>{day.title}</Text>
            {day.kind === 'city' ? (
              <Eyebrow>
                {day.stops.length} stops · {fmt(day.walkMinutes)} walking
                {day.transitMinutes ? ` · ${fmt(day.transitMinutes)} by tram or taxi` : ''} · {fmt(day.visitMinutes)} visiting
              </Eyebrow>
            ) : (
              <Eyebrow>Full day out of Kraków</Eyebrow>
            )}

            <LoopMap style={s.map} points={points} route={day.kind === 'city' ? day.route : undefined} fit />

            {day.stops.map((st, i) => (
              <View key={st.place.id}>
                {st.leg ? <Text style={s.leg}>{legText(st.leg)}</Text> : null}
                <View style={s.stop}>
                  {day.kind === 'city' ? (
                    <View style={s.num}>
                      <Text style={s.numText}>{i + 1}</Text>
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={s.stopName}>{st.place.name}</Text>
                    <Text style={s.stopBlurb}>{st.place.blurb}</Text>
                    <Eyebrow style={{ marginTop: 4 }}>About {fmt(st.place.minutes)}</Eyebrow>
                    {st.place.booking ? (
                      <Pressable accessibilityRole="link" onPress={() => openLink(st.place.booking!.url)}>
                        <Text style={s.link}>
                          {st.place.booking.label}
                          {st.place.booking.affiliate ? ' · affiliate link' : ''}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
            {day.returnLeg ? <Text style={s.leg}>Back to stop 1: {legText(day.returnLeg)}</Text> : null}

            <Text style={s.small}>
              Times are estimates: straight-line distance plus {Math.round((DETOUR - 1) * 100)}%. Check opening hours before
              you go.
            </Text>

            <Text style={[s.q, { marginTop: space.xl }]}>Add something different</Text>
            {experiences.map((x) => (
              <Pressable key={x.id} accessibilityRole="link" onPress={() => openLink(x.booking.url)} style={s.extra}>
                <Text style={s.stopName}>{x.name}</Text>
                <Text style={s.stopBlurb}>
                  {x.note}
                  {x.season ? ` ${x.season}.` : ''}
                </Text>
              </Pressable>
            ))}
            {anyAffiliate ? <Text style={s.small}>{AFFILIATE_NOTE}</Text> : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  scroll: { paddingBottom: space.xl },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.m },
  q: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink, marginTop: space.l, marginBottom: space.s },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.l, gap: space.m },
  note: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.mute, marginTop: space.s },
  dayTitle: { fontFamily: fonts.bodyBold, fontSize: 24, color: colors.ink, marginTop: space.m, marginBottom: 4 },
  map: { height: 320, marginVertical: space.m, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  stop: { flexDirection: 'row', gap: space.m, backgroundColor: colors.paper, borderRadius: 14, padding: space.m, borderWidth: 1, borderColor: colors.line },
  num: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.gilt },
  stopName: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  stopBlurb: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink, marginTop: 2 },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.vistula, marginTop: space.s },
  leg: { fontFamily: fonts.mono, fontSize: 12, color: colors.mute, paddingVertical: space.s, paddingLeft: 30 },
  small: { fontFamily: fonts.body, fontSize: 12, color: colors.mute, marginTop: space.m },
  extra: { backgroundColor: colors.paper, borderRadius: 14, padding: space.m, borderWidth: 1, borderColor: colors.line, marginBottom: space.s },
});
