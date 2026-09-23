import { Tabs } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../../src/i18n';
import { colors, fonts } from '../../src/theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function TabIcon({ name, color }: { name: IconName; color: string }) {
  return <MaterialCommunityIcons name={name} size={28} color={color} aria-hidden />;
}

const icon = (name: IconName) => {
  const TabBarIcon = ({ color }: { color: unknown }) => <TabIcon name={name} color={String(color)} />;
  TabBarIcon.displayName = `TabIcon(${name})`;
  return TabBarIcon;
};

/**
 * Three tabs, always on screen, so nobody has to remember the way back to the map or their plan.
 * Big icons and labels: many visitors are older and not app-savvy.
 */
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.mute,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line, height: 66 + insets.bottom, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 15 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab.home'), tabBarAccessibilityLabel: t('tab.home'), tabBarIcon: icon('home-variant') }} />
      <Tabs.Screen name="map" options={{ title: t('tab.map'), tabBarAccessibilityLabel: t('tab.map'), tabBarIcon: icon('map') }} />
      <Tabs.Screen name="plan" options={{ title: t('tab.plan'), tabBarAccessibilityLabel: t('tab.plan'), tabBarIcon: icon('calendar-check') }} />
    </Tabs>
  );
}
