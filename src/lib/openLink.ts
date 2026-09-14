import { Alert, Linking, Platform } from 'react-native';

/** Opens an external link and tells the user when that fails, with the address to copy. */
export async function openLink(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    const message = `This link couldn't be opened. You can copy it instead:\n${url}`;
    if (Platform.OS === 'web') window.alert(message);
    else Alert.alert('Link not opened', message);
  }
}
