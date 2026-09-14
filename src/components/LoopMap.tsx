import { useEffect, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { MAP_HTML, MapPayload } from './mapHtml';

export interface LoopMapProps extends MapPayload {
  onSelect?: (id: string) => void;
  /** called when the map library, style or tiles fail to load */
  onError?: (message: string) => void;
  style?: StyleProp<ViewStyle>;
}

export default function LoopMap({ points, route, selectedId, fit, onSelect, onError, style }: LoopMapProps) {
  const ref = useRef<WebView>(null);
  const payload = JSON.stringify({ points, route, selectedId, fit });

  useEffect(() => {
    ref.current?.injectJavaScript(`window.__apply && window.__apply(${payload}); true;`);
  }, [payload]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') ref.current?.injectJavaScript(`window.__apply(${payload}); true;`);
      if (msg.type === 'select' && typeof msg.id === 'string') onSelect?.(msg.id);
      if (msg.type === 'error') onError?.(String(msg.message));
    } catch {
      // ignore malformed messages
    }
  };

  return (
    <WebView
      ref={ref}
      style={style}
      originWhitelist={['*']}
      source={{ html: MAP_HTML, baseUrl: 'https://krakowloop.local/' }}
      onMessage={onMessage}
      onError={(e) => onError?.(e.nativeEvent.description)}
      javaScriptEnabled
      setSupportMultipleWindows={false}
    />
  );
}
