import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Href, Link } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { t } from '../../i18n';
import { openLink } from '../../lib/openLink';
import { colors, fonts, space } from '../../theme';

const HERO_SOURCE = 'https://commons.wikimedia.org/wiki/File:Krakow_-_Cloth_Hall_from_Basilica_-_1.jpg';

/** A quiet row further down: a name, a chevron, nothing competing with the one thing to do first. */
function Row({ href, label }: { href: Href; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={label} style={StyleSheet.flatten([s.row])}>
        <Text style={s.rowText}>{label}</Text>
        <View aria-hidden importantForAccessibility="no-hide-descendants">
          <MaterialCommunityIcons name="chevron-right" size={28} color={colors.mute} />
        </View>
      </Pressable>
    </Link>
  );
}

/**
 * The home screen, round four (23.09.2026). Codex named what the earlier ones had in common: they
 * assumed the visitor already knew what they wanted, and offered four equal doors instead of an
 * invitation. So this one says where you are, what the city is, what the app gives you, and leaves
 * exactly one thing to tap.
 */
export function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={s.scroll}>
      <View style={s.col}>
        <Text style={s.brand}>{t('home.brand')}</Text>
        <Text style={s.h1} role="heading" aria-level={1}>
          {t('home.headline')}
        </Text>
      </View>

      <Image source={require('../../../assets/home/hero-main-square.jpg')} style={s.hero} resizeMode="cover" accessibilityLabel={t('home.heroAlt')} />
      <View style={s.col}>
        <Text style={s.caption}>{t('home.heroCaption')}</Text>

        <Text style={s.lead}>{t('home.cityLine')}</Text>
        <Text style={s.lead}>{t('home.appLine')}</Text>

        <Link href="/plan" asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={t('home.plan.cta')} style={StyleSheet.flatten([s.cta])}>
            <Text style={s.ctaText}>{t('home.plan.cta')}</Text>
          </Pressable>
        </Link>

        <View style={s.rows}>
          <Row href="/map" label={t('home.mapCard')} />
          <Row href="/lens" label={t('home.past.cta')} />
          <Row href="/trips" label={t('home.findTrip')} />
        </View>

        <View style={s.quiet}>
          <Link href="/city" asChild>
            <Pressable accessibilityRole="link" style={StyleSheet.flatten([s.quietHit])}>
              <Text style={s.quietText}>{t('home.knownFor')}</Text>
            </Pressable>
          </Link>
          <Link href="/about" asChild>
            <Pressable accessibilityRole="link" style={StyleSheet.flatten([s.quietHit])}>
              <Text style={s.quietText}>{t('home.about')}</Text>
            </Pressable>
          </Link>
        </View>

        <Pressable accessibilityRole="link" onPress={() => openLink(HERO_SOURCE)} hitSlop={6}>
          <Text style={s.credit}>{t('ui.photo')}: Ingo Mehling, 2019 · CC BY-SA 4.0 · Wikimedia Commons</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingBottom: space.xl, backgroundColor: colors.white },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.m },
  brand: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.mute, paddingTop: space.m },
  h1: { fontFamily: fonts.bodyBold, fontSize: 33, lineHeight: 39, color: colors.ink, marginTop: 6, marginBottom: space.m },
  hero: { width: '100%', height: 210, backgroundColor: colors.line },
  caption: { fontFamily: fonts.body, fontSize: 15, color: colors.mute, marginTop: 8 },
  lead: { fontFamily: fonts.body, fontSize: 19, lineHeight: 28, color: colors.ink, marginTop: space.m },
  cta: { minHeight: 62, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: space.l },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.white },
  rows: { marginTop: space.l, borderTopWidth: 1, borderColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 64, borderBottomWidth: 1, borderColor: colors.line },
  rowText: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink },
  quiet: { marginTop: space.m },
  quietHit: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  quietText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.vistula, textDecorationLine: 'underline' },
  credit: { fontFamily: fonts.body, fontSize: 12, color: colors.mute, marginTop: space.m },
});
