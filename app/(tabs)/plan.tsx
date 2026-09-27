import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTabBarSpace, WEB_TABS_TOP } from '../../src/lib/useTabBarSpace';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import LoopMap from '../../src/components/LoopMap';
import { placeName, placeText } from '../../src/components/placeName';
import type { MapPoint } from '../../src/components/mapHtml';
import { Button, Chip } from '../../src/components/ui';
import { AFFILIATE_NOTE } from '../../src/config/affiliates';
import { CITY } from '../../src/config/city';
import { RideButtons } from '../../src/components/RideButtons';
import { CATEGORY_COLOR } from '../../src/data/categoryColor';
import { PLACE_MEDIA } from '../../src/data/placeMedia';
import { Experience, experiences, places } from '../../src/data/places';
import { addDays, formatDay, parseISODate, toISODate } from '../../src/lib/dates';
import { WALKING_ROUTES_ENABLED, WalkingRoute, walkingRoute } from '../../src/lib/directions';
import { DETOUR } from '../../src/lib/geo';
import { formatHours, hoursOn } from '../../src/lib/hours';
import type { Leg } from '../../src/lib/legs';
import { openLink } from '../../src/lib/openLink';
import { paramsToPlan, planToParams, shareUrl } from '../../src/lib/planParams';
import { Interest, MAX_PLAN_DAYS, PACE_LIMITS, Pace, PlanDay, PlanOptions, buildPlan, newSeed } from '../../src/lib/planner';
import { realMinutes, shownTotal, walkTotal, walkedEndToEnd } from '../../src/lib/planView';
import { shareLink } from '../../src/lib/share';
import { applyIntent } from '../../src/lib/wish';
import { readWishAnywhere } from '../../src/lib/wishProxy';
import { WISH_MAX_CHARS, WISH_PROXY_URL } from '../../src/config/wish';
import { TRANSIT_FEED_VERSION } from '../../src/lib/transit';
import { useMyLocation } from '../../src/lib/useMyLocation';
import { t } from '../../src/i18n';
import { colors, fonts, space } from '../../src/theme';

const INTERESTS: { key: Interest; label: string }[] = [
  { key: 'history', label: t('plan.interest.history') },
  { key: 'museums', label: t('plan.interest.museums') },
  { key: 'jewish', label: t('plan.interest.jewish') },
  { key: 'views', label: t('plan.interest.views') },
  { key: 'food', label: t('plan.interest.food') },
  { key: 'remembrance', label: t('plan.interest.remembrance') },
];
const PACES: { key: Pace; label: string }[] = [
  { key: 'easy', label: t('plan.pace.easy') },
  { key: 'steady', label: t('plan.pace.steady') },
  { key: 'full', label: t('plan.pace.full') },
];
const DAY_OPTIONS = Array.from({ length: MAX_PLAN_DAYS }, (_, i) => i + 1);
const KNOWN_IDS: ReadonlySet<string> = new Set(places.map((p) => p.id));
const DEFAULT_FORM: PlanOptions = { days: 2, pace: 'steady', interests: ['history', 'food'], dayTrips: true };
const EXPERIENCE_BY_ID = new Map(experiences.map((x) => [x.id, x]));

const fmt = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);

function legText(l: Leg, realWalkMinutes: number | null): string {
  if (l.mode === 'walk') return t('leg.walk', { time: fmt(realWalkMinutes ?? l.minutes) });
  if (l.mode === 'tram' && l.tram) {
    const tram = l.tram;
    return t('leg.tram', {
      line: tram.line,
      headsign: tram.headsign,
      from: tram.from,
      to: tram.to,
      stops: tram.stopCount === 1 ? t('leg.stop.one') : t('leg.stop.many', { n: tram.stopCount }),
      time: fmt(tram.minutes),
      foot: fmt(l.onFootMinutes),
    });
  }
  return t('leg.taxi', { time: fmt(l.minutes), foot: fmt(l.onFootMinutes) });
}

const LEG_ICON = { walk: 'walk', tram: 'tram', taxi: 'taxi' } as const;

/** "Mon 12 Oct", or the raw value if it isn't a valid date */
function dayLabel(iso: string | undefined): string {
  const d = parseISODate(iso);
  return d ? formatDay(d) : iso ?? '';
}

function hoursThatDay(placeId: string, date: string | undefined): string | null {
  const d = parseISODate(date);
  return d ? formatHours(hoursOn(placeId, d)) : null;
}

/** "2 days · Steady · History, Museums · from Mon 12 Oct" */
function summary(o: PlanOptions): string {
  const parts = [
    o.days === 1 ? t('plan.days.one') : t('plan.days.many', { n: o.days }),
    PACES.find((p) => p.key === o.pace)?.label ?? o.pace,
    o.interests.length ? INTERESTS.filter((i) => o.interests.includes(i.key)).map((i) => i.label).join(', ') : t('plan.topSights'),
  ];
  if (o.startDate) parts.push(t('plan.fromDate', { date: dayLabel(o.startDate) }));
  if (o.start) parts.push(t('plan.fromStart'));
  return parts.join(' · ');
}

/** "History, Food · first sight · day trips": what the closed Preferences row stands for */
function prefsSummary(o: PlanOptions): string {
  const likes = o.interests.length ? INTERESTS.filter((i) => o.interests.includes(i.key)).map((i) => i.label).join(', ') : t('plan.topSights');
  return [likes, o.start ? t('plan.whereIAm') : t('plan.atFirst'), o.dayTrips ? t('plan.withTrips') : t('plan.noTrips')].join(' · ');
}

/** A large tappable row that is either chosen or not: one pace, or one interest among several. */
function ChoiceRow({ label, line, chosen, onPress, kind }: { label: string; line?: string; chosen: boolean; onPress: () => void; kind: 'radio' | 'checkbox' }) {
  const icon = kind === 'radio' ? (chosen ? 'radiobox-marked' : 'radiobox-blank') : chosen ? 'checkbox-marked' : 'checkbox-blank-outline';
  return (
    <Pressable
      accessibilityRole={kind}
      accessibilityLabel={label}
      aria-checked={chosen}
      onPress={onPress}
      style={({ pressed }) => [s.choice, chosen && s.choiceOn, pressed && { opacity: 0.8 }]}
    >
      <View aria-hidden importantForAccessibility="no-hide-descendants">
        <MaterialCommunityIcons name={icon} size={26} color={colors.ink} />
      </View>
      <View style={s.choiceText}>
        <Text style={s.choiceLabel}>{label}</Text>
        {line ? <Text style={s.choiceLine}>{line}</Text> : null}
      </View>
    </Pressable>
  );
}

export default function PlanScreen() {
  const tabSpace = useTabBarSpace();
  const { days, pace, likes, trips, date, from, skip, seed, acts, walk: walkWish, dine } = useLocalSearchParams<{
    days?: string;
    pace?: string;
    likes?: string;
    trips?: string;
    date?: string;
    from?: string;
    skip?: string;
    seed?: string;
    acts?: string;
    walk?: string;
    dine?: string;
  }>();
  const options = useMemo(
    () => paramsToPlan({ days, pace, likes, trips, date, from, skip, seed, acts, walk: walkWish, dine }, KNOWN_IDS),
    [days, pace, likes, trips, date, from, skip, seed, acts, walkWish, dine],
  );
  const plan = useMemo(() => (options ? buildPlan(options) : null), [options]);
  const planKey = options ? JSON.stringify(options) : '';
  const hasPlan = !!plan && plan.length > 0;

  // The form belongs to the plan in the URL: a different plan arriving (a shared link, a skipped
  // stop, a rebuild) refills it, so "Build a new plan" never overwrites it with stale choices.
  const [formState, setFormState] = useState(() => ({ key: planKey, form: options ?? DEFAULT_FORM }));
  if (options && formState.key !== planKey) setFormState({ key: planKey, form: { ...options, exclude: [] } });
  const form = formState.form;
  const setForm = (update: (f: PlanOptions) => PlanOptions) => setFormState((st) => ({ key: st.key, form: update(st.form) }));

  const [editing, setEditing] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [wish, setWish] = useState('');
  const [wishNote, setWishNote] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [today] = useState(() => toISODate(new Date()));
  const [daySel, setDaySel] = useState({ key: '', index: 0 });
  const [walk, setWalk] = useState<{ key: string; route: WalkingRoute } | null>(null);
  const [mapOpen, setMapOpen] = useState(true);
  const [mapLive, setMapLive] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const me = useMyLocation();

  const showQuick = !hasPlan && !editing;
  const showForm = editing;
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
      label: placeName(st.place),
    }));
    if (day.start && day.kind === 'city') stops.push({ id: '__start', lat: day.start.lat, lon: day.start.lon, color: colors.vistula, kind: 'me' });
    // a day trip is shown with Kraków, so the map says how far the day goes instead of showing a few streets
    if (day.kind === 'trip') stops.push({ id: '__krakow', lat: CITY.centre.lat, lon: CITY.centre.lon, color: colors.vistula, kind: 'me', label: 'Kraków' });
    return stops;
  }, [day]);
  // Mapbox draws a walk; a day with a tram or taxi leg keeps its straight stop-to-stop lines.
  const realLine = real && day && walkedEndToEnd(day) ? real.coordinates : null;
  const route = realLine ?? (day?.kind === 'city' ? day.route : undefined);
  const dayTotal = day ? shownTotal(day, real) : 0;

  const dayActivities = (options?.activities ?? []).filter((a) => day && a.day === day.index).map((a) => EXPERIENCE_BY_ID.get(a.id)!).filter(Boolean);
  const anyAffiliate = experiences.some((x) => x.booking.affiliate);
  const remembrance = form.interests.includes('remembrance');

  const toggle = (k: Interest) =>
    setForm((f) => ({ ...f, interests: f.interests.includes(k) ? f.interests.filter((x) => x !== k) : [...f.interests, k] }));
  const show = (o: PlanOptions, announcement: string, stay = false) => {
    setShareNote(null);
    setEditing(false);
    router.setParams({ ...planToParams(o) });
    if (!stay) scrollRef.current?.scrollTo({ y: 0, animated: false });
    AccessibilityInfo.announceForAccessibility(announcement);
  };
  // every build is shuffled anew: the same choices should not give the same days every time
  // activities the traveller chose (or wished for in their own words) stay; skipped stops do not
  const build = () => show({ ...form, exclude: [], seed: newSeed() }, t('plan.ready'));
  // one tap on a number of days: a plan straight away, with the usual mix, tuned later if wanted
  const quick = (n: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    show({ ...form, days: n, exclude: [], seed: newSeed() }, t('plan.ready'));
  };
  const another = () => {
    if (options) show({ ...options, exclude: [], seed: newSeed() }, t('plan.anotherReady'));
  };
  const skipStop = (id: string, name: string) => {
    if (!options) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    show({ ...options, exclude: [...(options.exclude ?? []), id] }, t('plan.skipped', { name }), true);
  };
  const restoreSkipped = () => {
    if (options) show({ ...options, exclude: [] }, t('plan.restored'));
  };
  const addActivity = (x: Experience) => {
    if (!options || !day) return;
    setPickerOpen(false);
    show({ ...options, activities: [...(options.activities ?? []), { day: day.index, id: x.id }] }, t('plan.activityAdded', { name: x.name, n: day.index }));
  };
  const removeActivity = (x: Experience) => {
    if (!options || !day) return;
    show({ ...options, activities: (options.activities ?? []).filter((a) => !(a.day === day.index && a.id === x.id)) }, t('plan.activityRemoved', { name: x.name }));
  };
  /**
   * The traveller writes what they want; the reading turns it into the same settings the chips
   * below set. The plan itself is still built by the planner from the app's own places.
   */
  const readTheWish = async () => {
    if (!wish.trim() || reading) return;
    setReading(true);
    setWishNote(null);
    try {
      const { intent, understood } = await readWishAnywhere(wish);
      if (!understood) {
        setWishNote(t('wish.notUnderstood'));
        AccessibilityInfo.announceForAccessibility(t('wish.notUnderstood'));
        return;
      }
      setForm((f) => applyIntent(f, intent));
      setPrefsOpen(true);
      const note = t('wish.understood');
      setWishNote(note);
      AccessibilityInfo.announceForAccessibility(note);
    } finally {
      setReading(false);
    }
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
    const url = shareUrl(Linking.createURL('/plan'), options);
    const result = await shareLink(t('plan.shareTitle'), url);
    const note = result === 'copied' ? t('plan.copied') : result === 'failed' ? t('plan.copyThis', { url }) : null;
    setShareNote(note);
    if (note) AccessibilityInfo.announceForAccessibility(note);
  };

  const locationNote =
    me.status === 'asking'
      ? t('walk.findingYou')
      : me.status === 'ok' && me.outsideCity
        ? t('plan.outside')
        : me.message ?? null;

  const result = hasPlan && !editing && day && options;

  return (
    <SafeAreaView style={[s.safe, { paddingTop: WEB_TABS_TOP }]} edges={['top']}>
      <Text style={s.bigTitle} accessibilityRole="header">
        {hasPlan && !editing ? t('plan.native.yours') : t('plan.native.title')}
      </Text>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={StyleSheet.flatten([s.scroll, result && s.scrollWithBar, { paddingBottom: (result ? 150 : space.xl) + tabSpace }])}>
        {hasPlan && !editing && options ? (
          <View style={[s.col, s.summaryBar]}>
            <View style={{ flex: 1 }}>
              {/* the big title already says "your plan": here only what it is made of */}
              <Text style={s.summaryText}>{summary(options)}</Text>
            </View>
            <Button label={t('plan.change')} kind="quiet" onPress={() => setEditing(true)} />
          </View>
        ) : null}

        {showQuick ? (
          <View style={s.col}>
            <Text style={s.quickQ}>{t('plan.native.howMany')}</Text>
            <View style={s.quickGrid}>
              {DAY_OPTIONS.map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityLabel={n === 1 ? t('plan.days.one') : t('plan.days.many', { n })}
                  onPress={() => quick(n)}
                  style={({ pressed }) => [s.quickTile, pressed && s.quickPressed]}
                >
                  <Text style={s.quickNum}>{n}</Text>
                  <Text style={s.quickWord}>{n === 1 ? t('plan.dayWord.one') : t('plan.dayWord.many')}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.note}>{t('plan.native.quickNote')}</Text>
            <Button label={t('plan.native.tune')} kind="quiet" onPress={() => setEditing(true)} />
          </View>
        ) : null}

        {showForm ? (
          <View style={s.col}>
            <Text style={s.q}>{t('wish.title')}</Text>
            <TextInput
              value={wish}
              onChangeText={setWish}
              placeholder={t('wish.placeholder')}
              placeholderTextColor={colors.mute}
              style={s.wishBox}
              accessibilityLabel={t('wish.title')}
              multiline
              maxLength={WISH_MAX_CHARS}
              textAlignVertical="top"
            />
            <View style={s.wishRow}>
              <Button label={reading ? t('wish.reading') : t('wish.read')} kind="quiet" onPress={readTheWish} style={s.grow} />
            </View>
            <Text style={s.note}>{WISH_PROXY_URL ? t('wish.noteModel') : t('wish.notePhone')}</Text>
            {wishNote ? (
              <Text style={s.wishNote} accessibilityLiveRegion="polite">
                {wishNote}
              </Text>
            ) : null}

            <Text style={s.q}>{t('plan.q.arrive')}</Text>
            <View style={s.row}>
              <Chip label={t('plan.noDates')} active={!form.startDate} onPress={() => setForm((f) => ({ ...f, startDate: undefined }))} />
              {form.startDate ? (
                <>
                  <Chip label={t('plan.earlier')} active={false} onPress={() => shiftDate(-1)} />
                  <Chip label={dayLabel(form.startDate)} active onPress={() => undefined} />
                  <Chip label={t('plan.later')} active={false} onPress={() => shiftDate(1)} />
                </>
              ) : (
                <Chip label={t('plan.pickDate')} active={false} onPress={() => shiftDate(0)} />
              )}
            </View>
            {form.startDate ? <Text style={s.note}>{t('plan.closedNote')}</Text> : null}

            <Text style={s.q}>{t('plan.q.days')}</Text>
            <View style={s.dayGrid}>
              {DAY_OPTIONS.map((n) => {
                const label = n === 1 ? t('plan.days.one') : t('plan.days.many', { n });
                const on = form.days === n;
                return (
                  <Pressable
                    key={n}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    aria-pressed={on}
                    onPress={() => setForm((f) => ({ ...f, days: n }))}
                    style={({ pressed }) => [s.dayBox, on && s.dayBoxOn, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={[s.dayNum, on && s.onInk]}>{n}</Text>
                    <Text style={[s.dayWord, on && s.onInk]}>{n === 1 ? t('plan.dayWord.one') : t('plan.dayWord.many')}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={s.q}>{t('plan.q.pace')}</Text>
            <View style={s.stack}>
              {PACES.map((p) => (
                <ChoiceRow
                  key={p.key}
                  kind="radio"
                  label={p.label}
                  line={t('plan.paceLine', { stops: PACE_LIMITS[p.key].maxStops, hours: PACE_LIMITS[p.key].budgetMinutes / 60 })}
                  chosen={form.pace === p.key}
                  onPress={() => setForm((f) => ({ ...f, pace: p.key }))}
                />
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              aria-expanded={prefsOpen}
              onPress={() => setPrefsOpen((v) => !v)}
              style={({ pressed }) => [s.prefs, pressed && { opacity: 0.85 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.prefsTitle}>{t('plan.prefs')}</Text>
                <Text style={s.prefsLine}>{prefsSummary(form)}</Text>
              </View>
              <View aria-hidden importantForAccessibility="no-hide-descendants">
                <MaterialCommunityIcons name={prefsOpen ? 'chevron-up' : 'chevron-down'} size={28} color={colors.ink} />
              </View>
            </Pressable>

            {prefsOpen ? (
              <View style={s.prefsBody}>
                <Text style={s.subQ}>{t('plan.q.enjoy')}</Text>
                <View style={s.stack}>
                  {INTERESTS.map((i) => (
                    <ChoiceRow key={i.key} kind="checkbox" label={i.label} chosen={form.interests.includes(i.key)} onPress={() => toggle(i.key)} />
                  ))}
                </View>
                {remembrance ? <Text style={s.note}>{form.dayTrips && form.days >= 3 ? t('plan.auschwitzYes') : t('plan.auschwitzNo')}</Text> : null}

                <Text style={s.subQ}>{t('plan.q.start')}</Text>
                <View style={s.row}>
                  <Chip label={t('plan.atFirst')} active={!form.start} onPress={() => setForm((f) => ({ ...f, start: undefined }))} />
                  <Chip label={me.status === 'asking' ? t('walk.findingYou') : t('plan.whereIAm')} active={!!form.start} onPress={startHere} />
                </View>
                {locationNote ? <Text style={s.note}>{locationNote}</Text> : null}
                {form.start ? <Text style={s.note}>{t('plan.startNote')}</Text> : null}

                <View style={s.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.subQ}>{t('plan.dayTrips')}</Text>
                    <Text style={s.note}>{t('plan.tripsRule')}</Text>
                  </View>
                  <Switch
                    value={form.dayTrips}
                    onValueChange={(v) => setForm((f) => ({ ...f, dayTrips: v }))}
                    trackColor={{ true: colors.ink, false: colors.line }}
                    thumbColor={colors.paper}
                    accessibilityLabel={t('plan.dayTrips')}
                  />
                </View>
              </View>
            ) : null}

            <View style={s.formActions}>
              <Button label={hasPlan ? t('plan.rebuild') : t('plan.build')} onPress={build} style={{ flexGrow: 2 }} />
              {editing ? <Button label={t('plan.keep')} kind="quiet" onPress={() => setEditing(false)} style={{ flexGrow: 1 }} /> : null}
            </View>
          </View>
        ) : null}

        {plan && !hasPlan ? <Text style={[s.col, s.note]}>{t('plan.nothing')}</Text> : null}

        {result ? (
          <View style={[s.col, { marginTop: space.m }]}>
            <View style={s.row}>
              {plan!.map((d, i) => (
                <Chip
                  key={d.index}
                  label={d.date ? t('plan.dayDate', { n: d.index, date: dayLabel(d.date) }) : t('plan.day', { n: d.index })}
                  active={i === dayIdx}
                  onPress={() => {
                    setDaySel({ key: planKey, index: i });
                    setPickerOpen(false);
                  }}
                />
              ))}
            </View>

            {mapOpen ? (
              <View style={s.mapBox}>
                <View style={s.map} pointerEvents={mapLive ? 'auto' : 'none'}>
                  <LoopMap key={mapKey} style={s.map} points={points} route={route} fit onError={setMapError} onReady={() => setMapError(null)} />
                </View>
                {/* a finger on the map scrolls the page; one tap hands the map to the finger, one more gives it back */}
                {!mapLive ? <Pressable accessibilityRole="button" accessibilityLabel={t('plan.native.mapTouch')} onPress={() => setMapLive(true)} style={StyleSheet.absoluteFill} /> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setMapLive((v) => !v);
                  }}
                  style={({ pressed }) => [s.mapChip, pressed && { opacity: 0.85 }]}
                >
                  <MaterialCommunityIcons name={mapLive ? 'lock-outline' : 'gesture-tap'} size={18} color={colors.white} />
                  <Text style={s.mapChipText}>{mapLive ? t('plan.native.mapDone') : t('plan.native.mapTouch')}</Text>
                </Pressable>
                {mapError ? (
                  <View style={s.mapError}>
                    <Text style={s.stopName}>{t('map.errorTitle')}</Text>
                    <Text style={s.stopBlurb}>{t('plan.mapStill', { message: mapError })}</Text>
                    <Button
                      label={t('map.tryAgain')}
                      kind="quiet"
                      onPress={() => {
                        setMapError(null);
                        setMapKey((k) => k + 1);
                      }}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            <Text style={s.dayTitle} accessibilityRole="header">
              {day.kind === 'trip' ? placeName(day.stops[0].place) : day.title}
            </Text>
            <Text style={s.totals}>
              {day.kind === 'city'
                ? t('plan.dayTotals', { stops: day.stops.length, total: fmt(dayTotal), walk: fmt(walkTotal(day, real)) })
                : t('plan.tripTotals', { travel: fmt(day.travelMinutes), stay: fmt(day.visitMinutes), total: fmt(day.totalMinutes) })}
            </Text>
            {dayTotal > day.budgetMinutes ? (
              <Text style={s.warn}>
                {t('plan.longDay', {
                  total: fmt(dayTotal),
                  pace: PACES.find((p) => p.key === options.pace)?.label ?? options.pace,
                  budget: fmt(day.budgetMinutes),
                })}
              </Text>
            ) : null}
            {day.closed.length ? <Text style={s.note}>{t('plan.closedLeftOut', { names: day.closed.map((p) => placeName(p)).join(', ') })}</Text> : null}

            <View style={s.dayActions}>
              <Button label={mapOpen ? t('plan.hideMap') : t('plan.showMap')} kind="quiet" expanded={mapOpen} onPress={() => setMapOpen((v) => !v)} style={s.grow} />
              <Button label={t('plan.addActivity')} kind="quiet" expanded={pickerOpen} onPress={() => setPickerOpen((v) => !v)} style={s.grow} />
            </View>

            {pickerOpen ? (
              <View style={s.picker}>
                <Text style={s.subQ} role="heading" aria-level={2}>
                  {t('plan.pickActivity', { n: day.index })}
                </Text>
                <Text style={s.note}>{t('plan.arrangeNote')}</Text>
                {experiences
                  .filter((x) => !dayActivities.includes(x))
                  .map((x) => (
                    <View key={x.id} style={s.activity}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.stopName}>{x.name}</Text>
                        <Text style={s.stopBlurb}>
                          {x.note}
                          {x.season ? ` ${x.season}.` : ''}
                        </Text>
                      </View>
                      <Button label={t('plan.addToDay', { n: day.index })} accessibilityLabel={t('plan.addNamed', { name: x.name, n: day.index })} onPress={() => addActivity(x)} />
                    </View>
                  ))}
                {anyAffiliate ? <Text style={s.small}>{AFFILIATE_NOTE}</Text> : null}
              </View>
            ) : null}

            {dayActivities.length ? (
              <View style={s.arranged}>
                <Text style={s.subQ} role="heading" aria-level={2}>
                  {t('plan.toArrange')}
                </Text>
                {dayActivities.map((x) => (
                  <View key={x.id} style={s.activity}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.stopName}>{x.name}</Text>
                      <Text style={s.stopBlurb}>{x.note}</Text>
                    </View>
                    <View style={s.activityButtons}>
                      <Button label={t('plan.book')} accessibilityLabel={t('plan.bookNamed', { name: x.name })} onPress={() => openLink(x.booking.url)} />
                      <Button label={t('plan.remove')} kind="quiet" accessibilityLabel={t('plan.removeNamed', { name: x.name })} onPress={() => removeActivity(x)} />
                    </View>
                  </View>
                ))}
                <Text style={s.small}>{t('plan.arrangeNote')}</Text>
              </View>
            ) : null}

            {day.kind === 'trip' ? <TripCard day={day} /> : <Timeline day={day} real={real} onSkip={skipStop} />}

            {options.exclude?.length ? (
              <View style={{ marginTop: space.m }}>
                <Button label={t('plan.bringBack', { n: options.exclude.length })} kind="quiet" onPress={restoreSkipped} />
              </View>
            ) : null}

            <Text style={s.small}>
              {real ? (realLine ? t('plan.srcRoute') : t('plan.srcTimes')) : t('plan.srcEstimate', { pct: Math.round((DETOUR - 1) * 100) })}{' '}
              {t('plan.srcRest', { feed: TRANSIT_FEED_VERSION })}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {result ? (
        // the two actions a finished plan needs most stay in reach, whatever the scroll
        <View style={[s.bar, { bottom: tabSpace }]}>
          {shareNote ? (
            <Text style={s.barNote} selectable>
              {shareNote}
            </Text>
          ) : null}
          <View style={s.barRow}>
            <Button label={t('plan.another')} onPress={another} style={s.barMain} />
            <Button label={t('plan.share')} kind="quiet" onPress={share} style={s.barSide} />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/** A city day as a numbered line of stops, with how to get from one to the next between them. */
function Timeline({ day, real, onSkip }: { day: PlanDay; real: WalkingRoute | null; onSkip: (id: string, name: string) => void }) {
  return (
    <View style={s.timeline}>
      {day.start ? <Text style={s.legText}>{t('plan.startPoint')}</Text> : null}
      {day.stops.map((st, i) => {
        const hours = hoursThatDay(st.place.id, day.date);
        const photo = PLACE_MEDIA[st.place.id];
        return (
          <View key={st.place.id}>
            {st.leg ? (
              <View style={s.leg}>
                <View aria-hidden importantForAccessibility="no-hide-descendants">
                  <MaterialCommunityIcons name={LEG_ICON[st.leg.mode]} size={20} color={colors.mute} />
                </View>
                <Text style={s.legText}>{legText(st.leg, realMinutes(day, real, i))}</Text>
              </View>
            ) : null}
            {/* a taxi leg can be booked where it is shown: the destination is this stop */}
            {st.leg?.mode === 'taxi' ? <RideButtons to={st.place} /> : null}
            {/* a stop as a card: its photo, its number and its name on it, what to know below */}
            <View style={s.card}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t('now.openLabel', { name: placeName(st.place) })}
                onPress={() => router.push(`/place/${st.place.id}`)}
                style={({ pressed }) => [s.cardTop, !photo?.image && s.cardTopPlain, pressed && { opacity: 0.9 }]}
              >
                {photo?.image ? <Image source={photo.image} style={s.cardPhoto} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
                {photo?.image ? <LinearGradient colors={['rgba(8,11,30,0)', 'rgba(8,11,30,0.85)']} locations={[0.35, 1]} style={s.cardPhoto} /> : null}
                <View style={s.num}>
                  <Text style={s.numText}>{i + 1}</Text>
                </View>
                <Text style={s.cardName} numberOfLines={2}>
                  {placeName(st.place)}
                </Text>
              </Pressable>
              <View style={s.cardBody}>
                <Text style={s.stopBlurb} numberOfLines={3}>
                  {placeText(st.place).text}
                </Text>
                <Text style={s.stopMeta}>
                  {t('plan.about', { time: fmt(st.place.minutes) })}
                  {hours ? t('plan.thatDay', { hours }) : ''}
                </Text>
                <View style={s.stopLinks}>
                  {st.place.booking ? (
                    <Pressable accessibilityRole="link" onPress={() => openLink(st.place.booking!.url)} hitSlop={6}>
                      <Text style={s.link}>
                        {st.place.booking.label}
                        {st.place.booking.affiliate ? t('plan.affiliate') : ''}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable accessibilityRole="button" accessibilityLabel={t('plan.skipLabel', { name: placeName(st.place) })} onPress={() => onSkip(st.place.id, placeName(st.place))} hitSlop={8}>
                    <Text style={s.skip}>{t('plan.skip')}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        );
      })}
      {day.returnLeg ? (
        <View style={s.leg}>
          <View aria-hidden importantForAccessibility="no-hide-descendants">
            <MaterialCommunityIcons name={LEG_ICON[day.returnLeg.mode]} size={20} color={colors.mute} />
          </View>
          <Text style={s.legText}>
            {day.start ? t('plan.backStart') : t('plan.backFirst')}: {legText(day.returnLeg, realMinutes(day, real, day.stops.length))}
          </Text>
        </View>
      ) : null}
      {day.returnLeg?.mode === 'taxi' && day.stops[0] ? (
        // back to the chosen start point (a hotel, say, known to about 100 m) or to the first stop
        <RideButtons to={day.start ? { name: t('ride.startPoint'), lat: day.start.lat, lon: day.start.lon } : day.stops[0].place} />
      ) : null}
    </View>
  );
}

/** A day trip as one destination: photo, what the day costs in time, and where to book. */
function TripCard({ day }: { day: PlanDay }) {
  const place = day.stops[0]?.place;
  if (!place) return null;
  const photo = PLACE_MEDIA[place.id];
  return (
    <View style={s.trip}>
      {photo?.image ? <Image source={photo.image} style={s.tripPhoto} resizeMode="cover" accessibilityLabel={t('place.photoAlt', { name: placeName(place) })} /> : null}
      <View style={s.tripBody}>
        <Text style={s.stopBlurb}>{placeText(place).text}</Text>
        <View style={s.stopLinks}>
          {place.booking ? (
            <Button label={place.booking.label} onPress={() => openLink(place.booking!.url)} style={s.grow} />
          ) : null}
          <Link href={`/place/${place.id}`} asChild>
            <Pressable accessibilityRole="link" accessibilityLabel={t('now.openLabel', { name: placeName(place) })} hitSlop={6}>
              <Text style={s.link}>{t('trips.details')}</Text>
            </Pressable>
          </Link>
        </View>
        {place.booking?.affiliate ? <Text style={s.small}>{AFFILIATE_NOTE}</Text> : null}
        {photo?.image ? (
          <Text style={s.photoCredit} numberOfLines={1}>
            {t('ui.photo')}: {photo.credit} · {photo.license}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  bigTitle: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, color: colors.ink, paddingHorizontal: space.m, paddingTop: space.m, paddingBottom: space.s },
  quickQ: { fontFamily: fonts.bodyBold, fontSize: 21, color: colors.ink, marginTop: space.s, marginBottom: space.m },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginBottom: space.m },
  quickTile: { width: '48%', flexGrow: 1, aspectRatio: 1.35, borderRadius: 24, backgroundColor: colors.ink, padding: space.m, justifyContent: 'space-between' },
  quickPressed: { transform: [{ scale: 0.97 }] },
  quickNum: { fontFamily: fonts.display, fontSize: 64, lineHeight: 66, color: colors.white },
  quickWord: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.white },
  scroll: { paddingBottom: space.xl },
  // room under the last stop for the action bar that stays on screen
  scrollWithBar: { paddingBottom: 150 },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.m },
  summaryBar: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingTop: space.s },
  summaryText: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, color: colors.ink, marginTop: 2 },
  q: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink, marginTop: space.l, marginBottom: space.s },
  subQ: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink, marginTop: space.m, marginBottom: space.s },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  stack: { gap: space.s },
  dayGrid: { flexDirection: 'row', gap: space.s },
  dayBox: { flex: 1, minHeight: 76, borderRadius: 16, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  dayBoxOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  dayNum: { fontFamily: fonts.bodyBold, fontSize: 28, lineHeight: 32, color: colors.ink },
  dayWord: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  onInk: { color: colors.white },
  choice: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 60, paddingHorizontal: space.m, paddingVertical: 10, borderRadius: 14, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.paper },
  choiceOn: { borderColor: colors.ink },
  choiceText: { flex: 1, gap: 2 },
  choiceLabel: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  choiceLine: { fontFamily: fonts.body, fontSize: 14, color: colors.mute },
  prefs: { flexDirection: 'row', alignItems: 'center', gap: space.m, marginTop: space.l, minHeight: 64, paddingHorizontal: space.m, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  prefsTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  prefsLine: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.mute, marginTop: 2 },
  prefsBody: { paddingHorizontal: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.s, gap: space.m },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.l },
  note: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.mute, marginTop: space.s },
  warn: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 21, color: colors.brick, marginTop: space.s },
  dayTitle: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, color: colors.ink, marginTop: space.m },
  totals: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink, marginTop: 4 },
  dayActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.m },
  grow: { flexGrow: 1 },
  wishBox: {
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingHorizontal: space.m,
    paddingVertical: 12,
    fontFamily: fonts.body,
    fontSize: 17,
    lineHeight: 24,
    color: colors.ink,
  },
  wishRow: { flexDirection: 'row', gap: space.s, marginTop: space.s },
  wishNote: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 21, color: colors.ink, marginTop: space.s },
  card: { marginTop: space.s, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  cardTop: { height: 200, justifyContent: 'flex-end', padding: space.m, backgroundColor: colors.ink },
  cardTopPlain: { height: 120 },
  cardPhoto: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  cardName: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, color: colors.white },
  cardBody: { padding: space.m, gap: 6 },
  mapBox: { height: 300, marginTop: space.m, borderRadius: 24, overflow: 'hidden' },
  map: { flex: 1 },
  mapChip: { position: 'absolute', left: space.s, bottom: space.s, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(14,19,48,0.82)' },
  mapChipText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  mapError: { position: 'absolute', left: space.s, right: space.s, top: space.s, backgroundColor: colors.paper, borderRadius: 12, padding: space.m, gap: space.s },
  picker: { marginTop: space.m, backgroundColor: colors.paper, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: space.m },
  arranged: { marginTop: space.m, backgroundColor: colors.paper, borderRadius: 16, borderWidth: 2, borderColor: colors.gilt, padding: space.m },
  activity: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.s, paddingVertical: space.s, borderBottomWidth: 1, borderColor: colors.line },
  activityButtons: { flexDirection: 'row', gap: space.s },
  timeline: { marginTop: space.m },
  leg: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 6, marginLeft: 14, borderLeftWidth: 3, borderColor: colors.line },
  legText: { flex: 1, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.mute },
  stop: { flexDirection: 'row', gap: space.m, alignItems: 'flex-start', paddingVertical: space.s },
  num: { position: 'absolute', top: 12, left: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  // white is the text-on-ink token in every palette; gilt on ink fails contrast in several
  numText: { fontFamily: fonts.monoBold, fontSize: 15, color: colors.ink },
  thumb: { width: 76, height: 76, borderRadius: 12, backgroundColor: colors.line },
  stopName: { fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 23, color: colors.ink },
  stopNameLink: { textDecorationLine: 'underline', textDecorationColor: colors.line },
  stopBlurb: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink, marginTop: 2 },
  stopMeta: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.mute, marginTop: 4 },
  photoCredit: { fontFamily: fonts.body, fontSize: 11, color: colors.mute, marginTop: 6 },
  stopLinks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.m, rowGap: space.s, marginTop: space.s },
  link: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.vistula },
  skip: { fontFamily: fonts.body, fontSize: 15, color: colors.mute, textDecorationLine: 'underline' },
  trip: { marginTop: space.m, backgroundColor: colors.paper, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  tripPhoto: { width: '100%', height: 200, backgroundColor: colors.line },
  tripBody: { padding: space.m, gap: 4 },
  small: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.mute, marginTop: space.m },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.paper, borderTopWidth: 1, borderColor: colors.line, paddingHorizontal: space.m, paddingTop: space.s, paddingBottom: space.s },
  barNote: { fontFamily: fonts.body, fontSize: 13, color: colors.ink, marginBottom: 6 },
  barRow: { flexDirection: 'row', gap: space.s, width: '100%', maxWidth: 560, alignSelf: 'center' },
  barMain: { flexGrow: 2 },
  barSide: { flexGrow: 1 },
});
