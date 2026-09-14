import { useCallback, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, PanResponderGestureState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Eyebrow, TopBar } from '../../src/components/ui';
import { EpochRuler } from '../../src/components/EpochRuler';
import { DragSlider } from '../../src/components/DragSlider';
import { LensPoint, lensById } from '../../src/data/lens';
import { openLink } from '../../src/lib/openLink';
import { colors, fonts, space } from '../../src/theme';

export default function LensScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const point = lensById(String(id));

  if (!point) {
    return (
      <SafeAreaView style={s.safe}>
        <TopBar title="Time Lens" />
        <Text style={s.empty}>This viewpoint doesn’t exist. Go back and pick one from the list.</Text>
      </SafeAreaView>
    );
  }
  // A new viewpoint gets a fresh viewer: first layer, overlay centred.
  return <LensViewer key={point.id} point={point} />;
}

const ORIGIN = { x: 0, y: 0 };
/** one tap of a move button, in points */
const STEP = 16;

function LensViewer({ point }: { point: LensPoint }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraWanted, setCameraWanted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [layerIdx, setLayerIdx] = useState(0);
  const [opacity, setOpacity] = useState(0.6);
  const [scale, setScale] = useState(1);
  const [placed, setPlaced] = useState(ORIGIN);
  const [dragging, setDragging] = useState(ORIGIN);
  const [more, setMore] = useState(false);
  const focused = useRef(true);

  // Release the camera whenever this screen is not the one in front.
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
        setCameraWanted(false);
      };
    }, []),
  );

  const drag = useMemo(() => {
    const commit = (g: PanResponderGestureState) => {
      setPlaced((p) => ({ x: p.x + g.dx, y: p.y + g.dy }));
      setDragging(ORIGIN);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => setDragging({ x: g.dx, y: g.dy }),
      onPanResponderRelease: (_, g) => commit(g),
      onPanResponderTerminate: (_, g) => commit(g),
    });
  }, []);

  const move = (dx: number, dy: number) => setPlaced((p) => ({ x: p.x + dx, y: p.y + dy }));
  const resetOverlay = () => {
    setPlaced(ORIGIN);
    setDragging(ORIGIN);
    setScale(1);
  };

  const layer = point.layers[Math.min(layerIdx, point.layers.length - 1)];
  const cameraOn = cameraWanted && !!permission?.granted;
  const referenceVisible = !cameraOn && !!point.reference;
  const offset = { x: placed.x + dragging.x, y: placed.y + dragging.y };

  const startCamera = async () => {
    try {
      const res = permission?.granted ? permission : await requestPermission();
      // the permission dialog can outlive the screen: never start a camera nobody sees
      if (!focused.current) return;
      if (res.granted) {
        setCameraError(null);
        setCameraWanted(true);
      } else {
        setCameraError('Camera access was not allowed, so the reference photo is shown instead.');
      }
    } catch {
      if (focused.current) setCameraError('The camera could not be started on this device.');
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TopBar title={point.name} />
      <View style={s.stage}>
        {cameraOn ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onMountError={(e) => {
              setCameraWanted(false);
              setCameraError(`The camera could not start: ${e.message}`);
            }}
          />
        ) : point.reference ? (
          <Image source={point.reference.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : !layer.image ? (
          <Text style={s.stageHint}>Turn on the camera at the spot to see the present day.</Text>
        ) : null}

        {layer.image ? (
          <View style={StyleSheet.absoluteFill} {...drag.panHandlers}>
            <Image
              source={layer.image}
              resizeMode="contain"
              style={[
                StyleSheet.absoluteFill,
                { opacity, transform: [{ translateX: offset.x }, { translateY: offset.y }, { scale }] },
              ]}
              accessibilityLabel={layer.title}
            />
          </View>
        ) : null}
        <Text style={s.standAt}>Stand at: {point.where}</Text>
        {layer.image ? <Text style={s.dragHint}>Drag the picture to line it up</Text> : null}
      </View>

      {/* Everything needed while framing stays within thumb reach; the rest opens on demand. */}
      <View style={s.panel}>
        <View style={s.panelInner}>
          <EpochRuler items={point.layers} index={layerIdx} onChange={setLayerIdx} />
          <Text style={s.title} numberOfLines={1}>
            {layer.image ? layer.title : 'Today'}
          </Text>
          {layer.image ? <DragSlider label="See-through" value={opacity} onChange={setOpacity} /> : null}
          <View style={s.row}>
            {cameraOn ? (
              <Button label="Stop the camera" kind="quiet" onPress={() => setCameraWanted(false)} style={s.grow} />
            ) : (
              <Button label="Use my camera" onPress={startCamera} style={s.grow} />
            )}
            <Button label={more ? 'Less' : 'Adjust & sources'} kind="quiet" onPress={() => setMore((v) => !v)} style={s.grow} />
          </View>
          {cameraError ? (
            <Text style={s.error} accessibilityLiveRegion="polite">
              {cameraError}
            </Text>
          ) : null}
          {permission && !permission.granted && !permission.canAskAgain ? (
            <Text style={s.credit}>Camera access is off. Turn it on for KrakowLoop in your phone’s settings.</Text>
          ) : null}
        </View>

        {more ? (
          <ScrollView style={s.more} contentContainerStyle={s.moreInner}>
            {layer.image ? (
              <>
                <Eyebrow>Line up the picture</Eyebrow>
                <View style={s.row}>
                  <Button label="←" kind="quiet" onPress={() => move(-STEP, 0)} style={s.grow} />
                  <Button label="↑" kind="quiet" onPress={() => move(0, -STEP)} style={s.grow} />
                  <Button label="↓" kind="quiet" onPress={() => move(0, STEP)} style={s.grow} />
                  <Button label="→" kind="quiet" onPress={() => move(STEP, 0)} style={s.grow} />
                </View>
                <View style={s.row}>
                  <Button label="Smaller" kind="quiet" onPress={() => setScale((v) => Math.max(0.4, +(v - 0.1).toFixed(2)))} style={s.grow} />
                  <Button label="Bigger" kind="quiet" onPress={() => setScale((v) => Math.min(3, +(v + 0.1).toFixed(2)))} style={s.grow} />
                  <Button label="Reset" kind="quiet" onPress={resetOverlay} style={s.grow} />
                </View>
              </>
            ) : null}

            <Eyebrow>Sources</Eyebrow>
            {layer.image ? (
              <Pressable accessibilityRole="link" onPress={() => openLink(layer.sourceUrl)}>
                <Text style={s.credit}>
                  {layer.title}: {layer.credit} · {layer.license} · Wikimedia Commons
                </Text>
              </Pressable>
            ) : null}
            {cameraOn ? <Text style={s.credit}>Live camera. Nothing is recorded or uploaded.</Text> : null}
            {referenceVisible && point.reference ? (
              <Pressable accessibilityRole="link" onPress={() => openLink(point.reference!.sourceUrl)}>
                <Text style={s.credit}>
                  {layer.image ? 'Behind it: ' : ''}photo by {point.reference.credit} · {point.reference.license} · Wikimedia Commons
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  stage: { flex: 1, minHeight: 240, backgroundColor: colors.ink, overflow: 'hidden', justifyContent: 'center' },
  stageHint: { fontFamily: fonts.body, fontSize: 15, color: colors.stone, textAlign: 'center', padding: space.l },
  standAt: {
    position: 'absolute',
    top: space.s,
    left: space.s,
    right: space.s,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.onScrim,
    backgroundColor: colors.scrim,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
  },
  dragHint: {
    position: 'absolute',
    bottom: space.s,
    alignSelf: 'center',
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.onScrim,
    backgroundColor: colors.scrim,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  panel: { backgroundColor: colors.paper, borderTopWidth: 1, borderColor: colors.line },
  panelInner: { padding: space.m, gap: space.s, width: '100%', maxWidth: 560, alignSelf: 'center' },
  more: { maxHeight: 220, borderTopWidth: 1, borderColor: colors.line },
  moreInner: { padding: space.m, gap: space.s, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  credit: { fontFamily: fonts.body, fontSize: 13, color: colors.mute },
  error: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.brick },
  row: { flexDirection: 'row', gap: space.s },
  grow: { flex: 1, paddingHorizontal: 8 },
  empty: { fontFamily: fonts.body, fontSize: 16, color: colors.ink, padding: space.m },
});
