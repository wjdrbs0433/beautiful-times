import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { today, validDate } from "../model";
export function CalendarField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"days" | "years" | "months">("days");
  const initial = (validDate(value) ? value : today()).split("-").map(Number);
  const [month, setMonth] = useState({
    year: initial[0],
    month: initial[1] - 1,
  });
  const first = new Date(month.year, month.month, 1).getDay();
  const count = new Date(month.year, month.month + 1, 0).getDate();
  const key = (day: number) =>
    `${month.year}-${String(month.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  function shift(delta: number) {
    const d = new Date(month.year, month.month + delta, 1);
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
  }
  function selectPeriod(year: number, monthIndex: number) {
    const selectedDay = Number((validDate(value) ? value : today()).split("-")[2]);
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const day = Math.min(selectedDay, lastDay);
    setMonth({ year, month: monthIndex });
    // Commit explicit year/month selections to the form before its Save button.
    // Arrow navigation remains browsing only.
    onChange(`${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  function choose(date: string) {
    onChange(date);
    setOpen(false);
    setStage("days");
  }
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} 달력 열기`}
        onPress={() => {
          if (!open) {
            const [y, m] = (validDate(value) ? value : today())
              .split("-")
              .map(Number);
            setMonth({ year: y, month: m - 1 });
          }
          setOpen(!open);
          setStage("days");
        }}
        style={s.trigger}
      >
        <Text style={s.value}>
          {value ? value.replaceAll("-", ". ") : "날짜를 선택해 주세요"}
        </Text>
        <Ionicons name="calendar-outline" size={21} color="#687862" />
      </Pressable>
      {open && (
        <View style={s.calendar}>
          <View style={s.header}>
            <Pressable
              accessibilityRole="button"
              disabled={stage !== "days"}
              accessibilityLabel="이전 달"
              onPress={() => shift(-1)}
              style={[s.arrow, stage !== "days" && { opacity: 0 }]}
            >
              <Ionicons name="chevron-back" size={22} />
            </Pressable>
            <View style={s.selectors}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="연도 선택"
                onPress={() => setStage(stage === "years" ? "days" : "years")}
                style={s.selector}
              >
                <Text style={s.month}>{month.year}년 ▾</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="월 선택"
                onPress={() => setStage(stage === "months" ? "days" : "months")}
                style={s.selector}
              >
                <Text style={s.month}>{month.month + 1}월 ▾</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={stage !== "days"}
              accessibilityLabel="다음 달"
              onPress={() => shift(1)}
              style={[s.arrow, stage !== "days" && { opacity: 0 }]}
            >
              <Ionicons name="chevron-forward" size={22} />
            </Pressable>
          </View>
          {stage === "years" ? (
            <ScrollView style={{ height: 250 }}>
              <View style={s.yearGrid}>
                {Array.from(
                  { length: 100 },
                  (_, i) => new Date().getFullYear() + 10 - i,
                ).map((year) => (
                  <Pressable
                    key={year}
                    accessibilityRole="button"
                    accessibilityLabel={`${year}년 선택`}
                    accessibilityState={{ selected: month.year === year }}
                    onPress={() => {
                      selectPeriod(year, month.month);
                      setStage("months");
                    }}
                    style={[s.year, month.year === year && s.selected]}
                  >
                    <Text
                      style={[s.dayText, month.year === year && s.selectedText]}
                    >
                      {year}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          ) : stage === "months" ? (
            <>
              <Text style={s.hint}>{month.year}년의 월을 선택해 주세요</Text>
              <View style={s.yearGrid}>
                {Array.from({ length: 12 }, (_, index) => (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={`${index + 1}월 선택`}
                    accessibilityState={{ selected: month.month === index }}
                    onPress={() => {
                      selectPeriod(month.year, index);
                      setStage("days");
                    }}
                    style={[s.monthOption, month.month === index && s.selected]}
                  >
                    <Text style={[s.dayText, month.month === index && s.selectedText]}>{index + 1}월</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <>
              <View style={s.grid}>
                {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
                  <View key={day} style={s.cell}>
                    <Text style={[s.week, i === 0 && { color: "#AE6B65" }]}>
                      {day}
                    </Text>
                  </View>
                ))}
                {Array.from(
                  { length: Math.ceil((first + count) / 7) * 7 },
                  (_, i) => {
                    const day = i - first + 1;
                    if (day < 1 || day > count)
                      return <View key={i} style={s.cell} />;
                    const date = key(day);
                    const selected = date === value;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${date} 선택`}
                        accessibilityState={{ selected }}
                        key={i}
                        style={s.cell}
                        onPress={() => choose(date)}
                      >
                        <View
                          style={[
                            s.day,
                            selected && s.selected,
                            date === today() && !selected && s.current,
                          ]}
                        >
                          <Text style={[s.dayText, selected && s.selectedText]}>
                            {day}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  },
                )}
              </View>
              <Pressable onPress={() => choose(today())} style={s.today}>
                <Text style={s.todayText}>오늘 날짜 선택</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  field: { marginBottom: 17 },
  label: { fontSize: 12, fontWeight: "600", color: "#333833", marginBottom: 9 },
  trigger: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: "#DFE4D9",
    borderRadius: 5,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  value: { fontSize: 14, color: "#333833" },
  calendar: {
    borderWidth: 1,
    borderColor: "#DFE4D9",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 7,
    marginTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },
  selectors: { flexDirection: "row", alignItems: "center", gap: 4 },
  selector: { minHeight: 44, justifyContent: "center", paddingHorizontal: 5 },
  hint: { fontSize: 12, color: "#777D77", marginBottom: 12, textAlign: "center" },
  monthOption: { width: "33.3333%", minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 5 },
  month: { fontSize: 16, fontWeight: "700", color: "#333833" },
  arrow: { padding: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: "14.2857%",
    height: 43,
    alignItems: "center",
    justifyContent: "center",
  },
  week: { fontSize: 12, color: "#777D77" },
  day: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontSize: 14, color: "#333833" },
  selected: { backgroundColor: "#333833" },
  selectedText: { color: "#fff", fontWeight: "700" },
  current: { borderWidth: 1, borderColor: "#687862" },
  today: {
    borderTopWidth: 1,
    borderTopColor: "#EEF1EA",
    alignItems: "center",
    paddingTop: 14,
    marginTop: 9,
    paddingBottom: 4,
  },
  todayText: { fontSize: 12, color: "#687862" },
  yearGrid: { flexDirection: "row", flexWrap: "wrap" },
  year: {
    width: "25%",
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 4,
  },
});
