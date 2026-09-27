import { StyleSheet, Text } from 'react-native';
import { t } from '../i18n';
import { colors, fonts } from '../theme';

/**
 * "Reconstruction", next to a year: a picture we made from written and drawn sources is never passed
 * off as a photograph of the past. Shown wherever a Time Lens layer with `reconstruction` appears.
 */
export function ReconBadge({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <Text style={s.badge} accessibilityRole="text">
      {t('lens.reconstruction')}
    </Text>
  );
}

const s = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    fontFamily: fonts.monoBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.ink,
    backgroundColor: '#F2C66D',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
