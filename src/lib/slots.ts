export interface TimeSlot {
  id: string;
  label: string;
  startHour: string; // "HH:MM"
  endHour: string;   // "HH:MM"
}

/** 平日（月・木・金）の時間帯 */
export const WEEKDAY_SLOTS: TimeSlot[] = [
  { id: "lunch", label: "ランチ", startHour: "11:30", endHour: "15:00" },
];

/** 土日祝日の時間帯 */
export const WEEKEND_SLOTS: TimeSlot[] = [
  { id: "breakfast", label: "朝食", startHour: "09:00", endHour: "10:30" },
  { id: "lunch", label: "ランチ", startHour: "11:30", endHour: "14:00" },
  { id: "tea", label: "ティータイム", startHour: "14:00", endHour: "17:00" },
];

const RESERVATION_DURATION_MINUTES = 90;
const TIME_STEP_MINUTES = 15;

/** 定休日かどうか（火=2, 水=3） */
export function isRegularHoliday(date: Date): boolean {
  const day = date.getDay();
  return day === 2 || day === 3;
}

/** 土日祝かどうか（簡易版: 土=6, 日=0） */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** 指定日の時間帯リストを返す */
export function getSlotsForDate(date: Date): TimeSlot[] {
  if (isWeekend(date)) return WEEKEND_SLOTS;
  return WEEKDAY_SLOTS;
}

/** HH:MM を分に変換 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** 分を HH:MM に変換 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 指定時間帯で選択可能な開始時刻一覧を返す */
export function getStartTimes(slot: TimeSlot): string[] {
  const startMin = timeToMinutes(slot.startHour);
  const endMin = timeToMinutes(slot.endHour);
  const times: string[] = [];

  // 開始時刻 + 90分 が endHour 以内に収まる範囲
  for (let t = startMin; t + RESERVATION_DURATION_MINUTES <= endMin; t += TIME_STEP_MINUTES) {
    times.push(minutesToTime(t));
  }
  return times;
}

/** 開始時刻から終了時刻を計算 */
export function getEndTime(startTime: string): string {
  return minutesToTime(timeToMinutes(startTime) + RESERVATION_DURATION_MINUTES);
}

/** 予約受付の締切チェック（前日22:00まで） */
export function isReservationClosed(dateStr: string): boolean {
  const now = new Date();
  // JST での現在時刻を取得
  const jstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const target = parseDate(dateStr);
  // 締切 = 予約日の前日 22:00
  const deadline = new Date(target.getFullYear(), target.getMonth(), target.getDate() - 1, 22, 0, 0);
  return jstNow >= deadline;
}

/** 予約受付可能な最大日付（今日から60日先） */
export function getMaxDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d;
}

/** Date を YYYY-MM-DD に変換（Asia/Tokyo） */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD を Date に変換 */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** 曜日ラベル */
const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
export function getDayLabel(date: Date): string {
  return DAY_LABELS[date.getDay()];
}
