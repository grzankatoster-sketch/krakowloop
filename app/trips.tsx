import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, card, Photo, ScreenHeader } from '../src/components/ui';
import { bookingLabel, placeName, placeText } from '../src/components/placeName';
import { AFFILIATE_NOTE } from '../src/config/affiliates';
import { CITY } from '../src/config/city';
import { PLACE_MEDIA } from '../src/data/placeMedia';
import { places } from '../src/data/places';
import { roadMinutes } from '../src/lib/geo';
import { openLink } from '../src/lib/openLink';
import { LANG, t } from '../src/i18n';
import { colors, fonts, space, typeScale } from '../src/theme';

const fmt = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);

/** Every place outside the city, most important first, then nearest. */
const TRIPS = places
  .filter((p) => p.zone === 'out')
  .map((p) => ({ place: p, travel: roadMinutes(CITY.centre, p) }))
  .sort((a, b) => b.place.priority - a.place.priority || a.travel - b.travel);

export default function Trips() {
  const router = useRouter();
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <ScreenHeader title={t('trips.title')} />
        <View style={s.col}>
          <Text style={s.intro}>{t('trips.intro')}</Text>
          {TRIPS.map(({ place, travel }) => {
            const media = PLACE_MEDIA[place.id];
            const name = placeName(place);
            const about = placeText(place);
            return (
              <View key={place.id} style={s.card}>
                {media?.image ? (
                  <Photo source={media.image} accessibilityLabel={t('place.photoAlt', { name })} />
                ) : null}
                <View style={s.body}>
                  <Text style={s.meta}>{t('trips.eyebrow', { travel: fmt(travel), stay: fmt(place.minutes) })}</Text>
                  <Link href={`/place/${place.id}`} asChild>
                    <Pressable accessibilityRole="link" accessibilityLabel={t('trips.openLabel', { name })}>
                      <Text style={s.name}>{name}</Text>
                    </Pressable>
                  </Link>
                  <Text style={s.blurb} numberOfLines={5}>
                    {about.text}
                  </Text>
                  {about.lang !== LANG ? <Text style={s.langTag}>{t('ui.inEnglish')}</Text> : null}
                  <View style={s.actions}>
                    <Button label={t('trips.details')} onPress={() => router.push(`/place/${place.id}`)} accessibilityLabel={`${t('trips.details')}: ${name}`} style={s.grow} />
                    {place.booking ? (
                      <Button label={bookingLabel(place.booking)} kind="quiet" onPress={() => openLink(place.booking!.url)} style={s.grow} />
                    ) : null}
                  </View>
                  {place.booking?.affiliate ? <Text style={s.note}>{AFFILIATE_NOTE}</Text> : null}
                  {media?.image ? (
                    <Text style={s.credit} numberOfLines={1}>
                      {t('ui.photo')}: {media.credit} · {media.license}
                    </Text>
                  ) : null}
                </View>
              </View>
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
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.m, gap: space.m },
  intro: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink },
  card: { ...card },
  body: { padding: space.m, gap: space.s },
  meta: { ...typeScale.meta, color: colors.mute, textTransform: 'uppercase' },
  name: { fontFamily: fonts.bodyBold, fontSize: 22, lineHeight: 28, color: colors.ink },
  blurb: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  langTag: { ...typeScale.meta, color: colors.mute, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.line, borderRadius: 6, paddingHorizontal: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.s },
  grow: { flexGrow: 1 },
  note: { fontFamily: fonts.body, fontSize: 15, color: colors.mute },
  credit: { fontFamily: fonts.body, fontSize: 15, color: colors.mute },
});
