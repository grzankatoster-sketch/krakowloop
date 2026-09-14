import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoopMap from '../src/components/LoopMap';
import type { MapPoint } from '../src/components/mapHtml';
import { Button, Chip, Eyebrow, TopBar } from '../src/components/ui';
import { experiences, places } from '../src/data/places';
import { CATEGORY_COLOR } from '../src/data/categoryColor';
import { AFFILIATE_NOTE } from '../src/config/affiliates';
import { addDays, formatDay, parseISODate, toISODate } from '../src/lib/dates';
import { WALKING_ROUTES_ENABLED, WalkingRoute, walkingRoute } from '../src/lib/directions';
import { DETOUR } from '../src/lib/geo';
import { formatHours, hoursOn } from '../src/lib/hours';
import type { Leg } from '../src/lib/legs';
import { openLink } from '../src/lib/openLink';
import { paramsToPlan, planToParams, shareableParams } from '../src/lib/planParams';
import { Interest, MAX_PLAN_DAYS, Pace, PlanOptions, buildPlan } from '../src/lib/planner';
import { realMinutes, shownTotal, walkTotal, walkedEndToEnd } from '../src/lib/planView';
import { shareLink } from '../src/lib/share';
import { TRANSIT_FEED_VERSION } from '../src/lib/transit';
import { useMyLocation } from '../src/lib/useMyLocation';
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
const KNOWN_IDS: ReadonlySet<string> = new Set(places.map((p) => p.id));
const DEFAULT_FORM: PlanOptions = { days: 2, pace: 'steady', interests: ['history', 'food'], dayTrips: true };

const fmt = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);

function legText(l: Leg, realWalkMinutes: number | null): string {
  if (l.mode === 'walk') return `${fmt(realWalkMinutes ?? l.minutes)} walk`;
  if (l.mode === 'tram' && l.tram) {
    const t = l.tram;
    return `Tram ${t.line} towards ${t.headsign}: ${t.from} → ${t.to}, ${t.stopCount} ${t.stopCount === 1 ? 'stop' : 'stops'}. About ${fmt(t.minutes)} with the walk to the stop and waiting (${fmt(l.onFootMinutes)} on foot)`;
  }
  return `Taxi, about ${fmt(l.minutes)} (${fmt(l.onFootMinutes)} on foot)`;
}

/** "Mon 12 Oct", or the raw value if it isn't a valid date */
function dayLabel(iso: string | undefined): string {
  const d = parseISODate(iso);
  return d ? formatDay(d) : iso ?? '';
}

function hoursThatDay(placeId: string, date: string | undefined): string | null {
  const d = parseISODate(date);
  return d ? formatHours(hoursOn(placeId, d)) : null;
}

export default function PlanScreen() {
  const { days, pace, likes, trips, date, from, skip } = useLocalSearchParams<{
    days?: string;
    pace?: string;
    likes?: string;
    trips?: string;
    date?: string;
    from?: string;
    skip?: string;
  }>();
  const options = useMemo(
    () => paramsToPlan({ days, pace, likes, trips, date, from, skip }, KNOWN_IDS),
    [days, pace, likes, trips, date, from, skip],
  );
  const plan = useMemo(() => (options ? buildPlan(options) : null), [options]);
  const planKey = options ? JSON.stringify(options) : '';

  // The form belongs to the plan in the URL: a different plan arriving (a shared link, a skipped
  // stop, a rebuild) refills it, so "Rebuild" never overwrites it with stale choices.
  const [formState, setFormState] = useState(() => ({ key: planKey, form: options ?? DEFAULT_FORM }));
  if (options && formState.key !== planKey) setFormState({ key: planKey, form: { ...options, exclude: [] } });
  const form = formState.form;
  const setForm = (update: (f: PlanOptions) => PlanOptions) => setFormState((s) => ({ key: s.key, form: update(s.form) }));
  const [today] = useState(() => toISODate(new Date()));
  const [daySel, setDaySel] = useState({ key: '', index: 0 });
  const [walk, setWalk] = useState<{ key: string; route: WalkingRoute } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const me = useMyLocation();

  const dayIdx = plan && daySel.key === planKey ? Math.min(daySel.index, plan.length - 1) : 0;
  const day = plan?.[dayIdx];

  // Real walking route for the chosen day (Mapbox Directions). Without a token, estimates stay.
  const walkKey = day?.kind === 'city' && day.route.length > 1 ? day.route.map((c) => c.join(',')).join(';') : '';
  useEffect(() => {
    if (!WALKING_ROUTES_ENABLED || !walkKey) return;
    let live = true;
    const pts = walkKey.split(';').map((pair) => {
      const [lon, lat] = pair.split(',').map(Number);
      return { lat, lon };
    });
    walkingRoute(pts).then((route) => {
      if (live && route) setWalk({ key: walkKey, route });
    });
    return () => {
      live = false;
    };
  }, [walkKey]);
  const real = walk && walk.key === walkKey ? walk.route : null;

  const points = useMemo<MapPoint[]>(() => {
    if (!day) return [];
    const stops: MapPoint[] = day.stops.map((st, i) => ({
      id: st.place.id,
      lat: st.place.lat,
      lon: st.place.lon,
      color: day.kind === 'city' ? colors.ink : CATEGORY_COLOR[st.place.cat],
      order: day.kind === 'city' ? i + 1 : undefined,
    }));
    if (day.start && day.kind === 'city') stops.push({ id: '__start', lat: day.start.lat, lon: day.start.lon, color: colors.vistula, kind: 'me' });
    return stops;
  }, [day]);
  // Mapbox draws a walk; a day with a tram or taxi leg keeps its straight stop-to-stop lines.
  const realLine = real && day && walkedEndToEnd(day) ? real.coordinates : null;
  const route = realLine ?? (day?.kind === 'city' ? day.route : undefined);
  const dayTotal = day ? shownTotal(day, real) : 0;

  const anyAffiliate = experiences.some((x) => x.booking.affiliate);
  const remembrance = form.interests.includes('remembrance');

  const toggle = (k: Interest) =>
    setForm((f) => ({ ...f, interests: f.interests.includes(k) ? f.interests.filter((x) => x !== k) : [...f.interests, k] }));
  const show = (o: PlanOptions) => {
    setShareNote(null);
    router.setParams({ ...planToParams(o) });
  };
  const build = () => show({ ...form, exclude: [] });
  const skipStop = (id: string) => {
    if (options) show({ ...options, exclude: [...(options.exclude ?? []), id] });
  };
  const restoreSkipped = () => {
    if (options) show({ ...options, exclude: [] });
  };
  const startHere = async () => {
    const loc = await me.locate();
    if (loc.status === 'ok' && loc.coords && !loc.outsideCity) {
      const { lat, lon } = loc.coords;
      setForm((f) => ({ ...f, start: { lat: +lat.toFixed(3), lon: +lon.toFixed(3) } }));
    }
  };
  const shiftDate = (n: number) =>
    setForm((f) => {
      const min = parseISODate(today)!;
      const next = addDays(parseISODate(f.startDate) ?? min, n);
      return { ...f, startDate: toISODate(next < min ? min : next) };
    });
  const share = async () => {
    if (!options) return;
    const url = Linking.createURL('/plan', { queryParams: shareableParams(options) });
    const result = await shareLink('My Kraków walking plan', url);
    setShareNote(result === 'copied' ? 'Link copied.' : result === 'failed' ? `Copy this link: ${url}` : null);
  };

  const locationNote =
    me.status === 'asking'
      ? 'Finding you…'
      : me.status === 'ok' && me.outsideCity
        ? 'You seem to be outside Kraków, so days start at the first sight.'
        : me.message ?? null;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TopBar title="Plan my days" />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.col}>
          <Text style={s.q}>How many days are you in Kraków?</Text>
          <View style={s.row}>
            {DAY_OPTIONS.map((n) => (
              <Chip key={n} label={n === 1 ? '1 day' : `${n} days`} active={form.days === n} onPress={() => setForm((f) => ({ ...f, days: n }))} />
            ))}
          </View>

          <Text style={s.q}>When do you arrive?</Text>
          <View style={s.row}>
            <Chip label="No dates yet" active={!form.startDate} onPress={() => setForm((f) => ({ ...f, startDate: undefined }))} />
            {form.startDate ? (
              <>
                <Chip label="‹ Earlier" active={false} onPress={() => shiftDate(-1)} />
                <Chip label={dayLabel(form.startDate)} active onPress={() => undefined} />
                <Chip label="Later ›" active={false} onPress={() => shiftDate(1)} />
              </>
            ) : (
              <Chip label="Pick a date" active={false} onPress={() => shiftDate(0)} />
            )}
          </View>
          {form.startDate ? (
            <Text style={s.note}>Places closed on the day are left out, using opening hours from OpenStreetMap.</Text>
          ) : null}

          <Text style={s.q}>What do you enjoy?</Text>
          <View style={s.row}>
            {INTERESTS.map((i) => (
              <Chip key={i.key} label={i.label} active={form.interests.includes(i.key)} onPress={() => toggle(i.key)} />
            ))}
          </View>
          {remembrance ? (
            <Text style={s.note}>
              {form.dayTrips && form.days >= 2
                ? 'Auschwitz-Birkenau takes a full day. Entry cards come only from the official website, visit.auschwitz.org.'
                : 'To add a day at Auschwitz-Birkenau, choose 2 or more days and turn on day trips.'}
            </Text>
          ) : null}

          <Text style={s.q}>How much in a day?</Text>
          <View style={s.row}>
            {PACES.map((p) => (
              <Chip key={p.key} label={p.label} active={form.pace === p.key} onPress={() => setForm((f) => ({ ...f, pace: p.key }))} />
            ))}
          </View>

          <Text style={s.q}>Where do your days start?</Text>
          <View style={s.row}>
            <Chip label="At the first sight" active={!form.start} onPress={() => setForm((f) => ({ ...f, start: undefined }))} />
            <Chip label={me.status === 'asking' ? 'Finding you…' : 'Where I am now'} active={!!form.start} onPress={startHere} />
          </View>
          {locationNote ? <Text style={s.note}>{locationNote}</Text> : null}
          {form.start ? (
            <Text style={s.note}>Each day starts and ends here, for example at your hotel. A shared link shows this point to about 100 m.</Text>
          ) : null}

          <View style={s.switchRow}>
            <Text style={[s.q, { marginTop: 0, flex: 1 }]}>Include day trips out of the city</Text>
            <Switch
              value={form.dayTrips}
              onValueChange={(v) => setForm((f) => ({ ...f, dayTrips: v }))}
              trackColor={{ true: colors.ink, false: colors.line }}
              thumbColor={colors.paper}
              accessibilityLabel="Include day trips out of the city"
            />
          </View>

          <Button label={plan ? 'Rebuild my loops' : 'Build my loops'} onPress={build} style={{ marginTop: space.l }} />
        </View>

        {plan && !day ? <Text style={[s.col, s.note]}>Nothing fits these choices. Try another pace or more interests.</Text> : null}

        {plan && day && options ? (
          <View style={[s.col, { marginTop: space.l }]}>
            <View style={s.row}>
              {plan.map((d, i) => (
                <Chip
                  key={d.index}
                  label={d.date ? `Day ${d.index} · ${dayLabel(d.date)}` : `Day ${d.index}`}
                  active={i === dayIdx}
                  onPress={() => setDaySel({ key: planKey, index: i })}
                />
              ))}
            </View>
            <View style={[s.row, { marginTop: space.s }]}>
              <Button label="Share this plan" kind="quiet" onPress={share} />
              {options.exclude?.length ? (
                <Button label={`Bring back skipped (${options.exclude.length})`} kind="quiet" onPress={restoreSkipped} />
              ) : null}
            </View>
            {shareNote ? (
              <Text style={s.note} selectable>
                {shareNote}
              </Text>
            ) : null}

            <Text style={s.dayTitle}>{day.title}</Text>
            {day.kind === 'city' ? (
              <Eyebrow>
                {day.stops.length} stops · {fmt(walkTotal(day, real))} walking
                {day.transitMinutes ? ` · ${fmt(day.transitMinutes)} by tram or taxi` : ''} · {fmt(day.visitMinutes)} visiting
              </Eyebrow>
            ) : (
              <Eyebrow>Full day out of Kraków · about {fmt(day.travelMinutes)} each way by road</Eyebrow>
            )}
            {dayTotal > day.budgetMinutes ? (
              <Text style={s.warn}>
                A long day: about {fmt(dayTotal)} with travel, more than the {options.pace} pace allows ({fmt(day.budgetMinutes)}).
              </Text>
            ) : null}
            {day.closed.length ? (
              <Text style={s.note}>Closed that day, so left out: {day.closed.map((p) => p.name).join(', ')}.</Text>
            ) : null}

            <View style={s.mapBox}>
              <LoopMap
                key={mapKey}
                style={s.map}
                points={points}
                route={route}
                fit
                onError={setMapError}
                onReady={() => setMapError(null)}
              />
              {mapError ? (
                <View style={s.mapError}>
                  <Text style={s.stopName}>The map didn’t load</Text>
                  <Text style={s.stopBlurb}>{mapError} The plan below still works.</Text>
                  <Button
                    label="Try again"
                    kind="quiet"
                    onPress={() => {
                      setMapError(null);
                      setMapKey((k) => k + 1);
                    }}
                  />
                </View>
              ) : null}
            </View>

            {day.start && day.kind === 'city' ? <Text style={s.leg}>Start at your chosen point</Text> : null}
            {day.stops.map((st, i) => {
              const hours = hoursThatDay(st.place.id, day.date);
              return (
                <View key={st.place.id}>
                  {st.leg ? <Text style={s.leg}>{legText(st.leg, realMinutes(day, real, i))}</Text> : null}
                  <View style={s.stop}>
                    {day.kind === 'city' ? (
                      <View style={s.num}>
                        <Text style={s.numText}>{i + 1}</Text>
                      </View>
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={s.stopName}>{st.place.name}</Text>
                      <Text style={s.stopBlurb}>{st.place.blurb}</Text>
                      <Eyebrow style={{ marginTop: 4 }}>
                        About {fmt(st.place.minutes)}
                        {hours ? ` · that day ${hours}` : ''}
                      </Eyebrow>
                      <View style={s.stopLinks}>
                        {st.place.booking ? (
                          <Pressable accessibilityRole="link" onPress={() => openLink(st.place.booking!.url)}>
                            <Text style={s.link}>
                              {st.place.booking.label}
                              {st.place.booking.affiliate ? ' · affiliate link' : ''}
                            </Text>
                          </Pressable>
                        ) : null}
                        <Pressable accessibilityRole="button" onPress={() => skipStop(st.place.id)} hitSlop={6}>
                          <Text style={s.skip}>Skip this stop</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
            {day.returnLeg ? (
              <Text style={s.leg}>
                {day.start ? 'Back to your start' : 'Back to stop 1'}: {legText(day.returnLeg, realMinutes(day, real, day.stops.length))}
              </Text>
            ) : null}

            <Text style={s.small}>
              {real
                ? realLine
                  ? 'Walking route and times: Mapbox.'
                  : 'Walking times: Mapbox.'
                : `Walking times are estimates: straight-line distance plus ${Math.round((DETOUR - 1) * 100)}%.`}{' '}
              Trams: ZTP Kraków timetable ({TRANSIT_FEED_VERSION}), without live delays. Day-trip travel is an estimate. Opening
              hours: OpenStreetMap, public holidays not included. Check before you go.
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
  warn: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20, color: colors.brick, marginTop: space.s },
  dayTitle: { fontFamily: fonts.bodyBold, fontSize: 24, color: colors.ink, marginTop: space.m, marginBottom: 4 },
  mapBox: { height: 320, marginVertical: space.m, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  map: { flex: 1 },
  mapError: { position: 'absolute', left: space.s, right: space.s, top: space.s, backgroundColor: colors.paper, borderRadius: 12, padding: space.m, gap: space.s },
  stop: { flexDirection: 'row', gap: space.m, backgroundColor: colors.paper, borderRadius: 14, padding: space.m, borderWidth: 1, borderColor: colors.line },
  num: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.gilt },
  stopName: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  stopBlurb: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink, marginTop: 2 },
  stopLinks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.m, marginTop: space.s },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.vistula },
  skip: { fontFamily: fonts.body, fontSize: 14, color: colors.mute, textDecorationLine: 'underline' },
  leg: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.mute, paddingVertical: space.s, paddingLeft: 30 },
  small: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.mute, marginTop: space.m },
  extra: { backgroundColor: colors.paper, borderRadius: 14, padding: space.m, borderWidth: 1, borderColor: colors.line, marginBottom: space.s },
});
