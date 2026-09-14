import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBar } from '../src/components/ui';
import { MAP_PROVIDER } from '../src/components/mapHtml';
import { AFFILIATE_NOTE } from '../src/config/affiliates';
import { lensPoints } from '../src/data/lens';
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

const IMAGE_CREDITS: Credit[] = lensPoints.flatMap((p) => [
  ...(p.reference
    ? [{ key: `${p.id}-ref`, title: `${p.name} today`, credit: p.reference.credit, license: p.reference.license, url: p.reference.sourceUrl }]
    : []),
  ...p.layers
    .filter((l) => l.image)
    .map((l) => ({ key: l.key, title: l.title, credit: l.credit, license: l.license, url: l.sourceUrl })),
]);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
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

export default function About() {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TopBar title="About, sources and privacy" />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.col}>
          <Section title="Privacy">
            <Text style={s.p}>KrakowLoop has no accounts and no analytics. It doesn’t collect your name, email or history.</Text>
            <Text style={s.p}>The camera picture for Time Lens stays on your phone. Nothing is recorded or uploaded.</Text>
            <Text style={s.p}>
              Your location is used only when you tap “Near me”, “Show the nearest first” or “Where I am now”. It sorts places
              by distance on your phone.
              {WALKING_ROUTES_ENABLED
                ? ' If you start a plan where you are, that start point is sent to Mapbox to draw the walking route.'
                : ''}{' '}
              A shared plan link contains the start point to about 100 m.
            </Text>
            <Text style={s.p}>
              Maps load from {MAP_PROVIDER === 'mapbox' ? 'Mapbox' : 'OpenFreeMap'}, which, like any website, sees your IP
              address.
            </Text>
          </Section>

          <Section title="Booking links">
            <Text style={s.p}>
              Links marked “affiliate link” may earn us a commission at no extra cost to you. {AFFILIATE_NOTE}. Auschwitz-Birkenau
              entry cards are only linked to the official website, without any commission.
            </Text>
          </Section>

          <Section title="How accurate is it">
            <Text style={s.p}>
              Opening hours come from OpenStreetMap (exported {HOURS_EXPORTED}) and don’t include public holidays. Tram
              suggestions use the ZTP Kraków timetable (feed {TRANSIT_FEED_VERSION}) without live delays. Day-trip travel
              times are estimates. Always check before you go.
            </Text>
          </Section>

          <Section title="Data sources">
            <Text style={s.p}>Place locations and opening hours: © OpenStreetMap contributors, ODbL.</Text>
            <Link label="openstreetmap.org/copyright" url="https://www.openstreetmap.org/copyright" />
            <Text style={s.p}>Tram timetable: Zarząd Transportu Publicznego w Krakowie, GTFS.</Text>
            <Link label="gtfs.ztp.krakow.pl" url="https://gtfs.ztp.krakow.pl/" />
            <Text style={s.p}>
              Map: {MAP_PROVIDER === 'mapbox' ? '© Mapbox, © OpenStreetMap' : 'OpenFreeMap, © OpenMapTiles, © OpenStreetMap'}.
              {WALKING_ROUTES_ENABLED ? ' Walking routes: Mapbox Directions.' : ''}
            </Text>
          </Section>

          <Section title="Images">
            {IMAGE_CREDITS.map((c) => (
              <Pressable key={c.key} accessibilityRole="link" onPress={() => openLink(c.url)} style={s.credit}>
                <Text style={s.creditTitle}>{c.title}</Text>
                <Text style={s.creditLine}>
                  {c.credit} · {c.license} · Wikimedia Commons
                </Text>
              </Pressable>
            ))}
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
  section: { marginTop: space.l, gap: space.s },
  h2: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink },
  p: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.vistula },
  credit: { paddingVertical: 4 },
  creditTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  creditLine: { fontFamily: fonts.body, fontSize: 13, color: colors.mute },
});
