import { useEffect, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { APP } from '../config/city';
import { openLink } from '../lib/openLink';
import { MAP_HTML, MapPayload } from './mapHtml';
import { MapHandlers, dispatchMapMessage, parseMapMessage } from './mapMessages';

export interface LoopMapProps extends MapPayload, MapHandlers {
  style?: StyleProp<ViewStyle>;
  /** covered by another view: hidden from screen readers and keyboard focus */
  inactive?: boolean;
}

export default function LoopMap({ points, route, selectedId, fit, fitKey, fitTarget, focus, threeD, inactive, style, ...handlers }: LoopMapProps) {
  const ref = useRef<WebView>(null);
  const payload = JSON.stringify({ points, route, selectedId, fit, fitKey, fitTarget, focus, threeD });
  const latest = useRef(payload);
  const handlersRef = useRef<MapHandlers>(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    latest.current = payload;
    ref.current?.injectJavaScript(`window.__apply && window.__apply(${payload}); true;`);
  }, [payload]);

  const onMessage = (e: WebViewMessageEvent) => {
    const msg = parseMapMessage(e.nativeEvent.data);
    if (!msg) return;
    if (msg.type === 'ready') ref.current?.injectJavaScript(`window.__apply(${latest.current}); true;`);
    dispatchMapMessage(msg, handlersRef.current);
  };

  return (
    <WebView
      ref={ref}
      style={style}
      accessibilityElementsHidden={inactive}
      importantForAccessibility={inactive ? 'no-hide-descendants' : 'auto'}
      originWhitelist={['*']}
      source={{ html: MAP_HTML, baseUrl: APP.webViewBaseUrl }}
      onMessage={onMessage}
      onError={(e) => handlersRef.current.onError?.(e.nativeEvent.description)}
      // The map document itself loads here; links inside it (attribution, logo) open in the browser.
      onShouldStartLoadWithRequest={(req) => {
        const url = req.url;
        if (url === 'about:blank' || url.startsWith(APP.webViewBaseUrl) || url.startsWith('data:')) return true;
        // only web pages leave the map; other schemes could launch arbitrary apps
        if (/^https?:\/\//i.test(url)) openLink(url);
        return false;
      }}
      javaScriptEnabled
      setSupportMultipleWindows={false}
    />
  );
}
