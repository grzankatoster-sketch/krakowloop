import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button } from './ui';
import { t } from '../i18n';
import { openLink } from '../lib/openLink';
import { BOLT_LINK, RideDestination, rideAddress, uberLink } from '../lib/rideLinks';
import { colors, fonts, space } from '../theme';

/**
 * Hands a ride over to Uber or Bolt. KrakowLoop books nothing and takes no money: it opens the
 * provider's app with the destination, and says so, because the destination leaves the app.
 */
export function RideButtons({ to }: { to: RideDestination }) {
  const [note, setNote] = useState<string | null>(null);

  const copyAddress = async () => {
    let ok = false;
    try {
      // on the web a refused copy resolves to false instead of throwing
      ok = (await Clipboard.setStringAsync(rideAddress(to))) !== false;
    } catch {
      ok = false;
    }
    const text = ok ? t('ride.copied') : t('ride.copyFailed', { address: rideAddress(to) });
    setNote(text);
    AccessibilityInfo.announceForAccessibility(text);
  };

  return (
    <View style={s.box}>
      <View style={s.row}>
        <Button label={t('ride.uber')} onPress={() => openLink(uberLink(to))} style={s.grow} />
        <Button label={t('ride.bolt')} kind="quiet" onPress={() => openLink(BOLT_LINK)} style={s.grow} />
      </View>
      <Button label={t('ride.copy')} kind="quiet" onPress={copyAddress} />
      <Text style={s.small}>{note ?? t('ride.note')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: { gap: space.s, marginTop: space.s },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s },
  grow: { flexGrow: 1 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.mute },
});

/**
 * One "Get a ride" button that opens the ride choices, for screens where three more buttons
 * would crowd out everything else (the place page, the card on the map).
 */
export function RideToggle({ to }: { to: RideDestination }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Button label={t('ride.get')} kind="quiet" expanded={open} onPress={() => setOpen((v) => !v)} />
      {open ? <RideButtons to={to} /> : null}
    </View>
  );
}
