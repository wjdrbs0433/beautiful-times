import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TurboModuleRegistry } from "react-native";
import type { WebView } from "react-native-webview";
import Constants from "expo-constants";
import { MapProps, mapConfig, readMapMessage } from "./KakaoMap.types";
import MapPlaceholder from "./MapPlaceholder";
export default function KakaoMap(props: MapProps) {
  const ref = useRef<WebView>(null);
  const [readyUri, setReadyUri] = useState("");
  const latest = useRef(props);
  useEffect(() => { latest.current = props; }, [props]);
  const base = (
    process.env.EXPO_PUBLIC_MAP_BASE_URL ||
    `http://${Constants.expoConfig?.hostUri || "127.0.0.1:8081"}`
  ).replace(/\/$/, "");
  const uri = base + "/kakao-map.html?v=3&key=" + encodeURIComponent(props.apiKey);
  const ready = readyUri === uri;
  useEffect(() => {
    if (ready) ref.current?.postMessage(JSON.stringify(mapConfig(props)));
  }, [ready, props]);
  if (!props.apiKey) return <MapPlaceholder />;
  const WebViewComponent = TurboModuleRegistry.get("RNCWebViewModule")
    // Keep the previously installed development build usable until its native update.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ? require("react-native-webview").WebView
    : null;
  if (!WebViewComponent)
    return (
      <View style={s.box}>
        <Text style={s.caption}>
          지도 모듈을 업데이트하고 있어요. Android 앱 재설치가 끝나면 사용할 수
          있어요.
        </Text>
      </View>
    );
  return (
    <View style={s.box}>
      <WebViewComponent
        key={uri}
        ref={ref}
        source={{ uri }}
        style={{ height: 250, backgroundColor: "#EEF1EA" }}
        javaScriptEnabled
        originWhitelist={[base]}
        onShouldStartLoadWithRequest={(request: { url: string }) =>
          request.url.startsWith(base + "/kakao-map.html") ||
          request.url === "about:blank"
        }
        onMessage={(event: { nativeEvent: { data: string } }) => {
          const d = readMapMessage(event.nativeEvent.data);
          if (d?.type === "ready") {
            setReadyUri(uri);
            ref.current?.postMessage(JSON.stringify(mapConfig(latest.current)));
          } else if (d?.type === "error")
            latest.current.onResults?.(
              latest.current.requestId ?? "",
              (latest.current.query ?? "").trim(),
              [],
              d.message,
            );
          else if (d?.type === "results")
            latest.current.onResults?.(d.requestId, d.query, d.places, d.error);
        }}
        renderError={() => (
          <Text style={s.caption}>
            지도 페이지에 연결하지 못했어요. 개발 서버와 USB 연결을 확인해
            주세요.
          </Text>
        )}
      />
      <Text style={s.caption}>
        장소를 고르거나 순서를 바꾸면 지도에 바로 반영돼요.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: "#DDE3D6",
    borderRadius: 7,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  caption: { fontSize: 10, color: "#687862", padding: 8 },
});
