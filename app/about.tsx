import { useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBar } from '../src/components/ui';
import { MAP_PROVIDER } from '../src/components/mapHtml';
import { AFFILIATE_NOTE } from '../src/config/affiliates';
import { lensPoints } from '../src/data/lens';
import { PLACE_MEDIA } from '../src/data/placeMedia';
import { placeById } from '../src/data/places';
import { WALKING_ROUTES_ENABLED } from '../src/lib/directions';
import { HOURS_EXPORTED } from '../src/lib/hours';
import { openLink } from '../src/lib/openLink';
import { TRANSIT_FEED_VERSION } from '../src/lib/transit';
import { colors, fonts, space } from '../src/theme';

interface Credit {
  key: string;
  title: string;
  credit: string;
  license: string;
  url: string;
}

const LENS_CREDITS: Credit[] = lensPoints.flatMap((p) => [
  ...(p.reference
    ? [{ key: `${p.id}-ref`, title: `${p.name} today`, credit: p.reference.credit, license: p.reference.license, url: p.reference.sourceUrl }]
    : []),
  ...p.layers
    .filter((l) => l.image)
    .map((l) => ({ key: l.key, title: l.title, credit: l.credit, license: l.license, url: l.sourceUrl })),
]);

const PLACE_CREDITS: Credit[] = Object.entries(PLACE_MEDIA)
  .filter(([, m]) => m.image && m.sourceUrl)
  .map(([id, m]) => ({ key: `place-${id}`, title: placeById(id)?.name ?? id, credit: m.credit ?? '', license: m.license ?? '', url: m.sourceUrl! }))
  .sort((a, b) => a.title.localeCompare(b.title));

type SectionKey = 'privacy' | 'links' | 'accuracy' | 'data' | 'images';
const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'privacy', label: 'Privacy' },
  { key: 'links', label: 'Booking links' },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'data', label: 'Data sources' },
  { key: 'images', label: 'Images' },
];

function Section({
  title,
  children,
  onLayout,
}: {
  title: string;
  children: React.ReactNode;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  return (
    <View style={s.section} onLayout={onLayout}>
      <Text style={s.h2} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Link({ label, url }: { label: string; url: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => openLink(url)}>
      <Text style={s.link}>{label}</Text>
    </Pressable>
  );
}

/** A group of image credits that opens on demand, so one licence is easy to find again. */
function CreditGroup({ title, credits, initiallyOpen }: { title: string; credits: Credit[]; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={s.group}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [s.groupHead, pressed && { opacity: 0.8 }]}
      >
        <Text style={s.groupTitle}>
          {title} ({credits.length})
        </Text>
        <Text style={s.link}>{open ? 'Hide' : 'Show'}</Text>
      </Pressable>
      {open
        ? credits.map((c) => (
            <Pressable key={c.key} accessibilityRole="link" onPress={() => openLink(c.url)} style={s.credit}>
              <Text style={s.creditTitle}>{c.title}</Text>
              <Text style={s.creditLine}>
                {c.credit} · {c.license} · Wikimedia Commons
              </Text>
            </Pressable>
          ))
        : null}
    </View>
  );
}

export default function About() {
  const scroll = useRef<ScrollView>(null);
  // Section positions come from layout and live in state: layout handlers are made during render,
  // and writing a ref from them is something the React Compiler lint can't prove safe.
  const [offsets, setOffsets] = useState<Partial<Record<SectionKey, number>>>({});
  const remember = (key: SectionKey) => (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    setOffsets((o) => (o[key] === y ? o : { ...o, [key]: y }));
  };
  const jump = (key: SectionKey) => scroll.current?.scrollTo({ y: Math.max(0, (offsets[key] ?? 0) - space.s), animated: true });

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TopBar title="About, sources and privacy" />
      <ScrollView ref={scroll} contentContainerStyle={s.scroll}>
        <View style={s.col}>
          <View style={s.jumps} accessibilityLabel="On this page">
            {SECTIONS.map((sec) => (
              <Pressable
                key={sec.key}
                accessibilityRole="button"
                accessibilityLabel={`Go to ${sec.label}`}
                onPress={() => jump(sec.key)}
                style={({ pressed }) => [s.jump, pressed && { opacity: 0.8 }]}
              >
                <Text style={s.jumpText}>{sec.label}</Text>
              </Pressable>
            ))}
          </View>

          <Section title="Privacy" onLayout={remember('privacy')}>
            <Text style={s.p}>KrakowLoop has no accounts and no analytics. It doesn’t collect your name, email or history.</Text>
            <Text style={s.p}>The camera picture for Time Lens stays on your phone. Nothing is recorded or uploaded.</Text>
            <Text style={s.p}>
              Your location is used only when you tap “Near me”, “Walk here”, “Show the nearest first” or “Where I am now”.
              It sorts places by distance on your phone.
              {WALKING_ROUTES_ENABLED
                ? ' For a walking route, your position and the destination are sent to Mapbox to calculate it.'
                : ''}{' '}
              A shared plan link contains the start point to about 100 m.
            </Text>
            <Text style={s.p}>
              Maps load from {MAP_PROVIDER === 'mapbox' ? 'Mapbox' : 'OpenFreeMap'}, which, like any website, sees your IP address.
            </Text>
          </Section>

          <Section title="Booking links" onLayout={remember('links')}>
            <Text style={s.p}>
              Links marked “affiliate link” may earn us a commission at no extra cost to you. {AFFILIATE_NOTE}. Auschwitz-Birkenau
              entry cards are only linked to the official website, without any commission.
            </Text>
          </Section>

          <Section title="How accurate is it" onLayout={remember('accuracy')}>
            <Text style={s.p}>
              Opening hours come from OpenStreetMap (exported {HOURS_EXPORTED}) and don’t include public holidays. Tram
              suggestions use the ZTP Kraków timetable (feed {TRANSIT_FEED_VERSION}) without live delays. Day-trip travel
              times are estimates. Always check before you go.
            </Text>
          </Section>

          <Section title="Data sources" onLayout={remember('data')}>
            <Text style={s.p}>Place locations and opening hours: © OpenStreetMap contributors, ODbL.</Text>
            <Link label="openstreetmap.org/copyright" url="https://www.openstreetmap.org/copyright" />
            <Text style={s.p}>Tram timetable: Zarząd Transportu Publicznego w Krakowie, GTFS.</Text>
            <Link label="gtfs.ztp.krakow.pl" url="https://gtfs.ztp.krakow.pl/" />
            <Text style={s.p}>Place photos and official websites: Wikimedia Commons and Wikidata.</Text>
            <Text style={s.p}>
              Map: {MAP_PROVIDER === 'mapbox' ? '© Mapbox, © OpenStreetMap' : 'OpenFreeMap, © OpenMapTiles, © OpenStreetMap'}.
              {WALKING_ROUTES_ENABLED ? ' Walking routes: Mapbox Directions.' : ''}
            </Text>
          </Section>

          <Section title="Images" onLayout={remember('images')}>
            <CreditGroup title="Time Lens images" credits={LENS_CREDITS} initiallyOpen />
            <CreditGroup title="Place photos" credits={PLACE_CREDITS} initiallyOpen={false} />
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  scroll: { paddingBottom: space.xl },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.m },
  jumps: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.s },
  jump: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  jumpText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  section: { marginTop: space.l, gap: space.s },
  h2: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink },
  p: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.vistula },
  group: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.m },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  groupTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  credit: { paddingBottom: space.s },
  creditTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  creditLine: { fontFamily: fonts.body, fontSize: 13, color: colors.mute },
});
