export type Space = "couple" | "family";
export type Mode = "walk" | "car" | "transit" | "bicycle";
export type Stop = {
  id: string;
  name: string;
  time: string;
  note: string;
  mode: Mode;
  placeId?: string;
  address?: string;
  roadAddress?: string;
  lat?: number;
  lng?: number;
  placeUrl?: string;
};
export type Plan = {
  id: string;
  space: Space;
  title: string;
  date: string;
  stops: Stop[];
};
export type Photo = {
  id: string;
  space: Space;
  uri: string;
  storagePath?: string;
  caption: string;
  date: string;
  quality: "original" | "high";
  bytes: number;
};
export type Entry = {
  id: string;
  space: Space;
  title: string;
  body: string;
  date: string;
  audience: "all" | "private";
  kind: "day" | "letter";
};
export type MemoryState = {
  version: 1;
  onboarded: boolean;
  anniversaries: Partial<Record<Space, string>>;
  covers?: Partial<Record<Space, string>>;
  kakaoJsKey?: string;
  plans: Plan[];
  photos: Photo[];
  entries: Entry[];
};
export const initialState: MemoryState = {
  version: 1,
  onboarded: false,
  anniversaries: {},
  plans: [],
  photos: [],
  entries: [],
};
export const modes: Record<
  Mode,
  {
    label: string;
    icon: "walk-outline" | "car-outline" | "bus-outline" | "bicycle-outline";
  }
> = {
  walk: { label: "걷기", icon: "walk-outline" },
  car: { label: "자동차", icon: "car-outline" },
  transit: { label: "대중교통", icon: "bus-outline" },
  bicycle: { label: "자전거", icon: "bicycle-outline" },
};
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}
export function dayCount(start: string, end = today()) {
  const asDay = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
  };
  const diff = asDay(end) - asDay(start);
  return diff >= 0 ? `D+${diff + 1}` : `D${diff}`;
}
export function dateLabel(date: string) {
  if (!validDate(date)) return date;
  const [y, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일 · ${"일월화수목금토"[new Date(y, m - 1, d).getDay()]}요일`;
}
export function validStop(stop: Stop) {
  return !!stop.name.trim() && /^([01]\d|2[0-3]):[0-5]\d$/.test(stop.time);
}
export function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
