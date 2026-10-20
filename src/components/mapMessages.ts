// The protocol between the map document (WebView or iframe) and the app.
// Parsing is kept apart from handling, so a bug in a screen callback is never swallowed
// as "malformed message".

export type MapMessage =
  | { type: 'ready' }
  | { type: 'select'; id: string }
  | { type: 'error'; message: string }
  | { type: 'warning'; message: string };

export function parseMapMessage(raw: unknown): MapMessage | null {
  if (typeof raw !== 'string' || raw.length > 2000) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const { type, id, message } = value as Record<string, unknown>;
  const text = typeof message === 'string' && message ? message.slice(0, 300) : 'Unknown map problem.';
  switch (type) {
    case 'ready':
      return { type: 'ready' };
    case 'select':
      return typeof id === 'string' && id.length > 0 && id.length <= 64 ? { type: 'select', id } : null;
    case 'error':
      return { type: 'error', message: text };
    case 'warning':
      return { type: 'warning', message: text };
    default:
      return null;
  }
}

export interface MapHandlers {
  onReady?: () => void;
  onSelect?: (id: string) => void;
  onError?: (message: string) => void;
  onWarning?: (message: string) => void;
}

export function dispatchMapMessage(msg: MapMessage, h: MapHandlers) {
  if (msg.type === 'ready') h.onReady?.();
  else if (msg.type === 'select') h.onSelect?.(msg.id);
  else if (msg.type === 'error') h.onError?.(msg.message);
  else h.onWarning?.(msg.message);
}

// ---- app -> map: how much of the map's bottom edge another view covers ---------------------------
// The drawer on the map screen lies over the lower part of the map. The map document moves its
// logo and attribution control up by this much, so they are never hidden (a licence requirement).

export const MAX_INSET = 4000;

/** a pixel count the map document will accept: finite, whole, between 0 and MAX_INSET */
export function clampInset(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_INSET, Math.round(value));
}

/** the message the iframe (web preview) receives; the WebView calls window.__inset directly */
export function insetMessage(px: unknown): string {
  return JSON.stringify({ type: 'inset', value: clampInset(px) });
}

/** the script the WebView runs to hand the map the covered height */
export function insetScript(px: unknown): string {
  return `window.__inset && window.__inset(${clampInset(px)}); true;`;
}
