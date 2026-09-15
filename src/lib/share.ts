import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

const isCancel = (e: unknown) => typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError';

async function copy(url: string): Promise<ShareResult> {
  try {
    const ok = await Clipboard.setStringAsync(url);
    // on the web a refused copy resolves to false instead of throwing
    return ok === false ? 'failed' : 'copied';
  } catch {
    return 'failed';
  }
}

/**
 * Opens the share sheet; where there is none (desktop browsers) the link is copied instead.
 * Closing the share sheet is respected: the link, which may hold an approximate start point,
 * is then not copied anywhere.
 */
export async function shareLink(title: string, url: string): Promise<ShareResult> {
  if (Platform.OS === 'web') {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return 'shared';
      } catch (e) {
        if (isCancel(e)) return 'cancelled';
        return copy(url);
      }
    }
    return copy(url);
  }
  try {
    // iOS shows message and url separately; Android only reads message
    const result = await Share.share(Platform.OS === 'ios' ? { message: title, url } : { message: `${title}\n${url}` });
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
  } catch {
    return copy(url);
  }
}
