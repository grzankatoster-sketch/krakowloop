import { useCallback, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, TopBar } from '../../src/components/ui';
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
        <TopBar title={t('lens.title')} />
        <Text style={s.empty}>{t('lens.unknown')}</Text>
      </SafeAreaView>
    );
  }
  return <LensViewer key={point.id} point={point} />;
}

function Credit({ title, credit, license, url }: { title: string; credit: string; license: string; url: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => openLink(url)} hitSlop={6}>
      <Text style={s.credit}>
        {title}. {credit} · {license} · Wikimedia Commons
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

  const current: LensLayer | undefined = photos.find((p) => p.key === shown);
  const choices = [...photos.map((p) => ({ key: p.key, label: p.year })), ...(today ? [{ key: 'today', label: t('lens.today') }] : [])];
  const cameraOn = cameraWanted && !!permission?.granted;
  const overlay = current ?? photos[0];

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

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TopBar title={point.name} />
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.col}>
          <Text style={s.where}>{t('lens.standAt', { where: point.where })}</Text>

          {choices.length ? (
            <>
              <View style={s.frame}>
                {current ? (
                  <Image source={current.image} style={s.picture} resizeMode="contain" accessibilityLabel={current.title} />
                ) : today ? (
                  <Image source={today.image} style={s.picture} resizeMode="contain" accessibilityLabel={today.title} />
                ) : null}
                <Text style={s.badge}>{current ? current.year : t('lens.today')}</Text>
              </View>

              {choices.length > 1 ? (
                <>
                  <Text style={s.hint}>{t('lens.tapYear')}</Text>
                  <View style={s.years}>
                    {choices.map((c) => {
                      const on = c.key === shown;
                      return (
                        <Pressable
                          key={c.key}
                          accessibilityRole="button"
                          accessibilityLabel={c.key === 'today' ? t('lens.today') : t('lens.photoFrom', { year: c.label })}
                          aria-pressed={on}
                          onPress={() => setShown(c.key)}
                          style={StyleSheet.flatten([s.year, on && s.yearOn])}
                        >
                          <Text style={StyleSheet.flatten([s.yearText, on && s.yearTextOn])}>{c.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {current ? (
                <Credit title={current.title} credit={current.credit} license={current.license} url={current.sourceUrl} />
              ) : today ? (
                <Credit title={today.title} credit={today.credit} license={today.license} url={today.sourceUrl} />
              ) : null}
            </>
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
                    <Button
                      label={showOld ? t('lens.hideOld') : t('lens.showOld')}
                      kind="quiet"
                      onPress={() => setShowOld((v) => !v)}
                      style={s.grow}
                    />
                    <Button label={t('lens.stopCamera')} kind="quiet" onPress={() => setCameraWanted(false)} style={s.grow} />
                  </View>
                  <Text style={s.credit}>{t('lens.live')}</Text>
                </>
              ) : (
                <Button label={t('lens.compare')} onPress={startCamera} />
              )}
              {cameraError ? (
                <Text style={s.error} accessibilityLiveRegion="polite">
                  {cameraError}
                </Text>
              ) : null}
              {permission && !permission.granted && !permission.canAskAgain ? (
                <Text style={s.credit}>{t('lens.off')}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  scroll: { paddingBottom: space.xl },
  col: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: space.m, gap: space.m },
  where: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  frame: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.ink, borderRadius: 14, overflow: 'hidden' },
  picture: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    top: space.s,
    left: space.s,
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.onScrim,
    backgroundColor: colors.scrim,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  hint: { fontFamily: fonts.body, fontSize: 16, color: colors.mute },
  years: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  year: {
    minHeight: 56,
    minWidth: 96,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearOn: { backgroundColor: colors.ink },
  yearText: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink },
  yearTextOn: { color: colors.white },
  credit: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.mute },
  section: { gap: space.s, marginTop: space.m },
  h2: { fontFamily: fonts.bodyBold, fontSize: 22, color: colors.ink },
  line: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  card: { backgroundColor: colors.paper, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: space.s, gap: 6 },
  // the card's own colour behind the letterbox, so an engraving doesn't sit in a grey box
  artwork: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.paper, borderRadius: 10 },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  cameraBox: { width: '100%', aspectRatio: 3 / 4, maxHeight: 520, backgroundColor: colors.ink, borderRadius: 14, overflow: 'hidden' },
  cameraOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.55 },
  error: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.brick },
  row: { flexDirection: 'row', gap: space.s, flexWrap: 'wrap' },
  grow: { flexGrow: 1, paddingHorizontal: 8 },
  empty: { fontFamily: fonts.body, fontSize: 17, color: colors.ink, padding: space.m },
});
