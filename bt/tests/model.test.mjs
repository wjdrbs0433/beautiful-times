import test from "node:test";
import assert from "node:assert/strict";
import { validDate, dayCount, validStop, dateLabel } from "../src/model.ts";
test("기준일을 D+1로 계산하고 월/연도 경계를 처리한다", () => {
  assert.equal(dayCount("2026-11-02", "2026-11-02"), "D+1");
  assert.equal(dayCount("2026-12-31", "2027-01-01"), "D+2");
  assert.equal(dayCount("2024-02-28", "2024-03-01"), "D+3");
  assert.equal(dayCount("2026-11-03", "2026-11-02"), "D-1");
});
test("윤년과 존재하지 않는 날짜를 구분한다", () => {
  assert.equal(validDate("2024-02-29"), true);
  for (const date of [
    "2026-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
    "2026-2-02",
    "2026-11-00",
    "abc",
  ])
    assert.equal(validDate(date), false, date);
});
test("잘못된 장소·시간을 저장하지 않는다", () => {
  const stop = { id: "1", name: "카페", time: "23:59", note: "", mode: "walk" };
  assert.equal(validStop(stop), true);
  assert.equal(validStop({ ...stop, time: "24:00" }), false);
  assert.equal(validStop({ ...stop, time: "12:60" }), false);
  assert.equal(validStop({ ...stop, name: "   " }), false);
});
test("현지 날짜를 요일로 표시한다", () =>
  assert.equal(dateLabel("2026-11-02"), "11월 2일 · 월요일"));
