import { createElement, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { MAP_HTML } from './mapHtml';
import type { LoopMapProps } from './LoopMap';
import { MapHandlers, dispatchMapMessage, parseMapMessage } from './mapMessages';

const send = (frame: HTMLIFrameElement | null, payload: string) =>
  frame?.contentWindow?.postMessage(JSON.stringify({ type: 'data', payload: JSON.parse(payload) }), window.location.origin);

// Web preview: same map document, hosted in an iframe instead of a WebView.
export default function LoopMap({ points, route, selectedId, fit, focus, style, ...handlers }: LoopMapProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const payload = JSON.stringify({ points, route, selectedId, fit, focus });
  const latest = useRef(payload);
  const handlersRef = useRef<MapHandlers>(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    latest.current = payload;
    send(frame.current, payload);
  }, [payload]);

  // A blob: document instead of srcDoc: the map never started inside an about:srcdoc frame.
  // Created and revoked in the same effect, so a remount (or Strict Mode) always gets a live URL.
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([MAP_HTML], { type: 'text/html' }));
    if (frame.current) frame.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      const msg = parseMapMessage(e.data);
      if (!msg) return;
      if (msg.type === 'ready') send(frame.current, latest.current);
      dispatchMapMessage(msg, handlersRef.current);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <View style={style}>
      {createElement('iframe', {
        ref: frame,
        title: 'Map',
        style: { border: 0, width: '100%', height: '100%', display: 'block' },
      })}
    </View>
  );
}
