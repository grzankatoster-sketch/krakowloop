import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export type ShareResult = 'shared' | 'copied' | 'failed';

/** Opens the share sheet; where there is none (desktop browsers) the link is copied instead. */
export async function shareLink(title: string, url: string): Promise<ShareResult> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, url });
        return 'shared';
      }
      await Clipboard.setStringAsync(url);
      return 'copied';
    }
    // iOS shows message and url separately; Android only reads message
    await Share.share(Platform.OS === 'ios' ? { message: title, url } : { message: `${title}\n${url}` });
    return 'shared';
  } catch {
    try {
      await Clipboard.setStringAsync(url);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
}
