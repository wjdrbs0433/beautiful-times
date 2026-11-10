import type { Stop } from "../model";
import type { TravelTime } from "../routes";
import { durationLabel, routeKey } from "../routeDisplay.ts";
export type Place = {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  lat: number;
  lng: number;
  url: string;
};
export type MapProps = {
  apiKey: string;
  stops: Stop[];
  travelTimes?: Record<string, TravelTime>;
  query?: string;
  requestId?: string;
  onResults?: (
    requestId: string,
    query: string,
    places: Place[],
    error?: string,
  ) => void;
};
export type MapMessage =
  | { type: "ready" }
  | { type: "error"; message: string }
  | {
      type: "results";
      requestId: string;
      query: string;
      places: Place[];
      error?: string;
    };
export function readMapMessage(raw: unknown): MapMessage | null {
  try {
    const d = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!d || typeof d !== "object") return null;
    if (d.type === "ready") return { type: "ready" };
    if (d.type === "error" && typeof d.message === "string")
      return { type: "error", message: d.message };
    if (
      d.type !== "results" ||
      typeof d.requestId !== "string" ||
      typeof d.query !== "string" ||
      !Array.isArray(d.places)
    )
      return null;
    const places: Place[] = d.places.filter(
      (p: Place) =>
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        typeof p.address === "string" &&
        typeof p.roadAddress === "string" &&
        typeof p.url === "string" &&
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lng) <= 180,
    );
    return {
      type: "results",
      requestId: d.requestId,
      query: d.query,
      places,
      error: typeof d.error === "string" ? d.error : undefined,
    };
  } catch {
    return null;
  }
}
export function mapConfig(props: MapProps) {
  return {
    type: "configure",
    stops: props.stops.map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
    })),
    segments: props.stops.slice(0, -1).map((from, index) => {
      const to = props.stops[index + 1];
      const time = props.travelTimes?.[from.id];
      const current = time?.routeKey === routeKey(from, to) ? time : undefined;
      const mode = { walk: "걷기", car: "자동차", transit: "대중교통", bicycle: "자전거" }[from.mode];
      const duration = current?.status === "ready" && Number.isFinite(current.seconds) && current.seconds! >= 0
        ? `약 ${durationLabel(current.seconds!)}`
        : current?.status === "error" ? "시간 확인 필요" : "조회 중…";
      return { fromId: from.id, toId: to.id, label: `${index + 1} → ${index + 2} · ${mode} ${duration}` };
    }),
    query: props.query ?? "",
    requestId: props.requestId ?? "",
  };
}
