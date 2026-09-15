import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Eyebrow, TopBar } from '../src/components/ui';
import { AFFILIATE_NOTE } from '../src/config/affiliates';
import { CITY } from '../src/config/city';
import { PLACE_MEDIA } from '../src/data/placeMedia';
import { places } from '../src/data/places';
import { roadMinutes } from '../src/lib/geo';
import { openLink } from '../src/lib/openLink';
import { colors, fonts, space } from '../src/theme';

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
      <TopBar title="Day trips" />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.col}>
          <Text style={s.intro}>
            Full days out of Kraków. Travel times are road estimates from the Main Square, each way; check the operator’s
            timetable before you go.
          </Text>
          {TRIPS.map(({ place, travel }) => {
            const media = PLACE_MEDIA[place.id];
            return (
              <View key={place.id} style={s.card}>
                {media?.image ? (
                  <Image source={media.image} style={s.photo} resizeMode="cover" accessibilityLabel={`Photo of ${place.name}`} />
                ) : null}
                <View style={s.body}>
                  <Eyebrow>
                    About {fmt(travel)} each way · {fmt(place.minutes)} there
                  </Eyebrow>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${place.name}`}
                    onPress={() => router.push(`/place/${place.id}`)}
                  >
                    <Text style={s.name}>{place.name}</Text>
                  </Pressable>
                  <Text style={s.blurb}>{place.blurb}</Text>
                  <View style={s.actions}>
                    {place.booking ? (
                      <Button label={place.booking.label} kind="quiet" onPress={() => openLink(place.booking!.url)} style={s.grow} />
                    ) : null}
                    <Button label="Details" kind="quiet" onPress={() => router.push(`/place/${place.id}`)} style={s.grow} />
                  </View>
                  {place.booking?.affiliate ? <Text style={s.note}>{AFFILIATE_NOTE}</Text> : null}
                  {media?.image ? (
                    <Text style={s.credit} numberOfLines={1}>
                      Photo: {media.credit} · {media.license}
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
  intro: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  card: { backgroundColor: colors.paper, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  photo: { width: '100%', height: 160, backgroundColor: colors.line },
  body: { padding: space.m, gap: 6 },
  name: { fontFamily: fonts.bodyBold, fontSize: 20, color: colors.ink, textDecorationLine: 'underline', textDecorationColor: colors.line },
  blurb: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.s },
  grow: { flexGrow: 1 },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.mute },
  credit: { fontFamily: fonts.body, fontSize: 11, color: colors.mute },
});
