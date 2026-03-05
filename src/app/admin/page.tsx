"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  formatDate,
  parseDate,
  isRegularHoliday,
  isWeekend,
  getDayLabel,
} from "@/lib/slots";
import type { Reservation } from "@/lib/availability";

type Tab = "dashboard" | "calendar" | "reservations" | "settings";
type Filter = "all" | "upcoming" | "past" | "cancelled";

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthenticated(true);
      sessionStorage.setItem("admin_auth", "true");
    } else {
      setAuthError("パスワードが違います");
    }
  }

  useEffect(() => {
    if (sessionStorage.getItem("admin_auth") === "true") {
      setAuthenticated(true);
    }
  }, []);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-warm-50 flex items-center justify-center px-4">
        <form
          onSubmit={handleLogin}
          className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm"
        >
          <h1
            className="text-xl font-bold text-warm-800 mb-6 text-center"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            管理画面ログイン
          </h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            className="w-full border border-warm-300 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:border-green-500"
          />
          {authError && (
            <p className="text-red-500 text-sm mb-4">{authError}</p>
          )}
          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg transition-colors"
          >
            ログイン
          </button>
        </form>
      </div>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [specialOpenDays, setSpecialOpenDays] = useState<string[]>([]);
  const [specialClosedDays, setSpecialClosedDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = React.useRef(false);

  const todayStr = formatDate(new Date());

  const fetchData = useCallback(async () => {
    // 初回のみローディング表示（再取得時はコンポーネントをアンマウントしない）
    if (!initialLoadDone.current) {
      setLoading(true);
    }
    try {
      const [resReservations, resSpecial, resClosed] = await Promise.all([
        fetch(`/api/reservations?from=2020-01-01&to=2099-12-31`),
        fetch("/api/special-open-days"),
        fetch("/api/special-closed-days"),
      ]);
      const reservationsData = await resReservations.json();
      const specialData = await resSpecial.json();
      const closedData = await resClosed.json();
      setReservations(Array.isArray(reservationsData) ? reservationsData : []);
      setSpecialOpenDays(
        Array.isArray(specialData)
          ? specialData.map((d: { date: string }) => d.date)
          : []
      );
      setSpecialClosedDays(
        Array.isArray(closedData)
          ? closedData.map((d: { date: string }) => d.date)
          : []
      );
    } catch {
      // ignore
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const confirmedReservations = reservations.filter(
    (r) => r.status === "confirmed"
  );
  const todayReservations = confirmedReservations.filter(
    (r) => r.date === todayStr
  );
  const upcomingReservations = confirmedReservations.filter(
    (r) => r.date >= todayStr
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "ダッシュボード" },
    { id: "calendar", label: "カレンダー" },
    { id: "reservations", label: "予約一覧" },
    { id: "settings", label: "設定" },
  ];

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-warm-800 text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1
            className="text-lg font-bold"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            さとやま食堂 管理画面
          </h1>
          <button
            onClick={() => {
              sessionStorage.removeItem("admin_auth");
              window.location.reload();
            }}
            className="text-warm-300 hover:text-white text-sm"
          >
            ログアウト
          </button>
        </div>
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  tab === t.id
                    ? "bg-warm-50 text-warm-800"
                    : "text-warm-300 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <p className="text-center text-warm-500 py-12">読み込み中...</p>
        ) : (
          <>
            {tab === "dashboard" && (
              <DashboardTab
                todayReservations={todayReservations}
                upcomingReservations={upcomingReservations}
                totalReservations={confirmedReservations}
                todayStr={todayStr}
              />
            )}
            {tab === "calendar" && (
              <CalendarTab
                reservations={confirmedReservations}
                specialOpenDays={specialOpenDays}
                specialClosedDays={specialClosedDays}
                onUpdate={fetchData}
              />
            )}
            {tab === "reservations" && (
              <ReservationsTab
                reservations={reservations}
                todayStr={todayStr}
                onUpdate={fetchData}
              />
            )}
            {tab === "settings" && <SettingsTab />}
          </>
        )}
      </div>
    </div>
  );
}

function DashboardTab({
  todayReservations,
  upcomingReservations,
  totalReservations,
  todayStr,
}: {
  todayReservations: Reservation[];
  upcomingReservations: Reservation[];
  totalReservations: Reservation[];
  todayStr: string;
}) {
  const todayGuests = todayReservations.reduce((s, r) => s + r.guests, 0);

  return (
    <div>
      <h2
        className="text-xl font-bold text-warm-800 mb-6"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        ダッシュボード
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-warm-500 mb-1">本日の予約</p>
          <p className="text-3xl font-bold text-warm-800">
            {todayReservations.length}
            <span className="text-lg text-warm-500 ml-1">件</span>
          </p>
          <p className="text-sm text-warm-400 mt-1">{todayGuests}名</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-warm-500 mb-1">今後の予約</p>
          <p className="text-3xl font-bold text-warm-800">
            {upcomingReservations.length}
            <span className="text-lg text-warm-500 ml-1">件</span>
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <p className="text-sm text-warm-500 mb-1">総予約数</p>
          <p className="text-3xl font-bold text-warm-800">
            {totalReservations.length}
            <span className="text-lg text-warm-500 ml-1">件</span>
          </p>
        </div>
      </div>

      {/* 本日の予約一覧 */}
      <h3 className="text-lg font-bold text-warm-800 mb-3">
        本日の予約（{todayStr}）
      </h3>
      {todayReservations.length === 0 ? (
        <p className="text-warm-500 bg-white rounded-xl p-6">
          本日の予約はありません
        </p>
      ) : (
        <div className="space-y-3">
          {todayReservations.map((r) => (
            <ReservationCard key={r.id} reservation={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function CalendarTab({
  reservations,
  specialOpenDays,
  specialClosedDays,
  onUpdate,
}: {
  reservations: Reservation[];
  specialOpenDays: string[];
  specialClosedDays: string[];
  onUpdate: () => void;
}) {
  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );
  const [toggling, setToggling] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  function generateCalendarDays(yearMonth: string) {
    const [y, m] = yearMonth.split("-").map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0);
    const days: (string | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(
        `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
      );
    }
    return days;
  }

  function getReservationCount(date: string): number {
    return reservations.filter((r) => r.date === date).length;
  }

  async function toggleSpecialDay(dateStr: string, e: React.MouseEvent) {
    e.stopPropagation();
    setToggling(true);
    try {
      let res: Response;
      if (specialOpenDays.includes(dateStr)) {
        res = await fetch(`/api/special-open-days/${dateStr}`, { method: "DELETE" });
      } else {
        res = await fetch("/api/special-open-days", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dateStr }),
        });
      }
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "臨時営業の設定に失敗しました");
        return;
      }
      await onUpdate();
    } catch {
      alert("通信エラーが発生しました");
    } finally {
      setToggling(false);
    }
  }

  async function toggleClosedDay(dateStr: string, e: React.MouseEvent) {
    e.stopPropagation();
    setToggling(true);
    try {
      let res: Response;
      if (specialClosedDays.includes(dateStr)) {
        res = await fetch(`/api/special-closed-days/${dateStr}`, { method: "DELETE" });
      } else {
        res = await fetch("/api/special-closed-days", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dateStr }),
        });
      }
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "臨時休業の設定に失敗しました");
        return;
      }
      await onUpdate();
    } catch {
      alert("通信エラーが発生しました");
    } finally {
      setToggling(false);
    }
  }

  const selectedDateReservations = selectedDate
    ? reservations.filter((r) => r.date === selectedDate)
    : [];

  return (
    <div>
      <h2
        className="text-xl font-bold text-warm-800 mb-6"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        カレンダー
      </h2>

      <div className="bg-white rounded-xl shadow-sm p-3 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              const [y, m] = calendarMonth.split("-").map(Number);
              setCalendarMonth(
                m === 1
                  ? `${y - 1}-12`
                  : `${y}-${String(m - 1).padStart(2, "0")}`
              );
            }}
            className="text-warm-600 hover:text-warm-800 px-2 sm:px-3 py-1 text-sm sm:text-base"
          >
            ◀ 前月
          </button>
          <span className="text-base sm:text-lg font-bold text-warm-800">
            {calendarMonth.replace("-", "年")}月
          </span>
          <button
            onClick={() => {
              const [y, m] = calendarMonth.split("-").map(Number);
              setCalendarMonth(
                m === 12
                  ? `${y + 1}-01`
                  : `${y}-${String(m + 1).padStart(2, "0")}`
              );
            }}
            className="text-warm-600 hover:text-warm-800 px-2 sm:px-3 py-1 text-sm sm:text-base"
          >
            次月 ▶
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
          {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
            <div key={d} className="text-warm-500 font-medium py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {generateCalendarDays(calendarMonth).map((dateStr, i) => {
            if (!dateStr) return <div key={`empty-${i}`} />;
            const d = parseDate(dateStr);
            const isHoliday = isRegularHoliday(d);
            const isSpecial = specialOpenDays.includes(dateStr);
            const isClosed = specialClosedDays.includes(dateStr);
            const count = getReservationCount(dateStr);
            const dayOfWeek = d.getDay();
            const isSelected = dateStr === selectedDate;

            return (
              <div
                key={dateStr}
                onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                className={`p-1 sm:p-2 rounded-lg text-center min-h-[52px] sm:min-h-[60px] cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-green-100 border-2 border-green-500 ring-1 ring-green-300"
                    : isClosed
                    ? "bg-red-50 border border-red-300 hover:bg-red-100"
                    : isHoliday && !isSpecial
                    ? "bg-warm-100 hover:bg-warm-200"
                    : isSpecial
                    ? "bg-green-50 border border-green-300 hover:bg-green-100"
                    : "bg-white border border-warm-100 hover:bg-warm-50"
                }`}
              >
                <div
                  className={`text-xs sm:text-sm font-medium ${
                    dayOfWeek === 0
                      ? "text-red-500"
                      : dayOfWeek === 6
                      ? "text-blue-500"
                      : "text-warm-800"
                  }`}
                >
                  {d.getDate()}
                </div>
                {count > 0 && (
                  <div className="text-[10px] sm:text-xs text-green-600 font-bold">
                    {count}件
                  </div>
                )}
                {/* 定休日（火水）の臨時営業トグル */}
                {isHoliday && (
                  <button
                    onClick={(e) => toggleSpecialDay(dateStr, e)}
                    disabled={toggling}
                    className={`text-[10px] leading-tight mt-0.5 sm:mt-1 px-1 py-0.5 rounded w-full ${
                      isSpecial
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-warm-300 text-white hover:bg-warm-400"
                    }`}
                  >
                    {isSpecial ? "臨営" : "定休"}
                  </button>
                )}
                {/* 営業日の臨時休業トグル */}
                {!isHoliday && (
                  <button
                    onClick={(e) => toggleClosedDay(dateStr, e)}
                    disabled={toggling}
                    className={`text-[10px] leading-tight mt-0.5 sm:mt-1 px-1 py-0.5 rounded w-full ${
                      isClosed
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : "bg-warm-200 text-warm-500 hover:bg-warm-300"
                    }`}
                  >
                    {isClosed ? "臨休" : "営業"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-warm-400 mt-3">
        火曜・水曜の「定休日」→臨時営業に切替可。営業日の「休業設定」→臨時休業に切替可。日付クリックでタイムライン表示。
      </p>

      {/* タイムラインビュー */}
      {selectedDate && (
        <TimelineView
          date={selectedDate}
          reservations={selectedDateReservations}
        />
      )}
    </div>
  );
}

/* ===== タイムラインビュー ===== */

const TIMELINE_SEATS = [
  { id: "counter", label: "カウンター", rowIndex: 0 },
  { id: "table2a", label: "2名席A", rowIndex: 1 },
  { id: "table2b", label: "2名席B", rowIndex: 2 },
  { id: "table4", label: "4名席", rowIndex: 3 },
  { id: "table6", label: "6名席", rowIndex: 4 },
];

const ROW_HEIGHT = 48;
const SEAT_LABEL_WIDTH = 80;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function TimelineView({
  date,
  reservations,
}: {
  date: string;
  reservations: Reservation[];
}) {
  const [popupReservation, setPopupReservation] = useState<Reservation | null>(null);

  const d = parseDate(date);
  const isWknd = isWeekend(d);

  // 平日: 11:30〜15:00 / 土日祝: 9:00〜17:00
  const timelineStartMin = isWknd ? timeToMinutes("09:00") : timeToMinutes("11:30");
  const timelineEndMin = isWknd ? timeToMinutes("17:00") : timeToMinutes("15:00");
  const totalMinutes = timelineEndMin - timelineStartMin;

  // 時間ラベル（1時間刻み）
  const hourLabels: { label: string; offsetPct: number }[] = [];
  const firstHour = Math.ceil(timelineStartMin / 60);
  const lastHour = Math.floor(timelineEndMin / 60);
  for (let h = firstHour; h <= lastHour; h++) {
    const min = h * 60;
    if (min >= timelineStartMin && min <= timelineEndMin) {
      hourLabels.push({
        label: `${h}:00`,
        offsetPct: ((min - timelineStartMin) / totalMinutes) * 100,
      });
    }
  }

  // 30分刻みの補助線
  const gridLines: number[] = [];
  for (let m = timelineStartMin; m <= timelineEndMin; m += 30) {
    gridLines.push(((m - timelineStartMin) / totalMinutes) * 100);
  }

  const confirmedReservations = reservations.filter((r) => r.status === "confirmed");

  // 予約ブロックの位置計算
  function getBlockStyle(r: Reservation) {
    const startMin = timeToMinutes(r.start_time);
    const endMin = timeToMinutes(r.end_time);
    const leftPct = ((startMin - timelineStartMin) / totalMinutes) * 100;
    const widthPct = ((endMin - startMin) / totalMinutes) * 100;
    return { left: `${leftPct}%`, width: `${widthPct}%` };
  }

  // 結合席かどうか
  function isCombined(r: Reservation): boolean {
    return r.seat_type === "combined" || r.seat_id === "table2ab";
  }

  // 各予約をどの行に表示するか決定
  function getRowsForReservation(r: Reservation): number[] {
    if (isCombined(r)) {
      // table2a (row 1) と table2b (row 2) にまたがる
      return [1, 2];
    }
    const seat = TIMELINE_SEATS.find((s) => s.id === r.seat_id);
    return seat ? [seat.rowIndex] : [];
  }

  // ブロックの色
  const BLOCK_COLORS = [
    "bg-green-500",
    "bg-green-600",
    "bg-green-400",
    "bg-warm-500",
    "bg-warm-400",
  ];

  return (
    <div className="mt-6">
      <h3
        className="text-lg font-bold text-warm-800 mb-3"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {date} ({getDayLabel(d)}) のタイムライン
      </h3>

      <div className="bg-white rounded-xl shadow-sm p-4 overflow-x-auto">
        <div className="min-w-[600px]">
          {/* 時間ラベル */}
          <div className="flex" style={{ marginLeft: SEAT_LABEL_WIDTH }}>
            <div className="relative w-full h-6">
              {hourLabels.map((h) => (
                <span
                  key={h.label}
                  className="absolute text-xs text-warm-500 -translate-x-1/2"
                  style={{ left: `${h.offsetPct}%` }}
                >
                  {h.label}
                </span>
              ))}
            </div>
          </div>

          {/* タイムライングリッド + 予約ブロック */}
          <div className="relative">
            {TIMELINE_SEATS.map((seat, rowIdx) => (
              <div key={seat.id} className="flex items-stretch" style={{ height: ROW_HEIGHT }}>
                {/* 席ラベル */}
                <div
                  className="shrink-0 flex items-center justify-end pr-3 text-xs font-medium text-warm-700"
                  style={{ width: SEAT_LABEL_WIDTH }}
                >
                  {seat.label}
                </div>
                {/* グリッド領域 */}
                <div className="relative flex-1 border-b border-warm-100">
                  {/* 補助線 */}
                  {gridLines.map((pct, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-warm-100"
                      style={{ left: `${pct}%` }}
                    />
                  ))}
                  {/* 時間帯の背景 */}
                  <div className="absolute inset-0 bg-warm-50 opacity-30" />

                  {/* 予約ブロック */}
                  {confirmedReservations
                    .filter((r) => {
                      const rows = getRowsForReservation(r);
                      return rows.includes(rowIdx);
                    })
                    .map((r, blockIdx) => {
                      const style = getBlockStyle(r);
                      const combined = isCombined(r);
                      const rows = getRowsForReservation(r);
                      const isTopOfCombined = combined && rowIdx === rows[0];
                      const isBottomOfCombined = combined && rowIdx === rows[rows.length - 1];

                      return (
                        <div
                          key={r.id}
                          onClick={() => setPopupReservation(r)}
                          className={`absolute cursor-pointer transition-opacity hover:opacity-90 ${
                            BLOCK_COLORS[blockIdx % BLOCK_COLORS.length]
                          } text-white shadow-sm ${
                            combined
                              ? isTopOfCombined
                                ? "rounded-t-md border-b-0"
                                : isBottomOfCombined
                                ? "rounded-b-md border-t-0"
                                : ""
                              : "rounded-md"
                          }`}
                          style={{
                            ...style,
                            top: combined && !isTopOfCombined ? 0 : 4,
                            bottom: combined && !isBottomOfCombined ? 0 : 4,
                            zIndex: 10,
                          }}
                        >
                          {/* 結合席は上段のみテキスト表示 */}
                          {(!combined || isTopOfCombined) && (
                            <div className="px-1.5 py-0.5 truncate">
                              <span className="text-xs font-bold">{r.name}</span>
                              <span className="text-[10px] ml-1 opacity-80">{r.guests}名</span>
                            </div>
                          )}
                          {combined && isBottomOfCombined && (
                            <div className="px-1.5 py-0.5">
                              <span className="text-[10px] opacity-70">結合席</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          {/* 下部時間ラベル */}
          <div className="flex" style={{ marginLeft: SEAT_LABEL_WIDTH }}>
            <div className="relative w-full h-6">
              {hourLabels.map((h) => (
                <span
                  key={h.label}
                  className="absolute text-xs text-warm-400 -translate-x-1/2"
                  style={{ left: `${h.offsetPct}%` }}
                >
                  {h.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {confirmedReservations.length === 0 && (
          <p className="text-center text-warm-400 text-sm py-4">
            この日の予約はありません
          </p>
        )}
      </div>

      {/* 予約詳細ポップアップ */}
      {popupReservation && (
        <ReservationPopup
          reservation={popupReservation}
          onClose={() => setPopupReservation(null)}
        />
      )}
    </div>
  );
}

function ReservationPopup({
  reservation: r,
  onClose,
}: {
  reservation: Reservation;
  onClose: () => void;
}) {
  const d = parseDate(r.date);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-warm-400 hover:text-warm-700 text-lg"
        >
          ✕
        </button>
        <h4
          className="text-lg font-bold text-warm-800 mb-4"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          予約詳細
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-warm-500">お名前</span>
            <span className="font-bold text-warm-800">{r.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-warm-500">日時</span>
            <span className="text-warm-800">
              {r.date} ({getDayLabel(d)})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-warm-500">時間</span>
            <span className="text-warm-800">
              {r.start_time}〜{r.end_time}（{r.slot_label}）
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-warm-500">人数</span>
            <span className="text-warm-800">{r.guests}名</span>
          </div>
          <div className="flex justify-between">
            <span className="text-warm-500">お席</span>
            <span className="text-warm-800">
              {r.seat_label}
              {r.seat_type === "combined" && (
                <span className="ml-1 text-xs bg-warm-200 text-warm-600 px-1 py-0.5 rounded">
                  結合
                </span>
              )}
            </span>
          </div>
          <hr className="border-warm-200" />
          <div className="flex justify-between">
            <span className="text-warm-500">電話番号</span>
            <span className="text-warm-800">{r.phone}</span>
          </div>
          {r.email && (
            <div className="flex justify-between">
              <span className="text-warm-500">メール</span>
              <span className="text-warm-800">{r.email}</span>
            </div>
          )}
          {r.note && (
            <div>
              <span className="text-warm-500">備考</span>
              <p className="text-warm-800 mt-1 bg-warm-50 rounded-lg p-2">
                {r.note}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="mt-5 w-full bg-warm-100 hover:bg-warm-200 text-warm-700 font-medium py-2 rounded-lg transition-colors text-sm"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

function ReservationsTab({
  reservations,
  todayStr,
  onUpdate,
}: {
  reservations: Reservation[];
  todayStr: string;
  onUpdate: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("upcoming");

  const filtered = reservations.filter((r) => {
    switch (filter) {
      case "upcoming":
        return r.date >= todayStr && r.status === "confirmed";
      case "past":
        return r.date < todayStr && r.status === "confirmed";
      case "cancelled":
        return r.status === "cancelled";
      default:
        return true;
    }
  });

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "すべて" },
    { id: "upcoming", label: "今後" },
    { id: "past", label: "過去" },
    { id: "cancelled", label: "キャンセル" },
  ];

  async function handleStatusChange(id: string, status: string) {
    await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onUpdate();
  }

  return (
    <div>
      <h2
        className="text-xl font-bold text-warm-800 mb-6"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        予約一覧
      </h2>

      <div className="flex gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.id
                ? "bg-green-600 text-white"
                : "bg-white text-warm-600 hover:bg-warm-100"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-warm-500 bg-white rounded-xl p-6">
          該当する予約はありません
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <ReservationCard
              key={r.id}
              reservation={r}
              showActions
              onCancel={() => handleStatusChange(r.id, "cancelled")}
              onRestore={() => handleStatusChange(r.id, "confirmed")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("すべての項目を入力してください");
      return;
    }
    if (newPassword.length < 8) {
      setError("新しいパスワードは8文字以上にしてください");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("新しいパスワードが一致しません");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("パスワードを変更しました");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError(data.error || "パスワードの変更に失敗しました");
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2
        className="text-xl font-bold text-warm-800 mb-6"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        設定
      </h2>

      <div className="bg-white rounded-xl shadow-sm p-6 max-w-md">
        <h3 className="text-lg font-bold text-warm-800 mb-4">
          パスワード変更
        </h3>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm text-warm-600 mb-1">
              現在のパスワード
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-warm-300 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
            />
          </div>
          <div>
            <label className="block text-sm text-warm-600 mb-1">
              新しいパスワード
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-warm-300 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
            />
            <p className="text-xs text-warm-400 mt-1">8文字以上</p>
          </div>
          <div>
            <label className="block text-sm text-warm-600 mb-1">
              新しいパスワード（確認）
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-warm-300 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          {message && <p className="text-green-600 text-sm">{message}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 rounded-lg transition-colors"
          >
            {submitting ? "変更中..." : "パスワードを変更"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ReservationCard({
  reservation: r,
  showActions,
  onCancel,
  onRestore,
}: {
  reservation: Reservation;
  showActions?: boolean;
  onCancel?: () => void;
  onRestore?: () => void;
}) {
  const d = parseDate(r.date);

  return (
    <div
      className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${
        r.status === "cancelled"
          ? "border-warm-300 opacity-60"
          : "border-green-500"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-warm-800">{r.name}</span>
            <span className="text-sm text-warm-500">{r.guests}名</span>
            {r.seat_type === "combined" && (
              <span className="text-xs bg-warm-200 text-warm-600 px-1.5 py-0.5 rounded">
                結合席
              </span>
            )}
            {r.status === "cancelled" && (
              <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
                キャンセル
              </span>
            )}
          </div>
          <p className="text-sm text-warm-600">
            {r.date} ({getDayLabel(d)}) {r.start_time}〜{r.end_time}（
            {r.slot_label}）
          </p>
          <p className="text-sm text-warm-500">
            席: {r.seat_label}
          </p>
          <p className="text-sm text-warm-500">TEL: {r.phone}</p>
          {r.note && (
            <p className="text-sm text-warm-400">備考: {r.note}</p>
          )}
        </div>
        {showActions && (
          <div className="flex gap-2">
            {r.status === "confirmed" && onCancel && (
              <button
                onClick={onCancel}
                className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                キャンセル
              </button>
            )}
            {r.status === "cancelled" && onRestore && (
              <button
                onClick={onRestore}
                className="text-xs bg-green-50 text-green-600 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                復元
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
