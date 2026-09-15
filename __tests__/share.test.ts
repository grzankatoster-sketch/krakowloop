import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// shareLink decides between the share sheet, the clipboard and giving up. The platform, the
// share sheet and the clipboard are replaced here so every path is checked, especially that a
// cancelled share never copies the link (it can hold an approximate start point).

type ShareFn = (content: unknown) => Promise<{ action: string }>;

const mockSetStringAsync = jest.fn<(text: string) => Promise<boolean>>();

/**
 * Loads share.ts in its own module registry with the given platform, share sheet and clipboard.
 * Both mocks are registered inside the isolated registry: a top-level jest.mock doesn't reach it,
 * and the real expo-clipboard would load and fail instead.
 */
function loadShare(os: 'web' | 'ios' | 'android', share?: ShareFn): typeof import('../src/lib/share').shareLink {
  let shareLink: typeof import('../src/lib/share').shareLink | undefined;
  jest.isolateModules(() => {
    jest.doMock('expo-clipboard', () => ({ setStringAsync: (text: string) => mockSetStringAsync(text) }));
    jest.doMock('react-native', () => ({
      Platform: { OS: os },
      Share: { share: share ?? (async () => ({ action: 'sharedAction' })), sharedAction: 'sharedAction', dismissedAction: 'dismissedAction' },
    }));
    // require, not import(): this Jest setup can't run dynamic imports, and the module must load in this registry
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    shareLink = require('../src/lib/share').shareLink;
  });
  return shareLink!;
}

const URL_WITH_START = 'https://example.org/plan?days=2&from=50.064,19.945';
const g = globalThis as unknown as { navigator?: { share?: (data: unknown) => Promise<void> } };
let savedNavigator: typeof g.navigator;

beforeEach(() => {
  mockSetStringAsync.mockReset();
  mockSetStringAsync.mockResolvedValue(true);
  savedNavigator = g.navigator;
});

afterEach(() => {
  g.navigator = savedNavigator;
});

describe('shareLink on the web', () => {
  it('uses the share sheet when there is one, without copying', async () => {
    const share = jest.fn<(data: unknown) => Promise<void>>().mockResolvedValue(undefined);
    g.navigator = { share };
    const shareLink = await loadShare('web');
    await expect(shareLink('My plan', URL_WITH_START)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'My plan', url: URL_WITH_START });
    expect(mockSetStringAsync).not.toHaveBeenCalled();
  });

  it('respects a cancelled share sheet: nothing is copied', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    g.navigator = { share: jest.fn<(data: unknown) => Promise<void>>().mockRejectedValue(abort) };
    const shareLink = await loadShare('web');
    await expect(shareLink('My plan', URL_WITH_START)).resolves.toBe('cancelled');
    expect(mockSetStringAsync).not.toHaveBeenCalled();
  });

  it('copies the link when the share sheet fails for another reason', async () => {
    g.navigator = { share: jest.fn<(data: unknown) => Promise<void>>().mockRejectedValue(new Error('not allowed')) };
    const shareLink = await loadShare('web');
    await expect(shareLink('My plan', URL_WITH_START)).resolves.toBe('copied');
    expect(mockSetStringAsync).toHaveBeenCalledWith(URL_WITH_START);
  });

  it('copies the link where there is no share sheet', async () => {
    g.navigator = {};
    const shareLink = await loadShare('web');
    await expect(shareLink('My plan', URL_WITH_START)).resolves.toBe('copied');
  });

  it('reports failure when even the clipboard refuses', async () => {
    g.navigator = {};
    mockSetStringAsync.mockRejectedValue(new Error('denied'));
    const shareLink = await loadShare('web');
    await expect(shareLink('My plan', URL_WITH_START)).resolves.toBe('failed');
  });
});

describe('shareLink on phones', () => {
  it('Android: the link travels in the message', async () => {
    const share = jest.fn<ShareFn>().mockResolvedValue({ action: 'sharedAction' });
    const shareLink = await loadShare('android', share);
    await expect(shareLink('My plan', URL_WITH_START)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ message: `My plan\n${URL_WITH_START}` });
  });

  it('iOS: message and url are passed separately', async () => {
    const share = jest.fn<ShareFn>().mockResolvedValue({ action: 'sharedAction' });
    const shareLink = await loadShare('ios', share);
    await shareLink('My plan', URL_WITH_START);
    expect(share).toHaveBeenCalledWith({ message: 'My plan', url: URL_WITH_START });
  });

  it('a dismissed share sheet is a cancel: nothing is copied', async () => {
    const shareLink = await loadShare('ios', jest.fn<ShareFn>().mockResolvedValue({ action: 'dismissedAction' }));
    await expect(shareLink('My plan', URL_WITH_START)).resolves.toBe('cancelled');
    expect(mockSetStringAsync).not.toHaveBeenCalled();
  });

  it('copies the link when the share sheet cannot open', async () => {
    const shareLink = await loadShare('android', jest.fn<ShareFn>().mockRejectedValue(new Error('no activity')));
    await expect(shareLink('My plan', URL_WITH_START)).resolves.toBe('copied');
    expect(mockSetStringAsync).toHaveBeenCalledWith(URL_WITH_START);
  });
});
