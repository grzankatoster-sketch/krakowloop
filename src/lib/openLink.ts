import { Alert, Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

/** Opens an external link; when that fails, offers the address to copy. */
export async function openLink(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    if (Platform.OS === 'web') {
      window.prompt('This link couldn’t be opened. Copy it from here:', url);
      return;
    }
    Alert.alert('Link not opened', `This link couldn’t be opened:\n${url}`, [
      {
        text: 'Copy link',
        onPress: () => {
          Clipboard.setStringAsync(url).catch(() => undefined);
        },
      },
      { text: 'OK', style: 'cancel' },
    ]);
  }
}
