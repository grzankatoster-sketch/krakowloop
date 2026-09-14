import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, space } from '../src/theme';
import { Eyebrow } from '../src/components/ui';

const DOORS: { href: Href; title: string; line: string }[] = [
  { href: '/map', title: 'Open the map', line: 'Sights, museums, trams and walking routes on one map.' },
  { href: '/plan', title: 'Plan my days', line: 'Tell us how long you’re staying. We draw a walking loop for each day.' },
  { href: '/lens', title: 'Time Lens', line: 'Point your camera at the Cloth Hall or Wawel and see them in 1493, 1617 or 1870.' },
];

export default function Home() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.col}>
          <View style={s.header}>
            <Eyebrow style={s.coords}>50.0615 N · 19.9374 E</Eyebrow>
            <Text style={s.wordmark} accessibilityRole="header">
              KrakowLoop
            </Text>
            <Text style={s.lead}>Kraków on foot, in loops you can finish.</Text>
          </View>

          <View style={s.doors}>
            {DOORS.map((d, i) => (
              <Pressable
                key={d.title}
                accessibilityRole="button"
                onPress={() => router.push(d.href)}
                style={({ pressed }) => [s.door, i === 0 && s.doorMain, pressed && { opacity: 0.85 }]}
              >
                <Text style={[s.doorTitle, i === 0 && s.doorTitleMain]}>{d.title}</Text>
                <Text style={[s.doorLine, i === 0 && s.doorLineMain]}>{d.line}</Text>
              </Pressable>
            ))}
          </View>

          <View style={s.story}>
            <Image
              source={require('../assets/lens/cracovia_1618.jpg')}
              style={s.hero}
              resizeMode="cover"
              accessibilityLabel="Engraved panorama of Kraków from 1618"
            />
            <Eyebrow>Cracovia · Georg Braun · 1618</Eyebrow>
            <Text style={s.body}>
              Kraków was the royal capital of Poland for more than five centuries. Its Old Town was on the very first
              UNESCO World Heritage List in 1978, and most of it is walkable: the Main Square to Wawel Castle takes about
              fifteen minutes.
            </Text>
          </View>

          <View style={s.footer}>
            <Text style={s.foot}>Map data © OpenStreetMap contributors. Historic images: public domain, via Wikimedia Commons.</Text>
            <Pressable accessibilityRole="link" onPress={() => router.push('/about')} hitSlop={8}>
              <Text style={s.footLink}>About, sources and privacy</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  scroll: { paddingBottom: space.xl },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.m, gap: space.l },
  header: { paddingTop: space.m, gap: 2 },
  coords: { color: colors.brick },
  wordmark: { fontFamily: fonts.display, fontSize: 56, lineHeight: 62, color: colors.ink },
  lead: { fontFamily: fonts.bodyBold, fontSize: 20, lineHeight: 26, color: colors.ink },
  doors: { gap: space.s },
  door: { backgroundColor: colors.paper, borderRadius: 16, padding: space.m, borderWidth: 1, borderColor: colors.line },
  doorMain: { backgroundColor: colors.ink, borderColor: colors.ink, paddingVertical: 20 },
  doorTitle: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink },
  doorTitleMain: { color: colors.white, fontSize: 21 },
  doorLine: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.mute, marginTop: 4 },
  doorLineMain: { color: colors.white },
  story: { gap: 6 },
  hero: { width: '100%', height: 170, borderRadius: 14, backgroundColor: colors.line },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink, marginTop: space.s },
  footer: { gap: space.s },
  foot: { fontFamily: fonts.body, fontSize: 12, color: colors.mute },
  footLink: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.vistula },
});
