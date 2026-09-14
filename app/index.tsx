import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, space } from '../src/theme';
import { Eyebrow } from '../src/components/ui';

const DOORS: { href: Href; title: string; line: string }[] = [
  { href: '/map', title: 'Open the map', line: 'Sights, museums, food and day trips on one map.' },
  { href: '/plan', title: 'Plan my days', line: 'Tell us how long you’re staying. We draw a walking loop for each day.' },
  { href: '/lens', title: 'Time Lens', line: 'Point your camera at the Cloth Hall or Wawel and see them in 1493, 1617 or 1870.' },
];

export default function Home() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.col}>
          <Image
            source={require('../assets/lens/cracovia_1618.jpg')}
            style={s.hero}
            resizeMode="cover"
            accessibilityLabel="Engraved panorama of Kraków from 1618"
          />
          <Eyebrow style={s.caption}>Cracovia · Georg Braun · 1618</Eyebrow>

          <Eyebrow style={s.coords}>50.0615 N · 19.9374 E</Eyebrow>
          <Text style={s.wordmark} accessibilityRole="header">
            KrakowLoop
          </Text>
          <Text style={s.lead}>Kraków on foot, in loops you can finish.</Text>
          <Text style={s.body}>
            Kraków was the royal capital of Poland for more than five centuries. Its Old Town was on the very first
            UNESCO World Heritage List in 1978, and most of it is walkable: the Main Square to Wawel Castle takes about
            fifteen minutes.
          </Text>

          <View style={s.doors}>
            {DOORS.map((d) => (
              <Pressable
                key={d.title}
                accessibilityRole="button"
                onPress={() => router.push(d.href)}
                style={({ pressed }) => [s.door, pressed && { opacity: 0.8 }]}
              >
                <Text style={s.doorTitle}>{d.title}</Text>
                <Text style={s.doorLine}>{d.line}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.foot}>
            Map data © OpenStreetMap contributors. Historic images: public domain, via Wikimedia Commons.
          </Text>
          <Pressable accessibilityRole="link" onPress={() => router.push('/about')} hitSlop={8}>
            <Text style={s.footLink}>About, sources and privacy</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  scroll: { paddingBottom: space.xl },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  hero: { width: '100%', height: 200, backgroundColor: colors.line },
  caption: { paddingHorizontal: space.m, paddingTop: 6 },
  coords: { paddingHorizontal: space.m, marginTop: space.l, color: colors.brick },
  wordmark: { fontFamily: fonts.display, fontSize: 64, lineHeight: 72, color: colors.ink, paddingHorizontal: space.m },
  lead: { fontFamily: fonts.bodyBold, fontSize: 22, lineHeight: 28, color: colors.ink, paddingHorizontal: space.m, marginTop: 2 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink, paddingHorizontal: space.m, marginTop: space.m },
  doors: { marginTop: space.l, paddingHorizontal: space.m, gap: space.s },
  door: { backgroundColor: colors.paper, borderRadius: 16, padding: space.m, borderWidth: 1, borderColor: colors.line },
  doorTitle: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink },
  doorLine: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.mute, marginTop: 4 },
  foot: { fontFamily: fonts.body, fontSize: 12, color: colors.mute, paddingHorizontal: space.m, marginTop: space.l },
  footLink: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.vistula, paddingHorizontal: space.m, marginTop: space.s },
});
