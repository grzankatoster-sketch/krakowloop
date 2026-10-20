import { useRef, useState } from 'react';
import { FlatList, Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { PLACE_MEDIA } from '../src/data/placeMedia';
import { t } from '../src/i18n';
import type { StringKey } from '../src/i18n/en';
import { colors, fonts, layout, space } from '../src/theme';

/** Set once the traveller has seen the welcome; the Now screen reads it. */
export const WELCOME_KEY = 'kl.welcome.v1';

type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
// each page shows the city it talks about: the square, a sight to stand at, the food street
const PAGES: { key: string; icon: Icon; color: string; photo: string }[] = [
  { key: 'now', icon: 'compass-outline', color: colors.brick, photo: 'main-square' },
  { key: 'standing', icon: 'walk', color: colors.gilt, photo: 'town-hall-tower' },
  { key: 'wish', icon: 'microphone', color: colors.patina, photo: 'plac-nowy' },
];

/**
 * Three pages on the first start: what the app does differently on a phone. Location is asked for
 * only when the traveller taps for it, never on its own.
 */
export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // the photo takes the top of the page, under the clock, and leaves the rest to the words
  // on a short phone the words need more of the height (the location button must stay clear of the dots)
  const photoH = Math.round(Math.min(height * (height < 800 ? 0.34 : 0.44), width * 1.05)) + insets.top;
  const compact = width < 380 || height < 800;
  const [page, setPage] = useState(0);
  const list = useRef<FlatList>(null);
  const [asked, setAsked] = useState<'no' | 'granted' | 'denied'>('no');

  // the page Next is scrolling to: until the list gets there, the offsets it passes on the way must
  // not move the dots back (they did, and a second Next went to page 2 again instead of the last one)
  const target = useRef<number | null>(null);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    if (target.current != null) {
      if (Math.abs(x - target.current * width) > 2) return;
      target.current = null;
    }
    const i = Math.min(PAGES.length - 1, Math.max(0, Math.round(x / width)));
    if (i !== page) setPage(i);
  };

  const finish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await AsyncStorage.setItem(WELCOME_KEY, '1').catch(() => {});
    // opened over Now it goes back there; opened on its own (a reload on the web) it has nowhere to go back to
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const next = () => {
    if (page >= PAGES.length - 1) return finish();
    Haptics.selectionAsync().catch(() => {});
    // to the next page by its offset, and the dots and the button follow at once: scrollToIndex did
    // nothing here (Next never moved), and the page must not wait for the scroll to end
    target.current = page + 1;
    list.current?.scrollToOffset({ offset: (page + 1) * width, animated: true });
    setPage(page + 1);
  };
  const askLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync().catch(() => ({ status: 'denied' as const }));
    setAsked(status === 'granted' ? 'granted' : 'denied');
    if (status === 'granted') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  return (
    <View style={[s.root, { paddingBottom: insets.bottom + space.m }]}>
      {/* light icons on the dark welcome */}
      <StatusBar style="light" />

      <FlatList
        ref={list}
        data={PAGES}
        keyExtractor={(p) => p.key}
        horizontal
        pagingEnabled
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        // a swipe by hand takes over from a Next still on its way
        onScrollBeginDrag={() => { target.current = null; }}
        renderItem={({ item }) => {
          const media = PLACE_MEDIA[item.photo];
          return (
          <View style={[s.page, { width }]}>
            {/* explicit size and a clipped box: on the web an image otherwise takes its file's size */}
            <View style={{ height: photoH, width, overflow: 'hidden' }}>
              {media?.image ? <Image source={media.image} style={{ position: 'absolute', top: 0, left: 0, width, height: photoH }} resizeMode="cover" accessible={false} accessibilityIgnoresInvertColors /> : null}
              {/* the photo fades into the page, so the words below sit on calm ink */}
              <LinearGradient colors={['rgba(28,37,80,0.55)', 'rgba(28,37,80,0)', colors.ink]} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
              {media ? (
                // the licence must be read whole: two lines rather than a cut
                <Text style={[s.credit, { top: insets.top + space.s }]} numberOfLines={2}>
                  {t('ui.photo')}: {media.credit} · {media.license}
                </Text>
              ) : null}
            </View>
            <View style={s.words}>
              <View style={[s.badge, { backgroundColor: item.color }]}>
                <MaterialCommunityIcons name={item.icon} size={28} color={colors.white} />
              </View>
            <Text style={[s.title, compact && s.titleCompact]} accessibilityRole="header">
              {t(`welcome.${item.key}.title` as StringKey)}
            </Text>
            <Text style={[s.text, compact && s.textCompact]}>{t(`welcome.${item.key}.text` as StringKey)}</Text>
            {item.key === 'standing' ? (
              asked === 'no' ? (
                <Pressable accessibilityRole="button" onPress={askLocation} style={({ pressed }) => [s.locBtn, pressed && s.pressed]}>
                  <MaterialCommunityIcons name="map-marker-radius" size={20} color={colors.ink} />
                  <Text style={s.locText}>{t('welcome.standing.allow')}</Text>
                </Pressable>
              ) : (
                <Text style={s.locNote}>{asked === 'granted' ? t('welcome.standing.on') : t('welcome.standing.later')}</Text>
              )
            ) : null}
            </View>
          </View>
          );
        }}
      />

      {/* over the photo, where a thumb finds it; on the last page the big button already closes it */}
      {page < PAGES.length - 1 ? (
        <Pressable accessibilityRole="button" onPress={finish} hitSlop={10} style={[s.skip, { top: insets.top + space.xs }]}>
          <Text style={s.skipText}>{t('welcome.skip')}</Text>
        </Pressable>
      ) : null}

      <View style={s.dots} accessible accessibilityRole="text" accessibilityLabel={t('welcome.page', { n: page + 1, total: PAGES.length })}>
        {PAGES.map((p, i) => (
          <View key={p.key} style={[s.dot, i === page && s.dotOn]} />
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={next} style={({ pressed }) => [s.cta, { width: Math.min(width, layout.column) - space.l * 2 }, pressed && s.pressed]}>
        <Text style={s.ctaText}>{page >= PAGES.length - 1 ? t('welcome.start') : t('welcome.next')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  pressed: { transform: [{ scale: 0.97 }] },
  skip: { position: 'absolute', right: space.s, minHeight: 44, justifyContent: 'center', paddingHorizontal: space.m, borderRadius: 22, backgroundColor: 'rgba(28,37,80,0.55)' },
  skipText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
  page: { flex: 1 },
  credit: { position: 'absolute', left: space.m, right: 120, fontFamily: fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  // the words in one reading column, also on a wide window
  words: { width: '100%', maxWidth: layout.column, alignSelf: 'center', paddingHorizontal: space.l, gap: space.m, marginTop: -space.xl },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 44, lineHeight: 48, color: colors.white },
  titleCompact: { fontSize: 36, lineHeight: 40 },
  textCompact: { fontSize: 17, lineHeight: 25 },
  text: { fontFamily: fonts.body, fontSize: 19, lineHeight: 28, color: 'rgba(255,255,255,0.88)' },
  locBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: 18, borderRadius: 24, backgroundColor: colors.white, marginTop: space.s },
  locText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  locNote: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.gilt, marginTop: space.s },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: space.m },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotOn: { width: 24, backgroundColor: colors.white },
  cta: { alignSelf: 'center', minHeight: 56, borderRadius: 28, backgroundColor: colors.brick, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.white },
});
