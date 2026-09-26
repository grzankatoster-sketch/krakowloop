import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View, ViewToken } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { t } from '../src/i18n';
import type { StringKey } from '../src/i18n/en';
import { colors, fonts, space } from '../src/theme';

/** Set once the traveller has seen the welcome; the Now screen reads it. */
export const WELCOME_KEY = 'kl.welcome.v1';

type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const PAGES: { key: string; icon: Icon; color: string }[] = [
  { key: 'now', icon: 'compass-outline', color: colors.brick },
  { key: 'standing', icon: 'walk', color: colors.gilt },
  { key: 'wish', icon: 'microphone', color: colors.patina },
];

/**
 * Three pages on the first start: what the app does differently on a phone. Location is asked for
 * only when the traveller taps for it, never on its own.
 */
export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [list, setList] = useState<FlatList | null>(null);
  const [asked, setAsked] = useState<'no' | 'granted' | 'denied'>('no');

  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const i = viewableItems[0]?.index;
    if (i != null) setPage(i);
  });

  const finish = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await AsyncStorage.setItem(WELCOME_KEY, '1').catch(() => {});
    router.back();
  };
  const next = () => {
    if (page >= PAGES.length - 1) return finish();
    Haptics.selectionAsync().catch(() => {});
    list?.scrollToIndex({ index: page + 1, animated: true });
  };
  const askLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync().catch(() => ({ status: 'denied' as const }));
    setAsked(status === 'granted' ? 'granted' : 'denied');
    if (status === 'granted') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + space.m, paddingBottom: insets.bottom + space.m }]}>
      {/* light icons on the dark welcome */}
      <StatusBar style="light" />
      <Pressable accessibilityRole="button" onPress={finish} hitSlop={10} style={s.skip}>
        <Text style={s.skipText}>{t('welcome.skip')}</Text>
      </Pressable>

      <FlatList
        ref={setList}
        data={PAGES}
        keyExtractor={(p) => p.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View style={[s.page, { width }]}>
            <View style={[s.badge, { backgroundColor: item.color }]}>
              <MaterialCommunityIcons name={item.icon} size={64} color={colors.white} />
            </View>
            <Text style={s.title} accessibilityRole="header">
              {t(`welcome.${item.key}.title` as StringKey)}
            </Text>
            <Text style={s.text}>{t(`welcome.${item.key}.text` as StringKey)}</Text>
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
        )}
      />

      <View style={s.dots} accessibilityLabel={t('welcome.page', { n: page + 1, total: PAGES.length })}>
        {PAGES.map((p, i) => (
          <View key={p.key} style={[s.dot, i === page && s.dotOn]} />
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={next} style={({ pressed }) => [s.cta, pressed && s.pressed]}>
        <Text style={s.ctaText}>{page >= PAGES.length - 1 ? t('welcome.start') : t('welcome.next')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  pressed: { transform: [{ scale: 0.97 }] },
  skip: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', paddingHorizontal: space.m },
  skipText: { fontFamily: fonts.bodyBold, fontSize: 16, color: 'rgba(255,255,255,0.75)' },
  page: { flex: 1, paddingHorizontal: space.l, justifyContent: 'center', gap: space.m },
  badge: { width: 128, height: 128, borderRadius: 64, alignItems: 'center', justifyContent: 'center', marginBottom: space.m },
  title: { fontFamily: fonts.display, fontSize: 44, lineHeight: 48, color: colors.white },
  text: { fontFamily: fonts.body, fontSize: 19, lineHeight: 28, color: 'rgba(255,255,255,0.88)' },
  locBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: 18, borderRadius: 24, backgroundColor: colors.white, marginTop: space.s },
  locText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  locNote: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.gilt, marginTop: space.s },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: space.m },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotOn: { width: 24, backgroundColor: colors.white },
  cta: { marginHorizontal: space.l, minHeight: 56, borderRadius: 28, backgroundColor: colors.brick, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 18, color: colors.white },
});
