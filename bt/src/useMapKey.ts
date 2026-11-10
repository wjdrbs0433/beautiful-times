import { useEffect, useState } from 'react';
import { ROUTE_BASE } from './routes';

// JavaScript keys are public SDK identifiers, never server credentials.
export function useMapKey(legacyKey: string | undefined, enabled: boolean) {
  const [configured, setConfigured] = useState(process.env.EXPO_PUBLIC_KAKAO_JS_KEY || '');
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const update = async () => {
      try {
        const response = await fetch(ROUTE_BASE + '/public-config', { signal: controller.signal });
        if (!response.ok) return;
        const config = await response.json();
        if (/^[a-f0-9]{32}$/i.test(config.kakaoJsKey) && !controller.signal.aborted) setConfigured(config.kakaoJsKey);
      } catch { /* Existing local configuration continues to work offline. */ }
    };
    void update();
    const timer = setInterval(update, 10000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [enabled]);
  return configured || legacyKey || '';
}
