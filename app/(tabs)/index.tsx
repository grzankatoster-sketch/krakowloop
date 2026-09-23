import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeScreen } from '../../src/components/home/HomeScreen';
import { colors } from '../../src/theme';

export default function Home() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={['top']}>
      <HomeScreen />
    </SafeAreaView>
  );
}
