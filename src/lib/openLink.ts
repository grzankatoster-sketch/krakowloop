import { Alert, Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { t } from '../i18n';

/** A web page address that is safe to open: http or https, no user name or password. Anything else is null. */
export function safeWebUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Opens an external link; when that fails, offers the address to copy. */
export async function openLink(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    if (Platform.OS === 'web') {
      window.prompt(t('link.copyPrompt'), url);
      return;
    }
    Alert.alert(t('link.failedTitle'), `${t('link.failedText')}\n${url}`, [
      {
        text: t('link.copy'),
        onPress: () => {
          Clipboard.setStringAsync(url).catch(() => undefined);
        },
      },
      { text: 'OK', style: 'cancel' },
    ]);
  }
}
