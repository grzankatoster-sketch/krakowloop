import { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, useWindowDimensions, View, ViewToken } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '../../src/lib/useTabBarSpace';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { lensName, lensWhere } from '../../src/components/placeName';
import { lensPoints } from '../../src/data/lens';
import { t } from '../../src/i18n';
import { colors, fonts, space } from '../../src/theme';

/** Every old picture of every viewpoint, one per page: the city in the past, swiped sideways. */
const PAGES = lensPoints.flatMap((l) => l.layers.filter((x) => x.image).map((layer) => ({ key: `${l.id}:${layer.key}`, point: l, layer })));

/**
 * Time Lens as a gallery: an old photograph or engraving fills the screen with its year, and one tap
 * takes you to the viewpoint to hold it against the view today.
 */
export default function LensGallery() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { width } = useWindowDimensions();
  const [height, setHeight] = useState(0);
  const [page, setPage] = useState(0);
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const i = viewableItems[0]?.index;
    if (i == null) return;
    setPage((prev) => {
      if (prev !== i) Haptics.selectionAsync().catch(() => {});
      return i;
    });
  });

  return (
    <View style={s.root} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 ? (
        <FlatList
          data={PAGES}
          keyExtractor={(p) => p.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          renderItem={({ item }) => (
            <View style={{ width, height }}>
              <Image source={item.layer.image} style={s.photo} resizeMode={item.layer.kind === 'artwork' ? 'contain' : 'cover'} accessibilityLabel={item.layer.title} />
              <LinearGradient colors={['rgba(8,11,30,0.55)', 'rgba(8,11,30,0)']} style={s.shadeTop} pointerEvents="none" />
              <LinearGradient colors={['rgba(8,11,30,0)', 'rgba(8,11,30,0.92)']} locations={[0, 0.6]} style={s.shadeBottom} pointerEvents="none" />
              <View style={[s.words, { paddingBottom: space.l + tabSpace }]}>
                <Text style={s.year}>{item.layer.year}</Text>
                <Text style={s.name} numberOfLines={2}>
                  {lensName(item.point)}
                </Text>
                <Text style={s.where} numberOfLines={2}>
                  {lensWhere(item.point)}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    router.push(`/lens/${item.point.id}`);
                  }}
                  style={({ pressed }) => [s.cta, pressed && s.pressed]}
                >
                  <MaterialCommunityIcons name="camera-iris" size={22} color={colors.ink} />
                  <Text style={s.ctaText}>{t('lensGallery.compare')}</Text>
                </Pressable>
                <Text style={s.credit} numberOfLines={1}>
                  {item.layer.credit} · {item.layer.license}
                </Text>
              </View>
            </View>
          )}
        />
      ) : null}
      <View style={[s.head, { top: insets.top + space.s }]} pointerEvents="none">
        <Text style={s.title}>{t('lens.title')}</Text>
        <Text style={s.count}>
          {Math.min(page + 1, PAGES.length)} / {PAGES.length}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E1330' },
  pressed: { transform: [{ scale: 0.97 }] },
  photo: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  shadeTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 180 },
  shadeBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  words: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.l, gap: 8 },
  year: { fontFamily: fonts.display, fontSize: 96, lineHeight: 96, color: colors.white },
  name: { fontFamily: fonts.display, fontSize: 36, lineHeight: 38, color: colors.white },
  where: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: 'rgba(255,255,255,0.88)' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 52, paddingHorizontal: 22, borderRadius: 26, backgroundColor: colors.white, marginTop: space.s },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  credit: { fontFamily: fonts.body, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  head: { position: 'absolute', left: space.l, right: space.l, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.white },
  count: { fontFamily: fonts.monoBold, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
});
