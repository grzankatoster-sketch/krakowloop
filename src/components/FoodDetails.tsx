import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PLACES_PROXY_URL } from '../config/googlePlaces';
import { FOOD_INFO, FoodInfo } from '../data/foodInfo';
import { GooglePlaceInfo, fetchGooglePlace, googleRatingText } from '../lib/googlePlace';
import { openLink } from '../lib/openLink';
import { t } from '../i18n';
import { colors, fonts, space } from '../theme';

const DIET_KEY = { vegan: 'food.vegan', vegetarian: 'food.vegetarian', gluten_free: 'food.gluten_free' } as const;

/** OSM cuisine values in plain words: "coffee_shop" -> "Coffee shop" (the values are English) */
export const cuisineLabel = (c: string) => (c.charAt(0).toUpperCase() + c.slice(1)).replace(/_/g, ' ');

/** The lines taken from OpenStreetMap, empty when OSM says nothing. */
export function osmFoodLines(info: FoodInfo | undefined, tr: typeof t = t): string[] {
  if (!info) return [];
  const lines: string[] = [];
  if (info.cuisine?.length) lines.push(tr('food.cuisine', { list: info.cuisine.map(cuisineLabel).join(', ') }));
  if (info.diet?.length) lines.push(info.diet.map((d) => tr(DIET_KEY[d])).join(' · '));
  return lines;
}

/**
 * Food and bar facts for a place card: cuisine and diets from OpenStreetMap, and the live Google
 * rating when a proxy is configured and the place has a Google id. Renders nothing otherwise.
 */
export function FoodDetails({ placeId, proxyUrl = PLACES_PROXY_URL }: { placeId: string; proxyUrl?: string }) {
  const info = FOOD_INFO[placeId];
  const googleId = proxyUrl ? info?.googlePlaceId : undefined;
  // the answer is kept with the id it belongs to, so a card never shows another place's rating
  const [loaded, setLoaded] = useState<{ id: string; info: GooglePlaceInfo | null } | null>(null);
  const google = googleId && loaded?.id === googleId ? loaded.info : null;

  useEffect(() => {
    if (!googleId) return;
    let live = true;
    fetchGooglePlace(googleId, proxyUrl).then((info) => {
      if (live) setLoaded({ id: googleId, info });
    });
    return () => {
      live = false;
    };
  }, [googleId, proxyUrl]);

  const lines = osmFoodLines(info);
  if (!lines.length && !google) return null;
  const text = google ? googleRatingText(google) : null;

  return (
    <View style={s.box}>
      {lines.length ? (
        <>
          {lines.map((l) => (
            <Text key={l} style={s.line}>
              {l}
            </Text>
          ))}
          <Text style={s.credit}>{t('food.osmCredit')}</Text>
        </>
      ) : null}
      {google && text ? (
        <View style={lines.length ? s.google : undefined} accessibilityLiveRegion="polite">
          <Text style={s.line}>{text.summary}</Text>
          <Text style={s.credit}>{text.attribution}</Text>
          {google.mapsUrl ? (
            <Pressable accessibilityRole="link" onPress={() => openLink(google.mapsUrl!)} style={({ pressed }) => [s.link, pressed && { opacity: 0.75 }]}>
              <Text style={s.linkText}>{t('food.googleLink')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: { gap: 4, paddingVertical: space.s },
  google: { marginTop: space.s, gap: 4 },
  line: { fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  credit: { fontFamily: fonts.mono, fontSize: 11, color: colors.mute },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.vistula, textDecorationLine: 'underline' },
});
