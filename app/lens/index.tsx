import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBar } from '../../src/components/ui';
import { LensPoint, lensPoints } from '../../src/data/lens';
import { t } from '../../src/i18n';
import { colors, fonts, space } from '../../src/theme';

/** "Photos from 1870 and c.1880, today, and 1 old engraving" */
function offer(p: LensPoint): string {
  const years = p.layers.filter((l) => l.kind === 'photo').map((l) => l.year);
  const art = p.layers.filter((l) => l.kind === 'artwork').length;
  const parts: string[] = [];
  if (years.length) parts.push(t('lens.offer.photos', { years: years.join(t('lens.and')) }) + (p.reference ? t('lens.offer.andToday') : ''));
  else if (p.reference) parts.push(t('lens.offer.todayOnly'));
  if (art) parts.push(art === 1 ? t('lens.offer.engraving.one') : t('lens.offer.engraving.many', { n: art }));
  return parts.join(' · ');
}

export default function LensList() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TopBar title={t('lens.title')} />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.col}>
          <Text style={s.intro}>{t('lens.intro')}</Text>
          {lensPoints.map((p) => {
            const thumb = p.reference?.image ?? p.layers[0]?.image;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}. ${offer(p)}.`}
                onPress={() => router.push(`/lens/${p.id}`)}
                style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}
              >
                {thumb ? <Image source={thumb} style={s.thumb} resizeMode="cover" /> : <View style={s.thumb} />}
                <View style={s.rowBody}>
                  <Text style={s.name}>{p.name}</Text>
                  <Text style={s.offer}>{offer(p)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  scroll: { paddingBottom: space.xl },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.m, gap: space.s },
  intro: { fontFamily: fonts.body, fontSize: 18, lineHeight: 26, color: colors.ink, marginBottom: space.s },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minHeight: 104,
    backgroundColor: colors.paper,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.s,
  },
  thumb: { width: 88, height: 88, borderRadius: 10, backgroundColor: colors.line },
  rowBody: { flex: 1, gap: 4, paddingRight: space.s },
  name: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.ink },
  offer: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.mute },
});
