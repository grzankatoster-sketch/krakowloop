import { useCallback, useRef, useState } from 'react';
import { FlatList, Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, ViewToken } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useStatusBarOnFocus } from '../../src/lib/useStatusBarOnFocus';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScreenHeader } from '../../src/components/ui';
import { lensName, lensWhere } from '../../src/components/placeName';
import { ReconBadge } from '../../src/components/ReconBadge';
import { LensLayer, LensPoint, cameraProblem, firstShown, lensById } from '../../src/data/lens';
import { openLink } from '../../src/lib/openLink';
import { t } from '../../src/i18n';
import { colors, fonts, space } from '../../src/theme';

export default function LensScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const point = lensById(String(id));

  if (!point) {
    return (
      <SafeAreaView style={s.safe}>
        <ScreenHeader title={t('lens.title')} />
        <Text style={s.empty}>{t('lens.unknown')}</Text>
      </SafeAreaView>
    );
  }
  return <LensViewer key={point.id} point={point} />;
}

function Credit({ title, credit, license, url, made }: { title: string; credit: string; license: string; url: string; made?: boolean }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => openLink(url)} hitSlop={6}>
      <Text style={s.credit}>
        {/* a picture we made is not a Commons file: its link goes to where the knowledge comes from */}
        {title}. {credit} · {license}
        {made ? '' : ' · Wikimedia Commons'}
      </Text>
    </Pressable>
  );
}

/** Release the camera whenever this screen is not the one in front, and remember whether it is. */
function useReleaseCamera(focusedRef: { current: boolean }, setCameraWanted: (on: boolean) => void) {
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      return () => {
        focusedRef.current = false;
        setCameraWanted(false);
      };
    }, [focusedRef, setCameraWanted]),
  );
}

function environment() {
  const web = Platform.OS === 'web';
  return {
    web,
    secure: !web || (typeof window !== 'undefined' && window.isSecureContext),
    mediaDevices: !web || (typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia),
  };
}

function LensViewer({ point }: { point: LensPoint }) {
  const photos = point.layers.filter((l) => l.kind === 'photo');
  const artworks = point.layers.filter((l) => l.kind === 'artwork');
  const today = point.reference;
  const [shown, setShown] = useState(() => firstShown(point));
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraWanted, setCameraWanted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showOld, setShowOld] = useState(true);
  const focusedRef = useRef(true);

  useReleaseCamera(focusedRef, setCameraWanted);
  useStatusBarOnFocus('light');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height: screenH } = useWindowDimensions();
  // room for the back button, then the picture at about its own shape: an old photo is never cropped
  const frameH = Math.round(Math.min(screenH * 0.62, insets.top + 56 + width * 0.8));
  const pager = useRef<FlatList<{ key: string; label: string }>>(null);

  const current: LensLayer | undefined = photos.find((p) => p.key === shown);
  const choices = [...photos.map((p) => ({ key: p.key, label: p.year })), ...(today ? [{ key: 'today', label: t('lens.today') }] : [])];
  const layerOf = (key: string): Pick<LensLayer, 'image' | 'title' | 'credit' | 'license' | 'sourceUrl' | 'reconstruction'> | undefined => (key === 'today' ? today : photos.find((p) => p.key === key));
  // the pictures are swiped like pages; the years under them follow, and a tap on a year turns the page
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const key = (viewableItems[0]?.item as { key: string } | undefined)?.key;
    if (!key) return;
    setShown((prev) => {
      if (prev !== key) Haptics.selectionAsync().catch(() => {});
      return key;
    });
  });
  const pick = (key: string) => {
    const i = choices.findIndex((c) => c.key === key);
    if (i >= 0) pager.current?.scrollToIndex({ index: i, animated: true });
    setShown(key);
  };
  const cameraOn = cameraWanted && !!permission?.granted;
  // only a real photograph goes over the camera: a reconstruction seen from above would mislead
  const overlay = [current, ...photos].find((p) => p && !p.reconstruction);

  const startCamera = async () => {
    const problem = cameraProblem(environment());
    if (problem) {
      setCameraError(problem);
      return;
    }
    try {
      const res = permission?.granted ? permission : await requestPermission();
      // the permission dialog can outlive the screen: never start a camera nobody sees
      if (!focusedRef.current) return;
      if (res.granted) {
        setCameraError(null);
        setCameraWanted(true);
      } else {
        setCameraError(t('lens.denied'));
      }
    } catch {
      if (focusedRef.current) setCameraError(t('lens.cannotStart'));
    }
  };

  const shownLayer = layerOf(shown) ?? current ?? today;
  const startIndex = Math.max(0, choices.findIndex((c) => c.key === shown));

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}>
        {/* the pictures, the whole width of the phone: swipe through the years */}
        {choices.length ? (
          <View style={{ height: frameH, backgroundColor: '#000' }}>
            <FlatList
              ref={pager}
              data={choices}
              keyExtractor={(c) => c.key}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={startIndex}
              getItemLayout={(_d, i) => ({ length: width, offset: width * i, index: i })}
              onViewableItemsChanged={onViewable}
              viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
              renderItem={({ item }) => {
                const layer = layerOf(item.key);
                return (
                  <View style={{ width, height: frameH, paddingTop: insets.top + 56 }}>
                    {layer ? <Image source={layer.image} style={s.fill} resizeMode="contain" accessibilityLabel={layer.title} /> : null}
                  </View>
                );
              }}
            />
            <View style={s.bigYearBox} pointerEvents="none">
              <ReconBadge show={current?.reconstruction ?? (!current && today?.reconstruction)} />
              <Text style={s.bigYearText}>{current ? current.year : t('lens.today')}</Text>
            </View>
          </View>
        ) : (
          <View style={{ height: insets.top + 64 }} />
        )}

        <View style={s.col}>
          {choices.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.years}>
              {choices.map((c) => {
                const on = c.key === shown;
                return (
                  <Pressable
                    key={c.key}
                    accessibilityRole="button"
                    accessibilityLabel={c.key === 'today' ? t('lens.today') : t('lens.photoFrom', { year: c.label })}
                    aria-pressed={on}
                    onPress={() => pick(c.key)}
                    style={({ pressed }) => [s.year, on && s.yearOn, pressed && s.pressed]}
                  >
                    <Text style={[s.yearText, on && s.yearTextOn]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <Text style={s.title} accessibilityRole="header">
            {lensName(point)}
          </Text>
          <Text style={s.where}>{t('lens.standAt', { where: lensWhere(point) })}</Text>
          {shownLayer ? <Credit title={shownLayer.title} credit={shownLayer.credit} license={shownLayer.license} url={shownLayer.sourceUrl} made={shownLayer.reconstruction} /> : null}

          {overlay ? (
            <View style={s.section}>
              <Text style={s.h2} accessibilityRole="header">
                {t('lens.there')}
              </Text>
              <Text style={s.line}>{t('lens.thereLine')}</Text>
              {cameraOn ? (
                <>
                  <View style={s.cameraBox}>
                    <CameraView
                      style={StyleSheet.absoluteFill}
                      facing="back"
                      onMountError={(e) => {
                        setCameraWanted(false);
                        setCameraError(t('lens.startError', { message: e.message }));
                      }}
                    />
                    {showOld ? (
                      <Image source={overlay.image} style={s.cameraOverlay} resizeMode="contain" accessibilityLabel={overlay.title} />
                    ) : null}
                  </View>
                  <View style={s.row}>
                    <Pressable accessibilityRole="button" onPress={() => setShowOld((v) => !v)} style={({ pressed }) => [s.ghost, pressed && s.pressed]}>
                      <Text style={s.ghostText}>{showOld ? t('lens.hideOld') : t('lens.showOld')}</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => setCameraWanted(false)} style={({ pressed }) => [s.ghost, pressed && s.pressed]}>
                      <Text style={s.ghostText}>{t('lens.stopCamera')}</Text>
                    </Pressable>
                  </View>
                  <Text style={s.credit}>{t('lens.live')}</Text>
                </>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    startCamera();
                  }}
                  style={({ pressed }) => [s.cta, pressed && s.pressed]}
                >
                  <MaterialCommunityIcons name="camera-iris" size={22} color={colors.ink} />
                  <Text style={s.ctaText}>{t('lens.compare')}</Text>
                </Pressable>
              )}
              {cameraError ? (
                <Text style={s.error} accessibilityLiveRegion="polite">
                  {cameraError}
                </Text>
              ) : null}
              {permission && !permission.granted && !permission.canAskAgain ? <Text style={s.credit}>{t('lens.off')}</Text> : null}
            </View>
          ) : null}

          {artworks.length ? (
            <View style={s.section}>
              <Text style={s.h2} accessibilityRole="header">
                {t('lens.artist')}
              </Text>
              <Text style={s.line}>{t('lens.artistLine')}</Text>
              {artworks.map((a) => (
                <View key={a.key} style={s.card}>
                  <Image source={a.image} style={s.artwork} resizeMode="contain" accessibilityLabel={a.title} />
                  <Text style={s.cardTitle}>
                    {a.year} · {a.title}
                  </Text>
                  <Credit title={t('lens.source')} credit={a.credit} license={a.license} url={a.sourceUrl} />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('ui.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={8}
        style={({ pressed }) => [s.back, { top: insets.top + 6 }, pressed && s.pressed]}
      >
        <MaterialCommunityIcons name="chevron-left" size={30} color={colors.white} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  root: { flex: 1, backgroundColor: '#0E1330' },
  fill: { width: '100%', height: '100%' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
  bigYearBox: { position: 'absolute', left: space.l, bottom: space.m, gap: 4 },
  bigYearText: { fontFamily: fonts.display, fontSize: 72, lineHeight: 76, color: colors.white, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 12 },
  col: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: space.l, gap: space.m, marginTop: space.m },
  title: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, color: colors.white, marginTop: space.s },
  where: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: 'rgba(255,255,255,0.85)' },
  years: { gap: space.s },
  year: { minHeight: 48, minWidth: 84, paddingHorizontal: 18, borderRadius: 24, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  yearOn: { backgroundColor: colors.white, borderColor: colors.white },
  yearText: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.white },
  yearTextOn: { color: colors.ink },
  credit: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.6)' },
  section: { gap: space.s, marginTop: space.l },
  h2: { fontFamily: fonts.display, fontSize: 28, color: colors.white },
  line: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: 'rgba(255,255,255,0.85)' },
  card: { backgroundColor: colors.paper, borderRadius: 20, padding: space.s, gap: 6 },
  // the card's own colour behind the letterbox, so an engraving doesn't sit in a grey box
  artwork: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.paper, borderRadius: 14 },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  cameraBox: { width: '100%', aspectRatio: 3 / 4, maxHeight: 520, backgroundColor: '#000', borderRadius: 20, overflow: 'hidden' },
  cameraOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.55 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 56, borderRadius: 28, backgroundColor: colors.white },
  ctaText: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  ghost: { flexGrow: 1, minHeight: 48, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
  error: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#FF9A8A' },
  row: { flexDirection: 'row', gap: space.s, flexWrap: 'wrap' },
  back: { position: 'absolute', left: space.m, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,19,48,0.6)' },
  empty: { fontFamily: fonts.body, fontSize: 17, color: colors.ink, padding: space.m },
});
