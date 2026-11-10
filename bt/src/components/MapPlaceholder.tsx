import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
export default function MapPlaceholder() {
  return (
    <View style={s.box}>
      <Ionicons name="map-outline" size={34} color="#687862" />
      <Text style={s.title}>우리의 동선을 한눈에</Text>
      <Text style={s.body}>
        지도 연결을 준비하고 있어요.{"\n"}개발용 서비스 연결이 끝나면 자동으로 사용할 수 있어요.
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  box: {
    height: 235,
    borderWidth: 1,
    borderColor: "#DDE3D6",
    backgroundColor: "#EEF1EA",
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  title: { fontSize: 16, fontWeight: "600", color: "#333833" },
  body: { fontSize: 12, textAlign: "center", lineHeight: 21, color: "#687862" },
});
