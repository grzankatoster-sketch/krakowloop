import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeScreen } from '../../src/components/home/HomeScreen';
import { colors } from '../../src/theme';

export default function Home() {
  // ink behind the status bar: it meets the hero band
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ink }} edges={['top']}>
      <HomeScreen />
    </SafeAreaView>
  );
}
