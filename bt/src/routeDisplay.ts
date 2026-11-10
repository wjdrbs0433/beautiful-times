import type { Stop } from './model';

export function routeKey(from: Stop, to: Stop) {
  return JSON.stringify([from.lat, from.lng, to.lat, to.lng, from.mode]);
}
export function durationLabel(seconds: number) {
  const minutes = Math.ceil(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ''}`
    : `${minutes}분`;
}
