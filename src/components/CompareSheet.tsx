// Places to eat side by side, one column each: the walk, open now and until when, what they serve.
// The best walk and the longest opening are marked; a tap on a name opens that place on the map.
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CompareFacts, winners } from '../lib/compare';
import { formatTime } from '../lib/hours';
import { t } from '../i18n';
import type { StringKey } from '../i18n/en';
import { colors, fonts, space } from '../theme';

interface Props {
  cols: CompareFacts[];
  /** minutes after midnight in Kraków, for "until 22:00" */
  now: number;
  onClose: () => void;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}

export function CompareSheet({ cols, now, onClose, onOpen, onRemove }: Props) {
  const insets = useSafeAreaInsets();
  const win = winners(cols);
  const lines: { key: string; label: string; cell: (c: CompareFacts) => string; best?: string | null }[] = [
    { key: 'walk', label: t('compare.walk'), cell: (c) => t('story.walk', { n: c.walk }), best: win.walk },
    {
      key: 'open',
      label: t('compare.open'),
      cell: (c) => (c.open === null ? t('compare.unknown') : c.open ? t('compare.until', { time: formatTime(now + (c.left ?? 0)) }) : t('discover.closedNow')),
      best: win.left,
    },
    { key: 'food', label: t('compare.food'), cell: (c) => c.cuisines.map((x) => t(`cuisine.${x}` as StringKey)).join(', ') || '–' },
    { key: 'diet', label: t('compare.diet'), cell: (c) => c.diet.map((d) => t(`discover.diet.${d}` as StringKey)).join(', ') || '–' },
    { key: 'pick', label: t('discover.pick'), cell: (c) => (c.pick ? t('compare.yes') : '–') },
    { key: 'contact', label: t('compare.contact'), cell: (c) => [c.website ? t('place.website') : '', c.phone ?? ''].filter(Boolean).join(' · ') || '–' },
  ];

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.root, { paddingBottom: insets.bottom + space.m }]}>
        <View style={s.head}>
          <Text style={s.title} accessibilityRole="header">
            {t('compare.title')}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('compare.close')} onPress={onClose} hitSlop={8} style={s.close}>
            <MaterialCommunityIcons name="close" size={24} color={colors.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.body}>
          <View style={s.row}>
            <View style={s.labelCell} />
            {cols.map((c) => (
              <View key={c.id} style={s.cell}>
                <Pressable accessibilityRole="link" onPress={() => onOpen(c.id)}>
                  <Text style={s.name} numberOfLines={3}>
                    {c.name}
                  </Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={t('compare.remove', { name: c.name })} onPress={() => onRemove(c.id)} hitSlop={6}>
                  <Text style={s.remove}>{t('compare.removeShort')}</Text>
                </Pressable>
              </View>
            ))}
          </View>
          {lines.map((l) => (
            <View key={l.key} style={[s.row, s.line]}>
              <Text style={[s.labelCell, s.label]}>{l.label}</Text>
              {cols.map((c) => (
                <View key={c.id} style={[s.cell, l.best === c.id && s.bestCell]}>
                  <Text style={[s.value, l.best === c.id && s.bestValue]}>{l.cell(c)}</Text>
                </View>
              ))}
            </View>
          ))}
          <Text style={s.fine}>{t('compare.note')}</Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.m, paddingTop: space.l, paddingBottom: space.s },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.ink },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.stone },
  body: { paddingHorizontal: space.m, paddingBottom: space.l },
  row: { flexDirection: 'row', gap: 6 },
  line: { borderTopWidth: 1, borderColor: colors.line, paddingVertical: 10 },
  labelCell: { width: 76 },
  label: { fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 0.6, color: colors.mute, textTransform: 'uppercase' },
  cell: { flex: 1, borderRadius: 10, padding: 4 },
  bestCell: { backgroundColor: 'rgba(47,111,94,0.12)' },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 20, color: colors.ink, textDecorationLine: 'underline' },
  remove: { fontFamily: fonts.body, fontSize: 13, color: colors.mute, marginTop: 4, marginBottom: space.s },
  value: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: colors.ink },
  bestValue: { fontFamily: fonts.bodyBold, color: colors.patina },
  fine: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.mute, marginTop: space.m },
});
