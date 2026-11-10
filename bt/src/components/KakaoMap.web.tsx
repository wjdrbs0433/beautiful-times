import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { MapProps, mapConfig, readMapMessage } from "./KakaoMap.types";
import MapPlaceholder from "./MapPlaceholder";
export default function KakaoMap(props: MapProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const latest = useRef(props);
  useEffect(() => { latest.current = props; }, [props]);
  const [readyKey, setReadyKey] = useState("");
  const ready = !!props.apiKey && readyKey === props.apiKey;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const uri =
    origin + "/kakao-map.html?v=3&key=" + encodeURIComponent(props.apiKey);
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== origin ||
        event.source !== ref.current?.contentWindow
      )
        return;
      const d = readMapMessage(event.data);
      if (d?.type === "ready") {
        setReadyKey(latest.current.apiKey);
        ref.current?.contentWindow?.postMessage(
          mapConfig(latest.current),
          origin,
        );
      } else if (d?.type === "error")
        latest.current.onResults?.(
          latest.current.requestId ?? "",
          (latest.current.query ?? "").trim(),
          [],
          d.message,
        );
      else if (d?.type === "results")
        latest.current.onResults?.(d.requestId, d.query, d.places, d.error);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [origin]);
  useEffect(() => {
    if (ready)
      ref.current?.contentWindow?.postMessage(mapConfig(props), origin);
  }, [props, ready, origin]);
  if (!props.apiKey) return <MapPlaceholder />;
  return (
    <View style={s.box}>
      <iframe
        key={props.apiKey}
        title="카카오 일정 지도"
        ref={ref}
        src={uri}
        style={{ width: "100%", height: 250, border: 0 }}
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
