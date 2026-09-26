import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { t } from '../../src/i18n';
import { colors } from '../../src/theme';

/**
 * The platform's own tab bar: Liquid Glass on iOS, Material on Android. Four places, each a thing a
 * traveller does: what is around now, find something, look into the past, the days ahead.
 */
export default function TabLayout() {
  return (
    // labels always on: many visitors are older, an icon alone is a guess
    <NativeTabs tintColor={colors.brick} minimizeBehavior="onScrollDown" labelVisibilityMode="labeled">
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
