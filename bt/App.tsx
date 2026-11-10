import { AuthGate } from "./src/auth/AuthGate";
import type { User } from "@supabase/supabase-js";
import AccountProfile from "./src/components/AccountProfile";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Path } from "react-native-svg";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library/legacy";
import {
  dateLabel,
  dayCount,
  Entry,
  id,
  initialState,
  MemoryState,
  Mode,
  modes,
  Photo,
  Plan,
  Space,
  today,
  validDate,
  validStop,
} from "./src/model";
import { loadState, saveState } from "./src/storage";
import { useCloudSync } from "./src/cloud/useCloudSync";
import PlaceResultButton from "./src/components/PlaceResultButton";
import FieldInput from "./src/components/FieldInput";
import { CalendarField } from "./src/components/CalendarField";
import KakaoMap from "./src/components/KakaoMap";
import { usePlaceSearch } from "./src/usePlaceSearch";
import { checkCloudConnection, type CloudConnection } from "./src/cloudConnection";
import { useMapKey } from "./src/useMapKey";
import { useInputKeyboard, dismissInputKeyboard } from "./src/useInputKeyboard";
import { ROUTE_BASE, durationLabel, distanceLabel, useTravelTimes } from "./src/routes";

type Tab = "home" | "plans" | "album" | "journal";
type Sheet = "settings" | "anniversary" | "plan" | "entry" | "photo" | null;
type IconName = React.ComponentProps<typeof Ionicons>["name"];
const C = {
  ink: "#333833",
  secondary: "#777D77",
  muted: "#A5AAA3",
  line: "#E4E7E0",
  paper: "#FAFBF8",
  white: "#FFFFFF",
  soft: "#EEF1EA",
  accent: "#687862",
};
const blankPlan = (space: Space): Plan => ({
  id: id(),
  space,
  title: "",
  date: today(),
  stops: [],
});
const blankEntry = (space: Space): Entry => ({
  id: id(),
  space,
  title: "",
  body: "",
  date: today(),
  audience: "all",
  kind: "day",
});
function tell(title: string, body: string) {
  if (Platform.OS === "web") window.alert(`${title}\n${body}`);
  else Alert.alert(title, body);
}
function remove(action: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm("이 기록을 삭제할까요? 삭제 후 복구할 수 없어요."))
      action();
  } else
    Alert.alert("이 기록을 삭제할까요?", "삭제 후 복구할 수 없어요.", [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: action },
    ]);
}
function Icon({
  name,
  size = 21,
  color = C.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
function Button({
  title,
  onPress,
  outline,
  disabled,
}: {
  title: string;
  onPress: () => void;
  outline?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        outline && s.outline,
        (pressed || disabled) && { opacity: 0.5 },
      ]}
    >
      <Text style={[s.buttonText, outline && { color: C.ink }]}>{title}</Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  onFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  onFocus?: () => void;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <FieldInput label={label} value={value} onChange={onChange}
        placeholder={placeholder} multiline={multiline} onFocus={onFocus} />
    </View>
  );
}
function Empty({
  icon,
  title,
  body,
  action,
  onPress,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Icon name={icon} size={27} color={C.accent} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyBody}>{body}</Text>
      {action && onPress && <Button title={action} onPress={onPress} outline />}
    </View>
  );
}
function Heading({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={s.heading}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action && (
        <Pressable onPress={onPress} hitSlop={12}>
          <Text style={s.link}>{action} ↗</Text>
        </Pressable>
      )}
    </View>
  );
}
function Landscape() {
  return (
    <Svg width="100%" height="150" viewBox="0 0 340 150">
      <Circle cx="270" cy="32" r="20" fill="#DDE4D6" />
      <Path
        d="M-20 117 Q50 46 120 100 T280 77 T370 98"
        fill="none"
        stroke="#B4BFAC"
        strokeWidth="1.2"
      />
      <Path
        d="M-10 143 Q60 81 150 119 T350 114"
        fill="none"
        stroke="#C7CEBF"
        strokeWidth="1"
      />
      <Path
        d="M70 139 C185 120 94 75 202 87 S260 31 293 53"
        fill="none"
        stroke="#88977F"
        strokeWidth="1.5"
        strokeDasharray="4 5"
      />
      <Circle cx="70" cy="139" r="4" fill={C.accent} />
      <Circle cx="293" cy="53" r="4" fill={C.accent} />
    </Svg>
  );
}
function CoverPreview({ uri }: { uri?: string }) {
  const [failed, setFailed] = useState("");
  return <View style={s.coverPreview}>
    {uri && failed !== uri
      ? <Image source={{ uri }} style={s.coverFill} resizeMode="cover" accessibilityLabel="선택한 디데이 배경 사진" onError={() => setFailed(uri)} />
      : <Landscape />}
  </View>;
}
async function discardCoverFiles(files: string[]) {
  if (Platform.OS === "web") return;
  await Promise.all(files.map(uri => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})));
}
function Chip({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && { color: C.white }]}>{title}</Text>
    </Pressable>
  );
}

function BTApp({ user, logout, testIdle }: { user: User; logout: () => Promise<void>; testIdle: () => Promise<void> }) {
  const userId = user.id;
  const [data, setData] = useState<MemoryState>(initialState);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const contentRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [space, setSpace] = useState<Space>("couple");
  const [tab, setTab] = useState<Tab>("home");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [tour, setTour] = useState(0);
  const [busy, setBusy] = useState(false);
  const cloud = useCloudSync(userId, setData, ready && !failed && sheet === null && !busy);
  const [cloudChecking, setCloudChecking] = useState(false);
  const [cloudResult, setCloudResult] = useState<CloudConnection | null>(null);
  const [cloudError, setCloudError] = useState("");
  async function testCloudConnection() {
    if (cloudChecking) return;
    setCloudChecking(true);
    setCloudResult(null);
    setCloudError("");
    try { setCloudResult(await checkCloudConnection()); }
    catch (error) { setCloudError(error instanceof Error ? error.message : "서버 연결을 확인하지 못했어요."); }
    finally { setCloudChecking(false); }
  }
  const [plan, setPlan] = useState<Plan>(blankPlan("couple"));
  const [entry, setEntry] = useState<Entry>(blankEntry("couple"));
  const [anniversary, setAnniversary] = useState("");
  const [draftCover, setDraftCover] = useState<string | undefined>();
  const [failedCover, setFailedCover] = useState("");
  const draftCoverFiles = useRef(new Set<string>());
  const coverDraftSession = useRef({ generation: 0 });
  const coverUri = data.covers?.[space];
  const photoBackground = !!coverUri && failedCover !== coverUri;
  useEffect(() => {
    if (sheet !== "anniversary") {
      coverDraftSession.current.generation++;
      const files = [...draftCoverFiles.current];
      draftCoverFiles.current.clear();
      void discardCoverFiles(files);
    }
  }, [sheet]);
  useEffect(() => {
    const files = draftCoverFiles.current;
    const session = coverDraftSession.current;
    return () => { session.generation++;void discardCoverFiles([...files]); };
  }, []);
  function openAnniversary() {
    coverDraftSession.current.generation++;
    setAnniversary(data.anniversaries[space] ?? today());
    setDraftCover(data.covers?.[space]);
    setSheet("anniversary");
  }
  async function saveAnniversary() {
    if (busy) return;
    if (!validDate(anniversary)) return tell("날짜 확인", "실제 날짜를 선택해 주세요.");
    setBusy(true);
    try {
      const covers = { ...data.covers };
      if (draftCover) covers[space] = draftCover;
      else delete covers[space];
      const next = { ...data, covers, anniversaries: { ...data.anniversaries, [space]: anniversary } };
      await saveState(next, userId);
      if (draftCover) draftCoverFiles.current.delete(draftCover);
      setData(next);
      setSheet(null);
      if (coverUri && coverUri !== draftCover) await discardCoverFiles([coverUri]);
    } catch { tell("시작일 저장 실패", "저장 공간을 확인하고 다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  async function resetSavedCover() {
    if (busy) return;
    setBusy(true);
    try {
      const covers = { ...data.covers };
      delete covers[space];
      const next = { ...data, covers };
      await saveState(next, userId);
      setData(next);
      if (coverUri) await discardCoverFiles([coverUri]);
    } catch { tell("배경 변경 실패", "다시 시도해 주세요."); }
    finally { setBusy(false); }
  }
  const kakaoJsKey = useMapKey(data.kakaoJsKey, sheet === "plan" || sheet === "settings");
  const { search, inputRevisions, startSearch, receiveResults, choosePlace, clearSearch } = usePlaceSearch(dismissInputKeyboard);
  const { stopId: searchStopId, query: searchQuery, requestId: searchRequestId, results: searchResults, error: searchError, busy: searchBusy } = search;
  const [routeRefresh, setRouteRefresh] = useState(0);
  const travelTimes = useTravelTimes(plan.stops, sheet === "plan", routeRefresh);
  const { open: keyboardOpen, height: keyboardViewportHeight } = useInputKeyboard();
  const [expandedWhileTyping, setExpandedWhileTyping] = useState(false);
  const [focusedStopId, setFocusedStopId] = useState("");
  const sheetScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const stopPositions = useRef<Record<string, number>>({});
  useEffect(() => {
    if (keyboardOpen && sheet === "plan" && focusedStopId) {
      requestAnimationFrame(() => sheetScrollRef.current?.scrollTo({ y: Math.max(0, (stopPositions.current[focusedStopId] ?? 0) + 32), animated: true }));
    }
  }, [keyboardOpen, focusedStopId, sheet]);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [quality, setQuality] = useState<"original" | "high">("high");
  useEffect(() => {
    loadState(userId)
      .then(setData)
      .catch(() => {
        setFailed(true);
        tell(
          "기록을 불러오지 못했어요",
          "기존 기록 보호를 위해 저장을 중단했어요. 앱을 다시 실행해 주세요.",
        );
      })
      .finally(() => setReady(true));
  }, [userId]);
  useEffect(() => {
    if (ready && !failed)
      saveState(data, userId).catch(() =>
        tell(
          "기록을 저장하지 못했어요",
          "저장 공간을 확인해 주세요. 변경 내용이 아직 보관되지 않았어요.",
        ),
      );
  }, [data, ready, failed, userId]);
  useEffect(() => {
    contentRef.current?.scrollTo({ y: 0, animated: false });
  }, [tab, space]);
  const plans = data.plans
    .filter((p) => p.space === space)
    .sort((a, b) => a.date.localeCompare(b.date));
  const photos = data.photos
    .filter((p) => p.space === space)
    .slice()
    .reverse();
  const entries = data.entries
    .filter((e) => e.space === space)
    .slice()
    .reverse();
  const next = plans.find((p) => p.date >= today()) ?? plans.at(-1);
  const newPlan = () => {
    clearSearch();
    setPlan(blankPlan(space));
    setSheet("plan");
  };
  const newEntry = () => {
    setEntry(blankEntry(space));
    setSheet("entry");
  };
  function savePlan() {
    if (
      !plan.title.trim() ||
      !validDate(plan.date) ||
      plan.stops.some((stop) => !validStop(stop))
    )
      return tell(
        "입력 내용을 확인해 주세요",
        "제목, 날짜(YYYY-MM-DD), 장소명과 시간(HH:MM)을 확인해 주세요.",
      );
    setData((d) => ({
      ...d,
      plans: [
        ...d.plans.filter((p) => p.id !== plan.id),
        { ...plan, title: plan.title.trim() },
      ],
    }));
    setSheet(null);
  }
  function moveStop(index: number, delta: number) {
    setPlan((p) => {
      const stops = [...p.stops];
      const to = index + delta;
      if (to < 0 || to >= stops.length) return p;
      [stops[index], stops[to]] = [stops[to], stops[index]];
      return { ...p, stops };
    });
  }
  async function openMap(name: string) {
    if (!name.trim())
      return tell("장소 이름 입력", "찾을 장소 이름을 먼저 입력해 주세요.");
    try {
      await Linking.openURL(
        `https://map.kakao.com/link/search/${encodeURIComponent(name)}`,
      );
    } catch {
      tell("카카오맵을 열지 못했어요", "인터넷 연결을 확인해 주세요.");
    }
  }
  async function pickCover(target: "saved" | "draft" = "saved") {
    if (busy) return;
    const draftSession = coverDraftSession.current.generation;
    let createdCover: string | undefined;
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const output = await ImageManipulator.manipulateAsync(
        asset.uri,
        asset.width > 1800 ? [{ resize: { width: 1800 } }] : [],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: Platform.OS === "web" },
      );
      let uri = Platform.OS === "web" && output.base64 ? `data:image/jpeg;base64,${output.base64}` : output.uri;
      if (Platform.OS !== "web") {
        const dir = `${FileSystem.documentDirectory}photos/`;
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        const dest = `${dir}cover-${id()}.jpg`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        uri = dest;
        createdCover = dest;
      }
      if (target === "draft") {
        if (draftSession !== coverDraftSession.current.generation) { await discardCoverFiles([uri]);return; }
        if (Platform.OS !== "web") draftCoverFiles.current.add(uri);
        setDraftCover(uri);
        return;
      }
      const previous = data.covers?.[space];
      const nextState = { ...data, covers: { ...data.covers, [space]: uri } };
      await saveState(nextState, userId);
      setData(nextState);
      if (previous && Platform.OS !== "web")
        await FileSystem.deleteAsync(previous, { idempotent: true }).catch(
          () => {},
        );
    } catch {
      if (createdCover) await discardCoverFiles([createdCover]);
      tell(
        "배경 사진 저장 실패",
        "사진 접근 권한과 기기 저장 공간을 확인해 주세요.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function pickPhotos() {
    if (busy) return;
    setBusy(true);
    const files: string[] = [];
    let committed = false;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 1,
      });
      if (result.canceled) return;
      const added: Photo[] = [];
      for (const asset of result.assets) {
        const key = id();
        let uri = asset.uri;
        let bytes = asset.fileSize ?? 0;
        if (quality === "high") {
          const output = await ImageManipulator.manipulateAsync(
            uri,
            asset.width > 2400 ? [{ resize: { width: 2400 } }] : [],
            { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: Platform.OS === "web" },
          );
          uri = Platform.OS === "web" && output.base64 ? `data:image/jpeg;base64,${output.base64}` : output.uri;
        }
        if (Platform.OS !== "web") {
          const dir = `${FileSystem.documentDirectory}photos/`;
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
          const ext =
            quality === "high"
              ? "jpg"
              : asset.fileName
                  ?.split(".")
                  .pop()
                  ?.replace(/[^a-z0-9]/gi, "") || "jpg";
          const dest = `${dir}${key}.${ext}`;
          await FileSystem.copyAsync({ from: uri, to: dest });
          uri = dest;
          files.push(uri);
          const info = await FileSystem.getInfoAsync(uri);
          if (info.exists) bytes = info.size;
        }
        added.push({
          id: key,
          space,
          uri,
          caption: "",
          date: today(),
          quality,
          bytes,
        });
      }
      setData((d) => ({ ...d, photos: [...d.photos, ...added] }));
      committed = true;
    } catch {
      tell(
        "사진을 추가하지 못했어요",
        "사진 접근 권한과 저장 공간을 확인해 주세요.",
      );
    } finally {
      if (!committed && Platform.OS !== "web")
        await Promise.all(
          files.map((uri) =>
            FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}),
          ),
        );
      setBusy(false);
    }
  }
  async function savePhotoToLibrary() {
    if (!photo) return;
    if (Platform.OS === "web") return sharePhoto();
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true, [
        "photo",
      ]);
      if (!permission.granted)
        return tell(
          "사진 저장 권한",
          "사진첩 저장을 허용한 뒤 다시 시도해 주세요.",
        );
      await MediaLibrary.saveToLibraryAsync(photo.uri);
      tell("사진 저장 완료", "기기 사진첩에 저장했어요.");
    } catch {
      tell(
        "사진 저장 실패",
        "기기 권한과 저장 공간을 확인해 주세요. 공유 메뉴를 통한 파일 저장도 사용할 수 있어요.",
      );
    }
  }
  async function sharePhoto() {
    if (!photo) return;
    try {
      if (Platform.OS === "web")
        return tell(
          "사진 저장",
          "사진을 길게 누르거나 마우스 오른쪽 버튼으로 저장해 주세요.",
        );
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(photo.uri);
      else
        tell("공유 기능 없음", "이 기기에서는 공유 기능을 사용할 수 없어요.");
    } catch {
      tell("공유 실패", "다시 시도해 주세요.");
    }
  }
  async function exportData() {
    try {
      const records = { ...data };
      delete records.kakaoJsKey;
      if (Platform.OS === "web") {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(
          new Blob([JSON.stringify(records, null, 2)], {
            type: "application/json",
          }),
        );
        a.download = `BT-${today()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        return;
      }
      const uri = `${FileSystem.cacheDirectory}BT-${today()}.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(records, null, 2));
      await Sharing.shareAsync(uri, { mimeType: "application/json" });
    } catch {
      tell("내보내기 실패", "다시 시도해 주세요.");
    }
  }
  if (!ready)
    return (
      <View style={s.loading}>
        <Text style={s.brand}>BT</Text>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  if (failed)
    return (
      <SafeAreaView style={s.root}>
        <Empty
          icon="alert-circle-outline"
          title="저장 기록을 확인해 주세요"
          body="기록 보호를 위해 저장을 중단했어요. 앱을 다시 실행해 주세요."
        />
      </SafeAreaView>
    );
  if (!data.onboarded) {
    const slides = [
      {
        tag: "BEAUTIFUL TIMES",
        title: "함께한 시간은,\n오래도록 아름답게.",
        body: "데이트와 가족 여행, 사진과 전하지 못한 마음까지.\n우리의 시간을 한곳에 담아요.",
        icon: "heart-outline" as IconName,
      },
      {
        tag: "MAKE A DAY TOGETHER",
        title: "가고 싶은 곳을,\n하나의 하루로.",
        body: "방문할 장소와 시간을 차례로 정리해요.\n커플과 가족의 기록은 각각 보관돼요.",
        icon: "navigate-outline" as IconName,
      },
      {
        tag: "YOUR FIRST CHAPTER",
        title: "우리의 첫 기록을\n시작해 볼까요?",
        body: "지금은 이 기기에만 기록을 저장하는 첫 버전이에요.\n로그인을 마쳤어요. 공동 공유는 연결 준비 중이에요.",
        icon: "book-outline" as IconName,
      },
    ];
    const slide = slides[tour];
    return (
      <SafeAreaView style={s.root}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={s.tour}>
          <View style={s.header}>
            <Text style={s.brand}>BT</Text>
            <Pressable onPress={() => setTour(2)}>
              <Text style={s.link}>건너뛰기</Text>
            </Pressable>
          </View>
          <View style={s.tourArt}>
            <Landscape />
            <View style={s.tourSymbol}>
              <Icon name={slide.icon} size={48} color={C.accent} />
            </View>
          </View>
          <Text style={s.eyebrow}>{slide.tag}</Text>
          <Text style={s.tourTitle}>{slide.title}</Text>
          <Text style={s.tourBody}>{slide.body}</Text>
          <View style={s.dots}>
            {slides.map((_, i) => (
              <View key={i} style={[s.dot, tour === i && s.activeDot]} />
            ))}
          </View>
          <Button
            title={tour === 2 ? "BT 시작하기" : "다음"}
            onPress={() =>
              tour === 2
                ? setData((d) => ({ ...d, onboarded: true }))
                : setTour(tour + 1)
            }
          />
        </ScrollView>
      </SafeAreaView>
    );
  }
  function planCard(p: Plan) {
    return (
      <Pressable
        key={p.id}
        style={s.card}
        onPress={() => {
          clearSearch();
          setPlan(p);
          setSheet("plan");
        }}
      >
        <View style={s.row}>
          <View style={s.dateBadge}>
            <Text style={s.dateMonth}>{p.date.slice(5, 7)}월</Text>
            <Text style={s.dateDay}>{p.date.slice(8)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle}>{p.title}</Text>
            <Text style={s.caption}>
              {dateLabel(p.date)} · {p.stops.length}개 장소
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} />
        </View>
        {!!p.stops.length && (
          <View style={s.route}>
            <Text style={s.routeText}>
              {p.stops.map((stop) => stop.name).join("   →   ")}
            </Text>
          </View>
        )}
      </Pressable>
    );
  }
  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <View style={s.brandRow}>
          <Text style={s.brand}>BT</Text>
          <View style={s.divider} />
          <Text style={s.brandFull}>Beautiful Times</Text>
        </View>
        <Pressable
          accessibilityLabel="설정"
          onPress={() => {
            setSheet("settings");
          }}
          hitSlop={14}
        >
          <Icon name="options-outline" />
        </Pressable>
      </View>
      <View style={s.spaces}>
        {(["couple", "family"] as Space[]).map((v) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: space === v }}
            key={v}
            onPress={() => setSpace(v)}
            style={[s.spaceTab, space === v && { backgroundColor: C.ink }]}
          >
            <Icon
              name={v === "couple" ? "heart-outline" : "people-outline"}
              size={16}
              color={space === v ? C.white : C.secondary}
            />
            <Text style={[s.spaceText, space === v && { color: C.white }]}>
              {v === "couple" ? "우리 둘" : "우리 가족"}
            </Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Text style={s.local}>{cloud.status.phase === "synced" ? "● 서버 보관" : cloud.status.phase === "syncing" ? "● 동기화 중" : "● 기기 보관 중"}</Text>
      </View>
      <ScrollView
        ref={contentRef}
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {tab === "home" && (
          <>
            <Text style={s.eyebrow}>OUR LITTLE MOMENTS</Text>
            <Text style={s.pageTitle}>
              {space === "couple"
                ? "너와 나의, 좋은 날들"
                : "함께여서, 더 좋은 날들"}
            </Text>
            <Text style={s.subtitle}>
              평범한 하루도 우리에겐 소중한 시간이니까.
            </Text>
            <Pressable
              style={s.hero}
              accessibilityRole="button"
              accessibilityLabel="시작일과 배경 사진 설정"
              onPress={openAnniversary}
            >
              {photoBackground && <>
                <Image source={{ uri: coverUri }} style={s.coverFill} resizeMode="cover" accessibilityLabel="디데이 배경 사진" onError={() => setFailedCover(coverUri!)} />
                <View pointerEvents="none" style={[s.coverFill, { backgroundColor: "rgba(0,0,0,0.42)" }]} />
              </>}
              <View style={s.heroTop}>
                <Text style={[s.heroTag, photoBackground && s.photoText]}>
                  {space === "couple"
                    ? "OUR TIME TOGETHER"
                    : "OUR FAMILY STORY"}
                </Text>
                <Icon name="add-outline" size={18} color={photoBackground ? C.white : C.accent} />
              </View>
              <Text style={[s.heroTitle, photoBackground && s.photoText]}>
                {space === "couple"
                  ? "함께 쌓아가는 시간"
                  : "우리라는 이름의 추억"}
              </Text>
              <Text style={[s.dday, photoBackground && s.photoText]}>
                {data.anniversaries[space]
                  ? dayCount(data.anniversaries[space])
                  : "우리의 첫 페이지"}
              </Text>
              <Text style={[s.heroSub, photoBackground && s.photoText]}>
                {data.anniversaries[space]
                  ? `${data.anniversaries[space].replaceAll("-", ".")}부터, 오늘까지`
                  : "눌러서 우리만의 디데이를 설정해요"}
              </Text>
              {photoBackground ? <View style={{ height: 150 }} /> : <Landscape />}
              <Text style={[s.heroFooter, photoBackground && s.photoText]}>
                A little moment, a beautiful memory.
              </Text>
            </Pressable>
            <Heading
              title="다음에 함께할 시간"
              action="일정 보기"
              onPress={() => setTab("plans")}
            />
            {next ? (
              planCard(next)
            ) : (
              <Empty
                icon="calendar-outline"
                title="어떤 하루를 함께할까요?"
                body="가고 싶은 곳을 하나씩 담아 보세요."
                action="첫 일정 만들기"
                onPress={newPlan}
              />
            )}
            <Heading
              title="오래 간직할 순간"
              action="앨범 보기"
              onPress={() => setTab("album")}
            />
            {photos.length ? (
              <View style={s.photoRow}>
                {photos.slice(0, 3).map((p) => (
                  <Pressable
                    key={p.id}
                    style={s.smallPhoto}
                    onPress={() => {
                      setPhoto(p);
                      setSheet("photo");
                    }}
                  >
                    <Image source={{ uri: p.uri }} style={s.fill} />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Pressable style={s.memoryPrompt} onPress={() => setTab("album")}>
                <Icon name="images-outline" color={C.accent} />
                <Text style={s.promptText}>첫 사진으로 앨범을 채워 주세요</Text>
                <Icon name="chevron-forward" size={16} />
              </Pressable>
            )}
            <Pressable style={s.letterPrompt} onPress={newEntry}>
              <Icon name="mail-outline" size={25} color={C.accent} />
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>마음을 남기는 작은 방법</Text>
                <Text style={s.caption}>오늘 전하지 못한 말이 있나요?</Text>
              </View>
              <Icon name="arrow-forward" size={18} />
            </Pressable>
          </>
        )}
        {tab === "plans" && (
          <>
            <Text style={s.eyebrow}>PLAN OUR DAYS</Text>
            <View style={s.row}>
              <Text style={s.pageTitle}>함께할 일정</Text>
              <Pressable
                accessibilityLabel="일정 추가"
                onPress={newPlan}
                style={s.add}
              >
                <Icon name="add" color={C.white} />
              </Pressable>
            </View>
            <Text style={s.subtitle}>
              장소와 시간을 잇고, 우리만의 하루를 만들어요.
            </Text>
            <Text style={s.notice}>
              카카오 연동 전에는 방문 순서를 정리하고 장소를 카카오맵에서 확인할
              수 있어요.
            </Text>
            {plans.length ? (
              plans.map(planCard)
            ) : (
              <Empty
                icon="trail-sign-outline"
                title="아직 비어 있는 여행 노트"
                body="데이트도 가족 여행도, 첫 장소부터 시작해요."
                action="일정 만들기"
                onPress={newPlan}
              />
            )}
          </>
        )}
        {tab === "album" && (
          <>
            <Text style={s.eyebrow}>MOMENTS WE KEEP</Text>
            <Text style={s.pageTitle}>우리의 앨범</Text>
            <Text style={s.subtitle}>다시 보고 싶은 순간들을 차곡차곡.</Text>
            <View style={s.chips}>
              <Chip
                title="고화질"
                active={quality === "high"}
                onPress={() => setQuality("high")}
              />
              <Chip
                title="원본"
                active={quality === "original"}
                onPress={() => setQuality("original")}
              />
              <Text style={s.caption}>추가할 사진의 화질</Text>
            </View>
            <Button
              title={busy ? "사진 보관 중…" : "+ 사진 추가하기"}
              onPress={pickPhotos}
              disabled={busy}
            />
            <Text style={s.footnote}>
              이 기기에 보관돼요. 고화질은 용량을 줄여 저장해요.
            </Text>
            {photos.length ? (
              <View style={s.albumGrid}>
                {photos.map((p) => (
                  <Pressable
                    key={p.id}
                    style={s.albumPhoto}
                    onPress={() => {
                      setPhoto(p);
                      setSheet("photo");
                    }}
                  >
                    <Image source={{ uri: p.uri }} style={s.albumImage} />
                    <Text style={s.photoCaption} numberOfLines={1}>
                      {p.caption || dateLabel(p.date)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Empty
                icon="camera-outline"
                title="처음 담을 순간은 무엇인가요?"
                body="사진을 추가하면 우리의 앨범이 생겨요."
              />
            )}
          </>
        )}
        {tab === "journal" && (
          <>
            <Text style={s.eyebrow}>WORDS FROM THE HEART</Text>
            <View style={s.row}>
              <Text style={s.pageTitle}>마음의 기록</Text>
              <Pressable
                accessibilityLabel="글 쓰기"
                onPress={newEntry}
                style={s.add}
              >
                <Icon name="create-outline" color={C.white} />
              </Pressable>
            </View>
            <Text style={s.subtitle}>사진으로 다 담지 못한 마음까지.</Text>
            {entries.length ? (
              entries.map((e) => (
                <Pressable
                  key={e.id}
                  style={s.entryCard}
                  onPress={() => {
                    setEntry(e);
                    setSheet("entry");
                  }}
                >
                  <View style={s.row}>
                    <Text style={s.entryTag}>
                      {e.kind === "letter" ? "TO YOU" : "DEAR DIARY"}
                    </Text>
                    <Text style={s.caption}>{e.date.replaceAll("-", ".")}</Text>
                  </View>
                  <Text style={s.entryTitle}>{e.title}</Text>
                  <Text style={s.entryBody} numberOfLines={3}>
                    {e.body}
                  </Text>
                  <Text style={s.footnote}>
                    {e.audience === "private"
                      ? "나만 보는 초안"
                      : space === "couple"
                        ? "우리 둘에게"
                        : "가족에게"}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Empty
                icon="mail-open-outline"
                title="천천히, 마음을 꺼내 보세요"
                body={
                  "고마운 마음도, 미안한 마음도.\n짧은 한 문장이면 충분해요."
                }
                action="첫 글 남기기"
                onPress={newEntry}
              />
            )}
          </>
        )}
        <View style={s.endMark}>
          <Text style={s.endBrand}>BT</Text>
          <Text style={s.endText}>우리의 아름다운 시간을 담다</Text>
        </View>
      </ScrollView>
      <SafeAreaView edges={["bottom"]} style={s.navSafe}>
        <View style={s.nav}>
          {(
            [
              { id: "home", label: "홈", icon: "home-outline" },
              { id: "plans", label: "일정", icon: "map-outline" },
              { id: "album", label: "앨범", icon: "images-outline" },
              { id: "journal", label: "기록", icon: "book-outline" },
            ] as { id: Tab; label: string; icon: IconName }[]
          ).map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === item.id }}
              onPress={() => setTab(item.id)}
              style={s.navItem}
            >
              <Icon
                name={item.icon}
                color={tab === item.id ? C.ink : C.muted}
              />
              <Text
                style={[
                  s.navLabel,
                  tab === item.id && { color: C.ink, fontWeight: "700" },
                ]}
              >
                {item.label}
              </Text>
              <View
                style={[
                  s.navDot,
                  tab === item.id && { backgroundColor: C.accent },
                ]}
              />
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
      <Modal
        visible={sheet !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { if (!busy) setSheet(null); }}
      >
        <SafeAreaView style={[s.root, keyboardViewportHeight ? { height: keyboardViewportHeight, flex: undefined } : undefined]}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={s.sheetHeader}>
              <Text style={s.sectionTitle}>
                {sheet === "plan"
                  ? "우리의 일정"
                  : sheet === "entry"
                    ? "마음을 남기다"
                    : sheet === "anniversary"
                      ? "우리의 시작일"
                      : sheet === "photo"
                        ? "순간의 기록"
                        : "BT 설정"}
              </Text>
              <Pressable
                accessibilityLabel="닫기"
                disabled={busy}
                onPress={() => { if (!busy) setSheet(null); }}
                hitSlop={15}
              >
                <Icon name="close" />
              </Pressable>
            </View>
            {sheet === "plan" && (
              <View
                style={{
                  paddingHorizontal: 25,
                  paddingTop: 10,
                  paddingBottom: 10,
                }}
              >
                {keyboardOpen && <View style={[s.row, { paddingBottom: 8 }]}><Pressable accessibilityRole="button" onPress={() => setExpandedWhileTyping(v => !v)}><Text style={s.link}>{expandedWhileTyping ? "지도 접기 ↑" : `지도 보기 ↓ · ${plan.stops.length}개 장소`}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => dismissInputKeyboard()}><Text style={s.link}>키보드 닫기</Text></Pressable></View>}
                <View style={keyboardOpen && !expandedWhileTyping ? { height: 0, overflow: "hidden" } : undefined}>
                <KakaoMap
                  apiKey={kakaoJsKey}
                  stops={plan.stops}
                  travelTimes={travelTimes}
                  query={searchQuery}
                  requestId={searchRequestId}
                  onResults={receiveResults}
                />
                </View>
                {!keyboardOpen && <Pressable accessibilityRole="button" onPress={() => setRouteRefresh(v => v + 1)} style={{paddingVertical:8}}><Text style={s.link}>이동시간 새로고침 ↻</Text></Pressable>}
                {!keyboardOpen && <Text style={s.footnote}>
                  번호 핀과 화살표로 방문 순서를 확인해요. 검색 결과에서 장소를 고르면
                  위치가 표시됩니다.
                </Text>}
              </View>
            )}
            <ScrollView
              ref={sheetScrollRef}
              key={sheet}
              contentContainerStyle={s.sheetContent}
              keyboardShouldPersistTaps="always"
            >
              {sheet === "anniversary" && (
                <>
                  <Text style={s.subtitle}>선택한 날짜를 D+1로 세어요.</Text>
                  <CalendarField
                    label="기준 날짜"
                    value={anniversary}
                    onChange={setAnniversary}
                  />
                  <Heading title="디데이 배경 사진" />
                  <CoverPreview uri={draftCover} />
                  <Button title={busy ? "사진 준비 중…" : draftCover ? "사진 변경" : "사진 선택"} outline disabled={busy} onPress={() => { void pickCover("draft"); }} />
                  {!!draftCover && <Button title="기본 배경으로 변경" outline disabled={busy} onPress={() => setDraftCover(undefined)} />}
                  <Text style={s.footnote}>사진과 날짜는 저장을 누르면 함께 적용돼요. 사진을 선택하지 않으면 기본 배경으로 표시됩니다.</Text>
                  <Button title={busy ? "저장 준비 중…" : "시작일 저장"} disabled={busy} onPress={() => { void saveAnniversary(); }} />
                </>
              )}
              {sheet === "plan" && (
                <>
                  <Field
                    label="일정 이름"
                    value={plan.title}
                    onChange={(title) => setPlan((p) => ({ ...p, title }))}
                    placeholder="우리 둘의 주말 데이트"
                  />
                  <CalendarField
                    label="날짜"
                    value={plan.date}
                    onChange={(date) => setPlan((p) => ({ ...p, date }))}
                  />
                  <Text style={s.label}>
                    방문 순서 · 화살표로 순서를 바꿔요
                  </Text>
                  {plan.stops.map((stop, index) => {
                    const edit = (patch: Partial<typeof stop>) =>
                      setPlan((p) => ({
                        ...p,
                        stops: p.stops.map((x) =>
                          x.id === stop.id ? { ...x, ...patch } : x,
                        ),
                      }));
                    return (
                      <View key={stop.id} style={s.stopCard} onLayout={event => { stopPositions.current[stop.id] = event.nativeEvent.layout.y; }}>
                        <View style={s.row}>
                          <View style={s.number}>
                            <Text style={{ color: C.white }}>{index + 1}</Text>
                          </View>
                          <Text style={[s.cardTitle, { flex: 1 }]}>
                            장소 {index + 1}
                          </Text>
                          <Pressable
                            accessibilityLabel="앞으로 이동"
                            onPress={() => moveStop(index, -1)}
                            style={s.mini}
                          >
                            <Icon name="arrow-up" size={18} />
                          </Pressable>
                          <Pressable
                            accessibilityLabel="뒤로 이동"
                            onPress={() => moveStop(index, 1)}
                            style={s.mini}
                          >
                            <Icon name="arrow-down" size={18} />
                          </Pressable>
                          <Pressable
                            accessibilityLabel="장소 제거"
                            onPress={() =>
                              setPlan((p) => ({
                                ...p,
                                stops: p.stops.filter((x) => x.id !== stop.id),
                              }))
                            }
                            style={s.mini}
                          >
                            <Icon name="close" size={18} />
                          </Pressable>
                        </View>
                        <Field
                          key={`${stop.id}:${inputRevisions[stop.id] ?? 0}`}
                          label="장소 이름"
                          value={stop.name}
                          onFocus={() => { setFocusedStopId(stop.id); setExpandedWhileTyping(false); }}
                          onChange={(name) => {
                            edit({
                              name,
                              placeId: undefined,
                              address: undefined,
                              roadAddress: undefined,
                              lat: undefined,
                              lng: undefined,
                              placeUrl: undefined,
                            });
                            startSearch(stop.id, name, !!kakaoJsKey);
                          }}
                          placeholder="2글자 이상"
                        />
                        {stop.placeId && (
                          <Text style={[s.footnote, { color: C.accent }]}>
                            ✓ {stop.roadAddress || stop.address}
                          </Text>
                        )}
                        {searchStopId === stop.id &&
                          stop.name.trim().length >= 2 && (
                            <View
                              style={{
                                borderWidth: 1,
                                borderColor: C.line,
                                borderRadius: 5,
                                padding: 10,
                                marginBottom: 12,
                              }}
                            >
                              {!kakaoJsKey ? (
                                <Text style={s.footnote}>
                                  지도 연결을 준비 중이에요. 개발용 서비스 연결을 확인해 주세요.
                                </Text>
                              ) : (
                                <>
                                  {searchBusy && (
                                    <View style={s.row}>
                                      <ActivityIndicator
                                        size="small"
                                        color={C.accent}
                                      />
                                      <Text style={s.footnote}>
                                        장소를 검색하고 있어요…
                                      </Text>
                                    </View>
                                  )}
                                  {!!searchError && (
                                    <Text style={s.footnote}>
                                      {searchError}
                                    </Text>
                                  )}
                                  {searchResults.map((place) => (
                                    <PlaceResultButton
                                      key={place.id}
                                      label={`${place.name} 장소 선택`}
                                      onPress={() => choosePlace(stop.id, () => {
                                        edit({
                                          name: place.name,
                                          placeId: place.id,
                                          address: place.address,
                                          roadAddress: place.roadAddress,
                                          lat: place.lat,
                                          lng: place.lng,
                                          placeUrl: place.url,
                                        });
                                      })}
                                    >
                                      <Text style={s.cardTitle}>
                                        {place.name}
                                      </Text>
                                      <Text style={[s.caption, { fontSize: 12, lineHeight: 20 }]}>
                                        {place.roadAddress || place.address}
                                      </Text>
                                    </PlaceResultButton>
                                  ))}
                                </>
                              )}
                            </View>
                          )}
                        <Field
                          label="방문 시간"
                          value={stop.time}
                          onChange={(time) => edit({ time })}
                          placeholder="11:00"
                        />
                        <Text style={s.label}>{index < plan.stops.length - 1 ? "다음 장소까지 이동수단" : "마지막 장소"}</Text>
                        <View style={s.modeRow}>
                          {(Object.keys(modes) as Mode[]).map((mode) => (
                            <Pressable
                              key={mode}
                              onPress={() => edit({ mode })}
                              style={[
                                s.mode,
                                stop.mode === mode && {
                                  backgroundColor: C.soft,
                                },
                              ]}
                            >
                              <Icon
                                name={modes[mode].icon}
                                size={19}
                                color={stop.mode === mode ? C.accent : C.muted}
                              />
                              <Text style={s.modeLabel}>
                                {modes[mode].label}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                        {index < plan.stops.length - 1 && <View style={{backgroundColor:C.soft,padding:13,borderRadius:5,marginBottom:15}}>
                          <Text style={[s.cardTitle,{fontSize:13}]}>{index+1} → {index+2} · {modes[stop.mode].label}</Text>
                          {travelTimes[stop.id]?.status === 'ready' ? <Text style={[s.cardTitle,{marginTop:5}]}>약 {durationLabel(travelTimes[stop.id].seconds!)} · {distanceLabel(travelTimes[stop.id].meters!)}</Text> : travelTimes[stop.id]?.status === 'loading' ? <Text style={s.caption}>예상 이동시간을 조회하고 있어요…</Text> : <Text style={[s.caption,{fontSize:12}]}>{travelTimes[stop.id]?.error || '두 장소를 검색 결과에서 선택하면 이동시간을 계산해요.'}</Text>}
                          <Text style={s.caption}>조회 시점의 예상 시간이며 실제 이동 상황에 따라 달라져요.</Text>
                        </View>}
                        <Field
                          label="메모"
                          value={stop.note}
                          onChange={(note) => edit({ note })}
                          placeholder="예약시간 등등"
                        />
                        <Button
                          title="카카오맵에서 장소 확인 ↗"
                          outline
                          onPress={() => openMap(stop.name)}
                        />
                      </View>
                    );
                  })}
                  <Button
                    title="+ 장소 추가"
                    outline
                    onPress={() =>
                      setPlan((p) => ({
                        ...p,
                        stops: [
                          ...p.stops,
                          {
                            id: id(),
                            name: "",
                            time: "12:00",
                            note: "",
                            mode: "walk",
                          },
                        ],
                      }))
                    }
                  />
                  <Text style={s.notice}>
                    지도 선은 방문 순서이며 실제 도로 경로와 달라요.
                    구간별 예상 이동시간은 이동수단을 선택해 확인하세요.
                  </Text>
                  <Button title="일정 저장" onPress={savePlan} />
                  {data.plans.some((p) => p.id === plan.id) && (
                    <Pressable
                      style={s.delete}
                      onPress={() =>
                        remove(() => {
                          setData((d) => ({
                            ...d,
                            plans: d.plans.filter((p) => p.id !== plan.id),
                          }));
                          setSheet(null);
                        })
                      }
                    >
                      <Text style={s.deleteText}>이 일정 삭제</Text>
                    </Pressable>
                  )}
                </>
              )}
              {sheet === "entry" && (
                <>
                  <View style={s.chips}>
                    <Chip
                      title="오늘의 기록"
                      active={entry.kind === "day"}
                      onPress={() => setEntry((e) => ({ ...e, kind: "day" }))}
                    />
                    <Chip
                      title="편지"
                      active={entry.kind === "letter"}
                      onPress={() =>
                        setEntry((e) => ({ ...e, kind: "letter" }))
                      }
                    />
                  </View>
                  <Field
                    label="제목"
                    value={entry.title}
                    onChange={(title) => setEntry((e) => ({ ...e, title }))}
                    placeholder="너에게 하고 싶은 말"
                  />
                  <Field
                    label="날짜"
                    value={entry.date}
                    onChange={(date) => setEntry((e) => ({ ...e, date }))}
                    placeholder="YYYY-MM-DD"
                  />
                  <Field
                    label="마음"
                    value={entry.body}
                    onChange={(body) => setEntry((e) => ({ ...e, body }))}
                    multiline
                    placeholder="마음 가는 대로, 천천히 적어 주세요."
                  />
                  <Text style={s.label}>공개 범위 설정</Text>
                  <View style={s.chips}>
                    <Chip
                      title={space === "couple" ? "우리 둘" : "가족 전체"}
                      active={entry.audience === "all"}
                      onPress={() =>
                        setEntry((e) => ({ ...e, audience: "all" }))
                      }
                    />
                    <Chip
                      title="나만 보는 초안"
                      active={entry.audience === "private"}
                      onPress={() =>
                        setEntry((e) => ({ ...e, audience: "private" }))
                      }
                    />
                  </View>
                  <Text style={s.footnote}>
                    지금은 이 기기에만 저장돼요. 다른 사람에게 전송되지 않으며,
                    특정 가족 선택 공개는 계정 연결 후 제공돼요.
                  </Text>
                  <Button
                    title="기록 저장"
                    onPress={() => {
                      if (
                        !entry.title.trim() ||
                        !entry.body.trim() ||
                        !validDate(entry.date)
                      )
                        return tell(
                          "입력 내용 확인",
                          "제목·내용·날짜를 확인해 주세요.",
                        );
                      setData((d) => ({
                        ...d,
                        entries: [
                          ...d.entries.filter((e) => e.id !== entry.id),
                          {
                            ...entry,
                            title: entry.title.trim(),
                            body: entry.body.trim(),
                          },
                        ],
                      }));
                      setSheet(null);
                    }}
                  />
                  {data.entries.some((e) => e.id === entry.id) && (
                    <Pressable
                      style={s.delete}
                      onPress={() =>
                        remove(() => {
                          setData((d) => ({
                            ...d,
                            entries: d.entries.filter((e) => e.id !== entry.id),
                          }));
                          setSheet(null);
                        })
                      }
                    >
                      <Text style={s.deleteText}>이 글 삭제</Text>
                    </Pressable>
                  )}
                </>
              )}
              {sheet === "photo" && photo && (
                <>
                  <Image
                    source={{ uri: photo.uri }}
                    style={s.photoDetail}
                    resizeMode="contain"
                  />
                  <Text style={s.footnote}>
                    {photo.quality === "original" ? "원본" : "고화질"} ·{" "}
                    {(photo.bytes / 1024 / 1024).toFixed(1)} MB · {photo.date}
                  </Text>
                  <Field
                    label="이 사진에 남기는 말"
                    value={photo.caption}
                    onChange={(caption) =>
                      setPhoto((p) => p && { ...p, caption })
                    }
                    placeholder="이 순간을 기억할 한마디"
                  />
                  <Button
                    title="사진 글 저장"
                    onPress={() => {
                      setData((d) => ({
                        ...d,
                        photos: d.photos.map((p) =>
                          p.id === photo.id ? photo : p,
                        ),
                      }));
                      setSheet(null);
                    }}
                  />
                  <View style={{ height: 12 }} />
                  <Button
                    title="기기 사진첩에 저장"
                    outline
                    onPress={savePhotoToLibrary}
                  />
                  <View style={{ height: 12 }} />
                  <Button
                    title="사진 공유·파일로 저장"
                    outline
                    onPress={sharePhoto}
                  />
                  <Text style={s.footnote}>
                    공유 메뉴에서 저장할 앱이나 폴더를 선택해 주세요.
                  </Text>
                  <Pressable
                    style={s.delete}
                    onPress={() =>
                      remove(async () => {
                        const nextState = {
                          ...data,
                          photos: data.photos.filter((p) => p.id !== photo.id),
                        };
                        try {
                          await saveState(nextState, userId);
                          setData(nextState);
                          setSheet(null);
                          if (Platform.OS !== "web" && !photo.storagePath)
                            await FileSystem.deleteAsync(photo.uri, {
                              idempotent: true,
                            });
                        } catch {
                          tell(
                            "삭제 미완료",
                            "기록이나 사진 파일 정리를 다시 확인해 주세요.",
                          );
                        }
                      })
                    }
                  >
                    <Text style={s.deleteText}>이 사진 삭제</Text>
                  </Pressable>
                </>
              )}
              {sheet === "settings" && (
                <>
                  <Text style={s.eyebrow}>BEAUTIFUL TIMES · 0.1</Text>
                  <Text style={s.pageTitle}>우리의 공간 설정</Text>
                  <View style={s.statusCard}>
                    <Icon
                      name="phone-portrait-outline"
                      size={25}
                      color={C.accent}
                    />
                    <Text style={s.cardTitle}>{cloud.status.message}</Text>
                    <Text style={s.subtitle}>같은 카카오 계정으로 로그인하면 사진·배경·일정·글·디데이를 불러옵니다. 서버 보관 완료 전에는 이 기기의 기록을 유지해 주세요.</Text>
                    {!!cloud.status.lastSyncedAt && <Text style={s.footnote}>최근 동기화: {new Date(cloud.status.lastSyncedAt).toLocaleString("ko-KR")}</Text>}
                    <Button title={cloud.status.phase === "syncing" ? "동기화 중…" : "지금 동기화"} outline disabled={cloud.status.phase === "syncing"} onPress={() => { void cloud.refresh(); }} />
                    {cloud.status.phase === "conflict" && <>
                      <Text style={s.footnote}>다른 기기와 같은 기록을 수정했어요. 선택 전 이 기기 기록을 JSON으로 내보내 보관할 수 있습니다.</Text>
                      <Button title="이 기기 변경을 적용" outline onPress={() => { void cloud.resolve("local"); }} />
                      <Button title="서버 변경을 적용" outline onPress={() => { void cloud.resolve("remote"); }} />
                    </>}
                  </View>
                  <Heading title="내 계정" />
                  <AccountProfile user={user} />
                  <Text style={s.footnote}>카카오로 로그인했어요. 서버에 보관된 기록은 같은 계정으로 다시 불러올 수 있어요.</Text>
                  <Button title="로그아웃" outline onPress={() => { void logout().catch(() => tell("로그아웃 미완료", "다시 시도해 주세요.")); }} />
                  <Heading title="서비스 연결 상태" />
                  <Text style={s.footnote}>지도 연결은 개발자가 한 번 설정하면 자동으로 적용돼요. 가족이나 연인은 키를 입력할 필요가 없어요.</Text>
                  {[
                    "카카오 로그인",
                    "카카오톡 초대",
                    "내 계정 서버 보관",
                    "카카오 지도·장소 검색",
                  ].map((label) => (
                    <View key={label} style={s.settingsRow}>
                      <Text style={s.body}>{label}</Text>
                      <Text style={s.link}>
                        {label === "카카오 로그인" ? "로그인됨" : label === "내 계정 서버 보관" ? (cloud.status.phase === "synced" ? "동기화됨" : "동기화 확인") : label === "카카오 지도·장소 검색" && kakaoJsKey
                          ? "연결 설정됨"
                          : "연결 준비 중"}
                      </Text>
                    </View>
                  ))}
                  <Heading title="Supabase 서버 연결" />
                  <Text style={s.footnote}>BT-App · 서울 지역. 연결 테스트는 서버 응답만 확인하며 기록을 업로드하지 않아요.</Text>
                  <Button title={cloudChecking ? "서버 연결 확인 중…" : "Supabase 연결 테스트"} outline onPress={testCloudConnection} />
                  {cloudResult && <View style={[s.statusCard, { marginTop: 12 }]}>
                    <Text style={s.cardTitle}>✓ 인증 서버 · DB API 응답 확인</Text>
                    <Text style={s.subtitle}>{cloudResult.kakaoEnabled ? "카카오 로그인 공급자 설정됨" : "카카오 로그인 연결 전"}</Text>
                    <Text style={s.footnote}>사진·기록의 실제 보관 상태는 위의 동기화 표시에서 확인할 수 있어요.</Text>
                  </View>}
                  {!!cloudError && <Text accessibilityRole="alert" style={s.notice}>{cloudError}</Text>}
                  {__DEV__ && <>
                    <Heading title="로그인 유지 테스트" />
                    <Text style={s.footnote}>이 기기의 마지막 사용을 31일 전으로 설정해 30일 미사용 만료를 확인합니다. 현재 기기에서 다시 로그인해야 합니다.</Text>
                    <Button title="31일 미사용 상태로 테스트" outline onPress={() => Alert.alert('미사용 만료 테스트', '이 기기에서 로그인이 해제됩니다. 기록은 보관되며 다시 로그인할 수 있어요.', [{text:'취소',style:'cancel'},{text:'테스트',onPress:()=>{void testIdle().catch(()=>tell('테스트 실패','다시 시도해 주세요.'));}}])} />
                  </>}
                  <Heading title="개발용 서비스 연결" />
                  <Text style={s.footnote}>Mac에서 지도와 이동시간을 한 번 연결해 주세요. REST API 키는 앱과 기록 백업에 포함하지 않아요.</Text>
                  <Button title="Mac에서 서비스 연결 설정 ↗" outline onPress={() => Linking.openURL(ROUTE_BASE + '/setup').catch(() => tell('연결 실패','Mac에서 이동시간 서버가 실행 중인지 확인해 주세요.'))} />
                  <Heading title="이 기기에 담은 기록" />
                  <View style={s.stats}>
                    {[
                      { n: data.plans.length, label: "일정" },
                      { n: data.photos.length, label: "사진" },
                      { n: data.entries.length, label: "글" },
                    ].map((item) => (
                      <View key={item.label} style={s.stat}>
                        <Text style={s.statValue}>{item.n}</Text>
                        <Text style={s.caption}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={s.footnote}>
                    사진 파일 합계:{" "}
                    {(
                      data.photos.reduce((n, p) => n + p.bytes, 0) /
                      1024 /
                      1024
                    ).toFixed(1)}{" "}
                    MB{"\n"}앨범 사진의 용량입니다. Supabase 전체 사용량과 80% 알림은 아직 연결 전이에요.
                  </Text>
                  <Button
                    title="글·일정 JSON 내보내기"
                    outline
                    onPress={exportData}
                  />
                  <Text style={s.footnote}>
                    사진 파일은 포함되지 않아요. 사진은 각각 별도로 저장해
                    주세요. 이 버전에는 JSON 가져오기 기능이 없어요.
                  </Text>
                  <Button
                    title={
                      busy
                        ? "배경 사진 보관 중…"
                        : "현재 공간의 홈 배경 사진 설정"
                    }
                    outline
                    disabled={busy}
                    onPress={() => { void pickCover("saved"); }}
                  />
                  {!!coverUri && <Button title="기본 배경으로 변경" outline disabled={busy} onPress={() => { void resetSavedCover(); }} />}
                  <Text style={s.footnote}>
                    홈 배경은 화면에 맞는 고화질로 줄여 저장해요. 새 배경 저장이 완료되면 다른 곳에서 사용하지 않는 이전 배경은 서버에서 삭제돼요. 기본 배경으로 바꿀 때도 같아요.
                  </Text>
                  <Button
                    title="사용 안내 다시 보기"
                    outline
                    onPress={() => {
                      setSheet(null);
                      setTour(0);
                      setData((d) => ({ ...d, onboarded: false }));
                    }}
                  />
                  <Text style={s.footnote}>
                    서로 다른 계정 사이의 초대·공유, 권한 이전·연결 해제·회원 탈퇴는 다음 단계에서 제공돼요.
                  </Text>
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <AuthGate>{(user, logout, testIdle) => <BTApp key={user.id} user={user} logout={logout} testIdle={testIdle} />}</AuthGate>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.paper },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    backgroundColor: C.paper,
  },
  header: {
    paddingHorizontal: 26,
    paddingTop: 17,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  brand: { fontSize: 31, fontWeight: "800", letterSpacing: -2, color: C.ink },
  divider: { height: 18, width: 1, backgroundColor: "#D7DCD1" },
  brandFull: { fontSize: 13, color: C.secondary, letterSpacing: 0.3 },
  spaces: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 26,
    gap: 6,
    paddingBottom: 8,
  },
  spaceTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 25,
  },
  spaceText: { fontSize: 13, fontWeight: "600", color: C.secondary },
  local: { fontSize: 10, color: C.accent },
  content: {
    paddingHorizontal: 26,
    paddingTop: 23,
    paddingBottom: 20,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 2.2,
    fontWeight: "700",
    color: C.accent,
    marginBottom: 10,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -1.1,
    color: C.ink,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 21,
    color: C.secondary,
    marginTop: 8,
    marginBottom: 22,
  },
  hero: {
    backgroundColor: C.soft,
    borderRadius: 6,
    paddingTop: 23,
    overflow: "hidden",
    marginBottom: 5,
  },
  coverFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  coverPreview: { height: 150, backgroundColor: C.soft, borderRadius: 7, overflow: "hidden", marginBottom: 12 },
  photoText: { color: C.white, textShadowColor: "rgba(0,0,0,0.4)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 23,
  },
  heroTag: {
    color: C.accent,
    letterSpacing: 1.8,
    fontSize: 9,
    fontWeight: "600",
  },
  heroTitle: {
    color: C.ink,
    fontSize: 15,
    marginTop: 25,
    paddingHorizontal: 23,
  },
  dday: {
    fontSize: 30,
    letterSpacing: -1.2,
    color: C.ink,
    fontWeight: "600",
    marginTop: 7,
    paddingHorizontal: 23,
  },
  heroSub: {
    color: C.secondary,
    fontSize: 11,
    marginTop: 10,
    paddingHorizontal: 23,
  },
  heroFooter: {
    color: C.accent,
    letterSpacing: 0.7,
    fontSize: 9,
    paddingHorizontal: 23,
    paddingBottom: 20,
    marginTop: -4,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.5,
  },
  caption: { fontSize: 11, lineHeight: 18, color: C.secondary, marginTop: 3 },
  link: { fontSize: 11, color: C.secondary },
  button: {
    minHeight: 49,
    borderRadius: 5,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 19,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#D4D9CE",
  },
  buttonText: { color: C.white, fontSize: 13, fontWeight: "600" },
  empty: {
    alignItems: "center",
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    padding: 26,
    borderRadius: 6,
    gap: 12,
    marginBottom: 5,
  },
  emptyIcon: {
    width: 53,
    height: 53,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 27,
    backgroundColor: "#F3F5EF",
  },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: C.ink },
  emptyBody: {
    fontSize: 12,
    color: C.secondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 5,
  },
  card: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 6,
    backgroundColor: C.white,
    padding: 17,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dateBadge: {
    width: 46,
    paddingVertical: 7,
    alignItems: "center",
    backgroundColor: C.soft,
    borderRadius: 4,
  },
  dateMonth: { fontSize: 9, color: C.secondary },
  dateDay: { fontSize: 22, fontWeight: "600", color: C.ink },
  cardTitle: { fontSize: 14, fontWeight: "600", color: C.ink, lineHeight: 22 },
  route: {
    paddingTop: 14,
    marginTop: 13,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  routeText: { fontSize: 11, lineHeight: 20, color: C.secondary },
  memoryPrompt: {
    padding: 18,
    borderWidth: 1,
    borderColor: C.line,
    borderStyle: "dashed",
    borderRadius: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  promptText: { color: C.secondary, fontSize: 12, flex: 1 },
  letterPrompt: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    marginTop: 25,
    paddingVertical: 22,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  navSafe: {
    backgroundColor: C.paper,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  nav: {
    flexDirection: "row",
    paddingTop: 13,
    paddingBottom: 5,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  navItem: { flex: 1, alignItems: "center", gap: 5, minHeight: 48 },
  navLabel: { fontSize: 10, color: C.muted },
  navDot: { width: 3, height: 3, borderRadius: 2, marginTop: 2 },
  endMark: { alignItems: "center", gap: 4, marginTop: 34, marginBottom: 16 },
  endBrand: {
    color: "#B5BDB0",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -1,
  },
  endText: { fontSize: 9, letterSpacing: 0.7, color: "#A4ACA0" },
  add: {
    width: 38,
    height: 38,
    borderRadius: 20,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  notice: {
    backgroundColor: C.soft,
    padding: 14,
    borderRadius: 5,
    fontSize: 11,
    color: C.accent,
    lineHeight: 19,
    marginVertical: 17,
  },
  chips: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 16,
  },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: C.soft,
  },
  chipActive: { backgroundColor: C.ink },
  chipText: { fontSize: 12, color: C.secondary },
  footnote: {
    fontSize: 11,
    lineHeight: 19,
    color: C.secondary,
    marginVertical: 12,
  },
  photoRow: { flexDirection: "row", gap: 8 },
  smallPhoto: {
    flex: 1,
    aspectRatio: 0.9,
    overflow: "hidden",
    borderRadius: 4,
  },
  fill: { width: "100%", height: "100%" },
  albumGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
  albumPhoto: { width: "48%", marginBottom: 8 },
  albumImage: {
    width: "100%",
    aspectRatio: 0.9,
    borderRadius: 5,
    backgroundColor: C.soft,
  },
  photoCaption: { fontSize: 11, color: C.secondary, marginTop: 8 },
  photoDetail: {
    width: "100%",
    height: 350,
    backgroundColor: C.soft,
    borderRadius: 5,
  },
  entryCard: {
    padding: 23,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 5,
    backgroundColor: C.white,
    marginTop: 15,
  },
  entryTag: { fontSize: 9, letterSpacing: 1.5, color: C.accent },
  entryTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: C.ink,
    marginTop: 20,
    marginBottom: 10,
  },
  entryBody: { fontSize: 13, color: C.secondary, lineHeight: 23 },
  sheetHeader: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetContent: {
    padding: 25,
    paddingBottom: 50,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  field: { marginBottom: 17 },
  label: { color: C.ink, fontSize: 12, fontWeight: "600", marginBottom: 9 },
  stopCard: {
    padding: 17,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 6,
    marginBottom: 17,
    gap: 8,
  },
  number: {
    backgroundColor: C.ink,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
  },
  mini: { padding: 7 },
  modeRow: { flexDirection: "row", marginBottom: 8 },
  mode: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    gap: 5,
    borderRadius: 5,
  },
  modeLabel: { color: C.secondary, fontSize: 12 },
  delete: { alignItems: "center", padding: 19, marginTop: 12 },
  deleteText: { fontSize: 12, color: "#9C625C" },
  statusCard: {
    marginTop: 25,
    padding: 23,
    borderRadius: 6,
    backgroundColor: C.soft,
    gap: 9,
  },
  settingsRow: {
    paddingVertical: 17,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  body: { color: C.ink, fontSize: 13 },
  stats: {
    flexDirection: "row",
    paddingVertical: 17,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 5,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 25, color: C.ink, fontWeight: "600" },
  tour: {
    flexGrow: 1,
    padding: 27,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  tourArt: {
    marginTop: 30,
    marginBottom: 40,
    minHeight: 220,
    justifyContent: "center",
    borderRadius: 140,
    backgroundColor: C.soft,
    overflow: "hidden",
  },
  tourSymbol: { position: "absolute", alignSelf: "center", top: 55 },
  tourTitle: {
    fontSize: 33,
    lineHeight: 46,
    fontWeight: "600",
    color: C.ink,
    letterSpacing: -1.6,
  },
  tourBody: { fontSize: 12, color: C.secondary, lineHeight: 23, marginTop: 20 },
  dots: { flexDirection: "row", gap: 7, marginVertical: 30 },
  dot: { width: 5, height: 5, borderRadius: 4, backgroundColor: "#D5DDCE" },
  activeDot: { width: 20, backgroundColor: C.accent },
});
