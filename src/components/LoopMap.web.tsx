import { createElement, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { MAP_HTML } from './mapHtml';
import type { LoopMapProps } from './LoopMap';

const send = (frame: HTMLIFrameElement | null, payload: string) =>
  frame?.contentWindow?.postMessage(JSON.stringify({ type: 'data', payload: JSON.parse(payload) }), '*');

// Web preview: same map document, hosted in an iframe instead of a WebView.
export default function LoopMap({ points, route, selectedId, fit, onSelect, onError, style }: LoopMapProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const payload = JSON.stringify({ points, route, selectedId, fit });
  const latest = useRef(payload);
  latest.current = payload;
  const handlers = useRef({ onSelect, onError });
  handlers.current = { onSelect, onError };

  // A blob: document instead of srcDoc: the map never started inside an about:srcdoc frame.
  const src = useMemo(() => URL.createObjectURL(new Blob([MAP_HTML], { type: 'text/html' })), []);
  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  useEffect(() => {
    send(frame.current, payload);
  }, [payload]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      try {
        const msg = JSON.parse(String(e.data));
        if (msg.type === 'ready') send(frame.current, latest.current);
        if (msg.type === 'select' && typeof msg.id === 'string') handlers.current.onSelect?.(msg.id);
        if (msg.type === 'error') handlers.current.onError?.(String(msg.message));
      } catch {
        // ignore malformed messages
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <View style={style}>
      {createElement('iframe', {
        ref: frame,
        src,
        title: 'Map of Kraków',
        style: { border: 0, width: '100%', height: '100%', display: 'block' },
      })}
    </View>
  );
}
