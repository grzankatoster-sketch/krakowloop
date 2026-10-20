import { Platform } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { t } from '../../src/i18n';
import { colors, fonts } from '../../src/theme';

/**
 * On the web the router draws the tabs as a pill at the top of the page, styled by its own CSS: grey
 * on grey with the brick label (1.8:1), 30 px tall, and too wide for a phone, so "My plan" was cut
 * off. The colours come through the tab options; size and spacing only through CSS, keyed on the
 * roles the tab list renders with. Native tab bars are left exactly as the platform draws them.
 */
const WEB_TABS = Platform.OS === 'web'
  ? {
      backgroundColor: colors.ink,
      indicatorColor: colors.brick,
      labelStyle: { color: 'rgba(255,255,255,0.82)', fontFamily: fonts.bodyBold, fontSize: 14 },
    }
  : {};
// on the web the active label takes the tint (brick on the brick pill would vanish): white there
const TINT = Platform.OS === 'web' ? colors.white : colors.brick;

const WEB_TABS_CSS = `
[role="tablist"][aria-label="Main"]{top:14px!important;height:52px!important;padding:4px!important;max-width:calc(100vw - 24px)!important;box-shadow:0 6px 20px rgba(0,0,0,.18)}
[role="tablist"][aria-label="Main"] [role="tab"]{padding:0 14px!important;border-radius:20px!important}
[role="tablist"][aria-label="Main"] [role="tab"]:focus-visible{outline:2px solid #fff;outline-offset:-4px}
@media (max-width:370px){[role="tablist"][aria-label="Main"] [role="tab"]{padding:0 10px!important}}
`;
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('kl-tabs')) {
  const tag = document.createElement('style');
  tag.id = 'kl-tabs';
  tag.textContent = WEB_TABS_CSS;
  document.head.appendChild(tag);
}

/**
 * The platform's own tab bar: Liquid Glass on iOS, Material on Android. Four places, each a thing a
 * traveller does: what is around now, find something, look into the past, the days ahead.
 */
export default function TabLayout() {
  return (
    // labels always on: many visitors are older, an icon alone is a guess
    // never minimised: on the full-screen stories of Now a shrunken bar hid the way to the other tabs
    <NativeTabs tintColor={TINT} minimizeBehavior="never" labelVisibilityMode="labeled" {...WEB_TABS}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tab.now')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="location.north.circle.fill" md="near_me" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="discover">
        <NativeTabs.Trigger.Label>{t('tab.discover')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="map.fill" md="explore" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="obiektyw">
        <NativeTabs.Trigger.Label>{t('tab.lens')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="hourglass" md="history" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="plan">
        <NativeTabs.Trigger.Label>{t('tab.plan')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="event" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
