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
