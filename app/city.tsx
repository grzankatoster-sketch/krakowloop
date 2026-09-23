import { ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { card, Photo, ScreenHeader } from '../src/components/ui';
import { PLACE_MEDIA } from '../src/data/placeMedia';
import { t } from '../src/i18n';
import type { StringKey } from '../src/i18n/en';
import { openLink } from '../src/lib/openLink';
import { colors, fonts, space } from '../src/theme';

/**
 * What Kraków is known for: seven things, each in a picture and two sentences. Topics and images
 * chosen with Codex (22.09.2026); every image is one the app already carries with its licence, and
 * a topic without a fitting one goes without a picture rather than with a wrong one.
 */
const TOPICS: { key: string; photo?: string; place?: string }[] = [
  { key: 'royal', photo: 'wawel-cathedral', place: 'wawel-cathedral' },
  { key: 'unesco', photo: 'main-square', place: 'main-square' },
  { key: 'hejnal', photo: 'st-marys', place: 'st-marys' },
  { key: 'dragon', photo: 'dragons-den', place: 'dragons-den' },
  { key: 'jewish', photo: 'old-synagogue', place: 'old-synagogue' },
  { key: 'obwarzanek' },
  { key: 'szopki' },
];

const SOURCES: { label: string; url: string }[] = [
  { label: 'UNESCO World Heritage List: Historic Centre of Kraków', url: 'https://whc.unesco.org/en/list/29' },
  { label: 'UNESCO: Nativity scene (szopka) tradition in Kraków, 2018', url: 'https://ich.unesco.org/en/decisions/13.COM/10.B.29' },
  { label: 'Wawel Royal Castle: Looking for the dragon', url: 'https://wawel.krakow.pl/en/route/looking-for-the-dragon' },
  { label: 'Kraków culinary heritage: obwarzanek', url: 'https://culinary.krakow.pl/culinary_heritage/224845,2072,komunikat,obwarzanek_-_the_round_symbol_of_krakow.html' },
];

function Topic({ k, image, place }: { k: string; image?: ImageSourcePropType; place?: string }) {
  const title = t(`city.${k}.title` as StringKey);
  const text = t(`city.${k}.text` as StringKey);
  const body = (
    <>
      {image ? <Photo source={image} /> : null}
      <View style={s.topicText}>
        <Text style={s.h2} role="heading" aria-level={2}>
          {title}
        </Text>
        <Text style={s.text}>{text}</Text>
        {place ? <Text style={s.more}>{t('city.more')}</Text> : null}
      </View>
    </>
  );
  return place ? (
    <Link href={`/place/${place}`} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={`${title}. ${text}`} style={StyleSheet.flatten([s.topic])}>
        {body}
      </Pressable>
    </Link>
  ) : (
    <View style={s.topic}>{body}</View>
  );
}

export default function City() {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <ScreenHeader title={t('home.knownFor')} />
        <View style={s.col}>
          <Text style={s.lead}>{t('city.lead')}</Text>
          {TOPICS.map((topic) => (
            <Topic key={topic.key} k={topic.key} image={topic.photo ? PLACE_MEDIA[topic.photo]?.image : undefined} place={topic.place} />
          ))}
          <Text style={s.sourcesTitle}>{t('city.sources')}</Text>
          {SOURCES.map((src) => (
            <Pressable key={src.url} accessibilityRole="link" onPress={() => openLink(src.url)} hitSlop={6}>
              <Text style={s.source}>{src.label}</Text>
            </Pressable>
          ))}
          <Text style={s.small}>{t('city.photos')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  scroll: { paddingBottom: space.xl },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.m, gap: space.m },
  lead: { fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: colors.ink },
  topic: { ...card },
  topicText: { padding: space.m, gap: 6 },
  h2: { fontFamily: fonts.bodyBold, fontSize: 21, lineHeight: 26, color: colors.ink },
  text: { fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: colors.ink },
  more: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.vistula, marginTop: 2 },
  sourcesTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.mute, marginTop: space.m },
  source: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: colors.vistula, textDecorationLine: 'underline' },
  small: { fontFamily: fonts.body, fontSize: 15, color: colors.mute },
});
