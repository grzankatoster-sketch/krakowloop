import { useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, LayoutChangeEvent, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBar } from '../src/components/ui';
import { MAP_PROVIDER } from '../src/components/mapHtml';
import { AFFILIATE_NOTE } from '../src/config/affiliates';
import { LANDMARKS_3D_CREDIT } from '../src/data/landmarks3d';
import { lensPoints } from '../src/data/lens';
import { PLACE_MEDIA } from '../src/data/placeMedia';
import { placeById } from '../src/data/places';
import { WISH_PROXY_URL } from '../src/config/wish';
import { WALKING_ROUTES_ENABLED } from '../src/lib/directions';
import { HOURS_EXPORTED } from '../src/lib/hours';
import { openLink } from '../src/lib/openLink';
import { TRANSIT_FEED_VERSION } from '../src/lib/transit';
import { t } from '../src/i18n';
import { colors, fonts, space } from '../src/theme';

interface Credit {
  key: string;
  title: string;
  credit: string;
  license: string;
  url: string;
}

const LENS_CREDITS: Credit[] = lensPoints.flatMap((p) => [
  ...(p.reference
    ? [{ key: `${p.id}-ref`, title: t('about.today', { name: p.name }), credit: p.reference.credit, license: p.reference.license, url: p.reference.sourceUrl }]
    : []),
  ...p.layers
    .filter((l) => l.image)
    .map((l) => ({ key: l.key, title: l.title, credit: l.credit, license: l.license, url: l.sourceUrl })),
]);

const PLACE_CREDITS: Credit[] = Object.entries(PLACE_MEDIA)
  .filter(([, m]) => m.image && m.sourceUrl)
  .map(([id, m]) => ({ key: `place-${id}`, title: placeById(id)?.name ?? id, credit: m.credit ?? '', license: m.license ?? '', url: m.sourceUrl! }))
  .sort((a, b) => a.title.localeCompare(b.title));

type SectionKey = 'privacy' | 'links' | 'accuracy' | 'data' | 'images';
const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'privacy', label: t('about.privacy') },
  { key: 'links', label: t('about.links') },
  { key: 'accuracy', label: t('about.accuracy') },
  { key: 'data', label: t('about.data') },
  { key: 'images', label: t('about.images') },
];

function Section({
  title,
  children,
  onLayout,
  ref,
}: {
  title: string;
  children: React.ReactNode;
  onLayout: (e: LayoutChangeEvent) => void;
  /** the section heading, which takes focus after a jump */
  ref: React.Ref<Text>;
}) {
  return (
    <View style={s.section} onLayout={onLayout}>
      <Text ref={ref} style={s.h2} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Link({ label, url }: { label: string; url: string }) {
  return (
    <Pressable accessibilityRole="link" onPress={() => openLink(url)}>
      <Text style={s.link}>{label}</Text>
    </Pressable>
  );
}

/** A group of image credits that opens on demand, so one licence is easy to find again. */
function CreditGroup({ title, credits, initiallyOpen }: { title: string; credits: Credit[]; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={s.group}>
      <Pressable
        accessibilityRole="button"
        // aria-expanded, not accessibilityState: react-native-web leaves out a false `expanded`,
        // so a closed group would never be announced as collapsed
        aria-expanded={open}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => [s.groupHead, pressed && { opacity: 0.8 }]}
      >
        <Text style={s.groupTitle}>
          {title} ({credits.length})
        </Text>
        <Text style={s.link}>{open ? t('brief.hide') : t('brief.show')}</Text>
      </Pressable>
      {open
        ? credits.map((c) => (
            <Pressable key={c.key} accessibilityRole="link" onPress={() => openLink(c.url)} style={s.credit}>
              <Text style={s.creditTitle}>{c.title}</Text>
              <Text style={s.creditLine}>
                {c.credit} · {c.license} · Wikimedia Commons
              </Text>
            </Pressable>
          ))
        : null}
    </View>
  );
}

export default function About() {
  const scroll = useRef<ScrollView>(null);
  // Section positions come from layout and live in state: layout handlers are made during render,
  // and writing a ref from them is something the React Compiler lint can't prove safe.
  const [offsets, setOffsets] = useState<Partial<Record<SectionKey, number>>>({});
  const remember = (key: SectionKey) => (e: LayoutChangeEvent) => {
    const y = e.nativeEvent.layout.y;
    setOffsets((o) => (o[key] === y ? o : { ...o, [key]: y }));
  };
  // one ref per heading, passed straight to `ref`: the React Compiler lint only reads them as refs that way
  const privacyHeading = useRef<Text>(null);
  const linksHeading = useRef<Text>(null);
  const accuracyHeading = useRef<Text>(null);
  const dataHeading = useRef<Text>(null);
  const imagesHeading = useRef<Text>(null);
  // Scrolling alone leaves keyboard and screen reader users on the button: move their focus to the section too.
  const jump = (key: SectionKey) => {
    scroll.current?.scrollTo({ y: Math.max(0, (offsets[key] ?? 0) - space.s), animated: true });
    const headings = { privacy: privacyHeading, links: linksHeading, accuracy: accuracyHeading, data: dataHeading, images: imagesHeading };
    const el = headings[key].current;
    if (!el) return;
    if (Platform.OS === 'web') {
      const node = el as unknown as HTMLElement;
      node.setAttribute('tabindex', '-1');
      node.focus({ preventScroll: true });
    } else {
      const tag = findNodeHandle(el);
      if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TopBar title={t('about.title')} />
      <ScrollView ref={scroll} contentContainerStyle={s.scroll}>
        <View style={s.col}>
          <View style={s.jumps} accessibilityLabel={t('about.onThisPage')}>
            {SECTIONS.map((sec) => (
              <Pressable
                key={sec.key}
                accessibilityRole="button"
                accessibilityLabel={t('about.goTo', { section: sec.label })}
                onPress={() => jump(sec.key)}
                style={({ pressed }) => [s.jump, pressed && { opacity: 0.8 }]}
              >
                <Text style={s.jumpText}>{sec.label}</Text>
              </Pressable>
            ))}
          </View>

          <Section title={t('about.privacy')} onLayout={remember('privacy')} ref={privacyHeading}>
            <Text style={s.p}>{t('about.p1')}</Text>
            <Text style={s.p}>{t('about.p2')}</Text>
            <Text style={s.p}>
              {t('about.p3', { nearMe: t('map.nearMe'), walkHere: t('walk.here'), whereIAm: t('plan.whereIAm') })}
              {WALKING_ROUTES_ENABLED ? t('about.p3route') : ''}
              {t('about.p3share')}
            </Text>
            <Text style={s.p}>{t('about.rides')}</Text>
            {WISH_PROXY_URL ? <Text style={s.p}>{t('about.wish')}</Text> : null}
            <Text style={s.p}>
              {t('about.p4', { provider: MAP_PROVIDER === 'mapbox' ? 'Mapbox' : 'OpenFreeMap' })}
            </Text>
          </Section>

          <Section title={t('about.links')} onLayout={remember('links')} ref={linksHeading}>
            <Text style={s.p}>
              {t('about.linksText', { note: AFFILIATE_NOTE })}
            </Text>
          </Section>

          <Section title={t('about.accuracyTitle')} onLayout={remember('accuracy')} ref={accuracyHeading}>
            <Text style={s.p}>
              {t('about.accuracyText', { date: HOURS_EXPORTED, feed: TRANSIT_FEED_VERSION })}
            </Text>
          </Section>

          <Section title={t('about.data')} onLayout={remember('data')} ref={dataHeading}>
            <Text style={s.p}>{t('about.osm')}</Text>
            <Link label="openstreetmap.org/copyright" url="https://www.openstreetmap.org/copyright" />
            <Text style={s.p}>{t('about.gtfs')}</Text>
            <Link label="gtfs.ztp.krakow.pl" url="https://gtfs.ztp.krakow.pl/" />
            <Text style={s.p}>{t('about.wiki')}</Text>
            {MAP_PROVIDER === 'mapbox' ? <Text style={s.p}>{LANDMARKS_3D_CREDIT}.</Text> : null}
            <Text style={s.p}>
              {t('about.map', { credit: MAP_PROVIDER === 'mapbox' ? '© Mapbox, © OpenStreetMap' : 'OpenFreeMap, © OpenMapTiles, © OpenStreetMap' })}
              {WALKING_ROUTES_ENABLED ? t('about.routes') : ''}
            </Text>
          </Section>

          <Section title={t('about.images')} onLayout={remember('images')} ref={imagesHeading}>
            <CreditGroup title={t('lens.title')} credits={LENS_CREDITS} initiallyOpen />
            <CreditGroup title={t('about.placePhotos')} credits={PLACE_CREDITS} initiallyOpen={false} />
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.stone },
  scroll: { paddingBottom: space.xl },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.m },
  jumps: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s, marginTop: space.s },
  jump: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  jumpText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  section: { marginTop: space.l, gap: space.s },
  h2: { fontFamily: fonts.bodyBold, fontSize: 19, color: colors.ink },
  p: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.vistula },
  group: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: space.m },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  groupTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  credit: { paddingBottom: space.s },
  creditTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  creditLine: { fontFamily: fonts.body, fontSize: 13, color: colors.mute },
});
