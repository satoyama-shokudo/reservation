"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  formatDate,
  parseDate,
  isRegularHoliday,
  isWeekend,
  getDayLabel,
} from "@/lib/slots";
import { SEATS } from "@/lib/seats";
import type { Reservation } from "@/lib/availability";

interface Block {
  id: string;
  date: string;
  seat_id: string | null;
  start_time: string;
  end_time: string;
  created_at: string;
}

type Tab = "dashboard" | "calendar" | "reservations" | "settings";
type Filter = "all" | "upcoming" | "past" | "cancelled";

/* ===== Physical seats for timeline rows ===== */
const TIMELINE_SEATS = [
  { id: "counter", label: "C2", rowIndex: 0 },
  { id: "table2a", label: "T2a", rowIndex: 1 },
  { id: "table2b", label: "T2b", rowIndex: 2 },
  { id: "table4", label: "T4", rowIndex: 3 },
  { id: "table6", label: "T6", rowIndex: 4 },
];

const ROW_HEIGHT = 48;
const SEAT_LABEL_WIDTH = 80;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function doTimesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return (
    timeToMinutes(startA) < timeToMinutes(endB) &&
    timeToMinutes(startB) < timeToMinutes(endA)
  );
}

/* ===== Login + Root ===== */

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

/* ===== Dashboard Shell ===== */

function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [specialOpenDays, setSpecialOpenDays] = useState<string[]>([]);
  const [specialClosedDays, setSpecialClosedDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = React.useRef(false);

  const todayStr = formatDate(new Date());

  const fetchData = useCallback(async () => {
    if (!initialLoadDone.current) {
      setLoading(true);
    }
    try {
      const [resReservations, resSpecial, resClosed, resBlocks] =
        await Promise.all([
          fetch(`/api/reservations?from=2020-01-01&to=2099-12-31`),
          fetch("/api/special-open-days"),
          fetch("/api/special-closed-days"),
          fetch("/api/reservation-blocks"),
        ]);
      const reservationsData = await resReservations.json();
      const specialData = await resSpecial.json();
      const closedData = await resClosed.json();
      const blocksData = await resBlocks.json();
      setReservations(
        Array.isArray(reservationsData) ? reservationsData : []
      );
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
      setBlocks(Array.isArray(blocksData) ? blocksData : []);
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
                allReservations={reservations}
                todayStr={todayStr}
                onUpdate={fetchData}
              />
            )}
            {tab === "calendar" && (
              <CalendarTab
                reservations={confirmedReservations}
                allReservations={reservations}
                blocks={blocks}
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

/* ===== Dashboard Tab ===== */

function DashboardTab({
  todayReservations,
  upcomingReservations,
  totalReservations,
  allReservations,
  todayStr,
  onUpdate,
}: {
  todayReservations: Reservation[];
  upcomingReservations: Reservation[];
  totalReservations: Reservation[];
  allReservations: Reservation[];
  todayStr: string;
  onUpdate: () => void;
}) {
  const todayGuests = todayReservations.reduce((s, r) => s + r.guests, 0);
  const [popupReservation, setPopupReservation] = useState<Reservation | null>(
    null
  );

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
            <ReservationCard
              key={r.id}
              reservation={r}
              onClick={() => setPopupReservation(r)}
            />
          ))}
        </div>
      )}

      {popupReservation && (
        <ReservationPopup
          reservation={popupReservation}
          allReservations={allReservations}
          onClose={() => setPopupReservation(null)}
          onUpdate={() => {
            setPopupReservation(null);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}

/* ===== Calendar Tab ===== */

function CalendarTab({
  reservations,
  allReservations,
  blocks,
  specialOpenDays,
  specialClosedDays,
  onUpdate,
}: {
  reservations: Reservation[];
  allReservations: Reservation[];
  blocks: Block[];
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

  function getBlockCount(date: string): number {
    return blocks.filter((b) => b.date === date).length;
  }

  async function toggleSpecialDay(dateStr: string, e: React.MouseEvent) {
    e.stopPropagation();
    setToggling(true);
    try {
      let res: Response;
      if (specialOpenDays.includes(dateStr)) {
        res = await fetch(`/api/special-open-days/${dateStr}`, {
          method: "DELETE",
        });
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
        res = await fetch(`/api/special-closed-days/${dateStr}`, {
          method: "DELETE",
        });
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
  const selectedDateBlocks = selectedDate
    ? blocks.filter((b) => b.date === selectedDate)
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
            const blockCount = getBlockCount(dateStr);
            const dayOfWeek = d.getDay();
            const isSelected = dateStr === selectedDate;

            return (
              <div
                key={dateStr}
                onClick={() =>
                  setSelectedDate(dateStr === selectedDate ? null : dateStr)
                }
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
                <div className="flex items-center justify-center gap-0.5">
                  {count > 0 && (
                    <span className="text-[10px] sm:text-xs text-green-600 font-bold">
                      {count}件
                    </span>
                  )}
                  {blockCount > 0 && (
                    <span className="text-[10px] text-red-400 font-bold">
                      B
                    </span>
                  )}
                </div>
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
        火曜・水曜の「定休日」→臨時営業に切替可。営業日の「休業設定」→臨時休業に切替可。日付クリックでタイムライン表示。B
        = ブロックあり。
      </p>

      {selectedDate && (
        <TimelineView
          date={selectedDate}
          reservations={selectedDateReservations}
          allReservations={allReservations}
          blocks={selectedDateBlocks}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}

/* ===== Timeline View ===== */

function TimelineView({
  date,
  reservations,
  allReservations,
  blocks,
  onUpdate,
}: {
  date: string;
  reservations: Reservation[];
  allReservations: Reservation[];
  blocks: Block[];
  onUpdate: () => void;
}) {
  const [popupReservation, setPopupReservation] =
    useState<Reservation | null>(null);

  const d = parseDate(date);
  const isWknd = isWeekend(d);

  const timelineStartMin = isWknd
    ? timeToMinutes("09:00")
    : timeToMinutes("11:30");
  const timelineEndMin = isWknd
    ? timeToMinutes("17:00")
    : timeToMinutes("15:00");
  const totalMinutes = timelineEndMin - timelineStartMin;

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

  const gridLines: number[] = [];
  for (let m = timelineStartMin; m <= timelineEndMin; m += 30) {
    gridLines.push(((m - timelineStartMin) / totalMinutes) * 100);
  }

  const confirmedReservations = reservations.filter(
    (r) => r.status === "confirmed"
  );

  function getBlockPctStyle(startTime: string, endTime: string) {
    const startMin = Math.max(timeToMinutes(startTime), timelineStartMin);
    const endMin = Math.min(timeToMinutes(endTime), timelineEndMin);
    if (startMin >= endMin) return null;
    const leftPct = ((startMin - timelineStartMin) / totalMinutes) * 100;
    const widthPct = ((endMin - startMin) / totalMinutes) * 100;
    return { left: `${leftPct}%`, width: `${widthPct}%` };
  }

  function getReservationBlockStyle(r: Reservation) {
    const startMin = timeToMinutes(r.start_time);
    const endMin = timeToMinutes(r.end_time);
    const leftPct = ((startMin - timelineStartMin) / totalMinutes) * 100;
    const widthPct = ((endMin - startMin) / totalMinutes) * 100;
    return { left: `${leftPct}%`, width: `${widthPct}%` };
  }

  function getRowsForReservation(r: Reservation): number[] {
    const physicalSeats = r.uses_seats?.length ? r.uses_seats : [r.seat_id];
    if (physicalSeats.length > 1) {
      const rows: number[] = [];
      for (const psId of physicalSeats) {
        const ts = TIMELINE_SEATS.find((s) => s.id === psId);
        if (ts) rows.push(ts.rowIndex);
      }
      return rows.sort((a, b) => a - b);
    }
    const seat = TIMELINE_SEATS.find((s) => s.id === r.seat_id);
    return seat ? [seat.rowIndex] : [];
  }

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
          {/* 時間ラベル上 */}
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

          {/* グリッド + ブロック + 予約 */}
          <div className="relative">
            {TIMELINE_SEATS.map((seat, rowIdx) => (
              <div
                key={seat.id}
                className="flex items-stretch"
                style={{ height: ROW_HEIGHT }}
              >
                <div
                  className="shrink-0 flex items-center justify-end pr-3 text-xs font-medium text-warm-700"
                  style={{ width: SEAT_LABEL_WIDTH }}
                >
                  {seat.label}
                </div>
                <div className="relative flex-1 border-b border-warm-100">
                  {gridLines.map((pct, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-warm-100"
                      style={{ left: `${pct}%` }}
                    />
                  ))}
                  <div className="absolute inset-0 bg-warm-50 opacity-30" />

                  {/* 予約ブロック（赤系 overlay） */}
                  {blocks.map((block) => {
                    const isFullBlock = !block.seat_id;
                    const isSeatBlock = block.seat_id === seat.id;
                    if (!isFullBlock && !isSeatBlock) return null;
                    const style = getBlockPctStyle(
                      block.start_time,
                      block.end_time
                    );
                    if (!style) return null;
                    return (
                      <div
                        key={`block-${block.id}-${rowIdx}`}
                        className="absolute bg-red-300 opacity-40"
                        style={{
                          ...style,
                          top: 2,
                          bottom: 2,
                          zIndex: 5,
                          backgroundImage:
                            "repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(255,255,255,0.4) 4px,rgba(255,255,255,0.4) 8px)",
                        }}
                      />
                    );
                  })}

                  {/* 予約ブロック */}
                  {confirmedReservations
                    .filter((r) => getRowsForReservation(r).includes(rowIdx))
                    .map((r, blockIdx) => {
                      const style = getReservationBlockStyle(r);
                      const rows = getRowsForReservation(r);
                      const isCombined = rows.length > 1;
                      const isTop = isCombined && rowIdx === rows[0];
                      const isBottom =
                        isCombined && rowIdx === rows[rows.length - 1];
                      const isMoved = r.auto_moved;

                      return (
                        <div
                          key={r.id}
                          onClick={() => setPopupReservation(r)}
                          className={`absolute cursor-pointer transition-opacity hover:opacity-90 ${
                            isMoved
                              ? "bg-amber-500"
                              : BLOCK_COLORS[blockIdx % BLOCK_COLORS.length]
                          } text-white shadow-sm ${
                            isCombined
                              ? isTop
                                ? "rounded-t-md border-b-0"
                                : isBottom
                                ? "rounded-b-md border-t-0"
                                : ""
                              : "rounded-md"
                          }`}
                          style={{
                            ...style,
                            top: isCombined && !isTop ? 0 : 4,
                            bottom: isCombined && !isBottom ? 0 : 4,
                            zIndex: 10,
                          }}
                        >
                          {(!isCombined || isTop) && (
                            <div className="px-1.5 py-0.5 truncate">
                              <span className="text-xs font-bold">
                                {r.name}
                              </span>
                              <span className="text-[10px] ml-1 opacity-80">
                                {r.guests}名
                              </span>
                              {isMoved && (
                                <span className="text-[10px] ml-0.5 opacity-80">
                                  移
                                </span>
                              )}
                            </div>
                          )}
                          {isCombined && isBottom && (
                            <div className="px-1.5 py-0.5">
                              <span className="text-[10px] opacity-70">
                                結合席
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>

          {/* 時間ラベル下 */}
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

        {confirmedReservations.length === 0 && blocks.length === 0 && (
          <p className="text-center text-warm-400 text-sm py-4">
            この日の予約・ブロックはありません
          </p>
        )}
      </div>

      {/* ブロック設定パネル */}
      <BlockSettingsPanel
        date={date}
        blocks={blocks}
        reservations={confirmedReservations}
        onUpdate={onUpdate}
      />

      {/* 予約詳細ポップアップ */}
      {popupReservation && (
        <ReservationPopup
          reservation={popupReservation}
          allReservations={allReservations}
          onClose={() => setPopupReservation(null)}
          onUpdate={() => {
            setPopupReservation(null);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}

/* ===== Block Settings Panel ===== */

function BlockSettingsPanel({
  date,
  blocks,
  reservations,
  onUpdate,
}: {
  date: string;
  blocks: Block[];
  reservations: Reservation[];
  onUpdate: () => void;
}) {
  const [blockType, setBlockType] = useState<"all" | "seat">("all");
  const [blockSeatId, setBlockSeatId] = useState("counter");
  const [blockStartTime, setBlockStartTime] = useState("11:30");
  const [blockEndTime, setBlockEndTime] = useState("15:00");
  const [blockWarning, setBlockWarning] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 既存予約との重複チェック
  function checkOverlap(
    seatId: string | null,
    startTime: string,
    endTime: string
  ): boolean {
    return reservations.some((r) => {
      if (!doTimesOverlap(startTime, endTime, r.start_time, r.end_time))
        return false;
      if (!seatId) return true; // 全席ブロックは全予約と干渉
      const physicalSeats = r.uses_seats?.length ? r.uses_seats : [r.seat_id];
      return physicalSeats.includes(seatId);
    });
  }

  function handleCheckWarning() {
    const seatId = blockType === "seat" ? blockSeatId : null;
    if (checkOverlap(seatId, blockStartTime, blockEndTime)) {
      setBlockWarning("この時間帯にすでに予約があります");
    } else {
      setBlockWarning("");
    }
  }

  // フォーム値が変わったら警告を再チェック
  useEffect(() => {
    handleCheckWarning();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockType, blockSeatId, blockStartTime, blockEndTime, reservations]);

  async function handleAddBlock(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/reservation-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          seat_id: blockType === "seat" ? blockSeatId : null,
          start_time: blockStartTime,
          end_time: blockEndTime,
        }),
      });
      if (res.ok) {
        await onUpdate();
      } else {
        const err = await res.json();
        alert(err.error || "ブロックの追加に失敗しました");
      }
    } catch {
      alert("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteBlock(blockId: string) {
    try {
      const res = await fetch(`/api/reservation-blocks/${blockId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await onUpdate();
      }
    } catch {
      alert("通信エラーが発生しました");
    }
  }

  return (
    <div className="mt-4 bg-white rounded-xl shadow-sm p-4">
      <h4 className="text-sm font-bold text-warm-800 mb-3">
        予約ブロック設定
      </h4>

      {/* 既存ブロック一覧 */}
      {blocks.length > 0 && (
        <div className="space-y-2 mb-4">
          {blocks.map((block) => (
            <div
              key={block.id}
              className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium text-red-700">
                  {block.seat_id
                    ? TIMELINE_SEATS.find((s) => s.id === block.seat_id)
                        ?.label || block.seat_id
                    : "全席"}
                </span>
                <span className="text-red-500 ml-2">
                  {block.start_time}〜{block.end_time}
                </span>
              </div>
              <button
                onClick={() => handleDeleteBlock(block.id)}
                className="text-red-400 hover:text-red-600 text-xs px-2 py-1"
              >
                解除
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ブロック追加フォーム */}
      <form
        onSubmit={handleAddBlock}
        className="flex flex-wrap items-end gap-2"
      >
        <div>
          <label className="block text-xs text-warm-500 mb-1">種別</label>
          <select
            value={blockType}
            onChange={(e) => setBlockType(e.target.value as "all" | "seat")}
            className="border border-warm-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-green-500"
          >
            <option value="all">全席一括</option>
            <option value="seat">席別</option>
          </select>
        </div>
        {blockType === "seat" && (
          <div>
            <label className="block text-xs text-warm-500 mb-1">席</label>
            <select
              value={blockSeatId}
              onChange={(e) => setBlockSeatId(e.target.value)}
              className="border border-warm-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-green-500"
            >
              {TIMELINE_SEATS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-warm-500 mb-1">開始</label>
          <input
            type="time"
            value={blockStartTime}
            onChange={(e) => setBlockStartTime(e.target.value)}
            className="border border-warm-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-green-500"
          />
        </div>
        <div>
          <label className="block text-xs text-warm-500 mb-1">終了</label>
          <input
            type="time"
            value={blockEndTime}
            onChange={(e) => setBlockEndTime(e.target.value)}
            className="border border-warm-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-green-500"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
        >
          {submitting ? "追加中..." : "ブロック追加"}
        </button>
      </form>
      {blockWarning && (
        <p className="text-amber-600 text-xs mt-2">{blockWarning}</p>
      )}
    </div>
  );
}

/* ===== Reservation Popup (with seat change & auto_moved) ===== */

function ReservationPopup({
  reservation: r,
  allReservations,
  onClose,
  onUpdate,
}: {
  reservation: Reservation;
  allReservations: Reservation[];
  onClose: () => void;
  onUpdate: () => void;
}) {
  const d = parseDate(r.date);
  const [showSeatChange, setShowSeatChange] = useState(false);
  const [changingTo, setChangingTo] = useState<string | null>(null);
  const [seatChangeError, setSeatChangeError] = useState("");

  // 席変更候補の計算
  const otherConfirmed = allReservations.filter(
    (res) =>
      res.id !== r.id &&
      res.date === r.date &&
      res.status === "confirmed"
  );

  function isSeatAvailableForChange(seatId: string): boolean {
    const seat = SEATS.find((s) => s.id === seatId);
    if (!seat) return false;
    if (seat.maxGuests < r.guests) return false;

    for (const other of otherConfirmed) {
      if (
        !doTimesOverlap(r.start_time, r.end_time, other.start_time, other.end_time)
      )
        continue;
      const otherPhysical = other.uses_seats?.length
        ? other.uses_seats
        : [other.seat_id];
      if (seat.usesSeats.some((ps) => otherPhysical.includes(ps))) {
        return false;
      }
    }
    return true;
  }

  const candidateSeats = SEATS.filter(
    (s) => s.maxGuests >= r.guests
  ).map((s) => ({
    ...s,
    available: isSeatAvailableForChange(s.id),
    isCurrent: s.id === r.seat_id,
  }));

  async function handleSeatChange(seatId: string) {
    setChangingTo(seatId);
    setSeatChangeError("");
    try {
      const res = await fetch(`/api/reservations/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seat_id: seatId }),
      });
      if (res.ok) {
        onUpdate();
      } else {
        const err = await res.json();
        setSeatChangeError(err.error || "席変更に失敗しました");
      }
    } catch {
      setSeatChangeError("通信エラーが発生しました");
    } finally {
      setChangingTo(null);
    }
  }

  const originalSeatLabel = r.original_seat_id
    ? SEATS.find((s) => s.id === r.original_seat_id)?.label || r.original_seat_id
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto"
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
          <div className="flex justify-between items-center">
            <span className="text-warm-500">お名前</span>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-warm-800">{r.name}</span>
              {r.auto_moved && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                  自動移動
                </span>
              )}
            </div>
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
          <div className="flex justify-between items-center">
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
          {r.auto_moved && originalSeatLabel && (
            <div className="flex justify-between">
              <span className="text-warm-500">移動前の席</span>
              <span className="text-amber-600">{originalSeatLabel}</span>
            </div>
          )}
          <hr className="border-warm-200" />
          <div className="flex justify-between">
            <span className="text-warm-500">電話番号</span>
            <span className="text-warm-800">{r.phone}</span>
          </div>
          {r.note && (
            <div>
              <span className="text-warm-500">備考</span>
              <p className="text-warm-800 mt-1 bg-warm-50 rounded-lg p-2">
                {r.note}
              </p>
            </div>
          )}
        </div>

        {/* 席変更セクション */}
        {r.status === "confirmed" && (
          <div className="mt-4">
            {!showSeatChange ? (
              <button
                onClick={() => setShowSeatChange(true)}
                className="w-full bg-warm-100 hover:bg-warm-200 text-warm-700 font-medium py-2 rounded-lg transition-colors text-sm"
              >
                席を変更
              </button>
            ) : (
              <div className="border border-warm-200 rounded-lg p-3">
                <p className="text-xs text-warm-500 mb-2 font-medium">
                  変更先の席を選択
                </p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {candidateSeats.map((s) => (
                    <button
                      key={s.id}
                      disabled={!s.available || s.isCurrent || changingTo !== null}
                      onClick={() => handleSeatChange(s.id)}
                      className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                        s.isCurrent
                          ? "bg-green-50 border border-green-300 text-green-700"
                          : s.available
                          ? "bg-warm-50 hover:bg-warm-100 text-warm-800"
                          : "bg-warm-50 text-warm-300 cursor-not-allowed"
                      }`}
                    >
                      <span className="font-medium">{s.label}</span>
                      <span className="text-xs ml-1.5 text-warm-400">
                        最大{s.maxGuests}名
                      </span>
                      {s.isCurrent && (
                        <span className="text-xs ml-1 text-green-600">
                          (現在)
                        </span>
                      )}
                      {!s.available && !s.isCurrent && (
                        <span className="text-xs ml-1 text-warm-300">
                          (使用中)
                        </span>
                      )}
                      {changingTo === s.id && (
                        <span className="text-xs ml-1">変更中...</span>
                      )}
                    </button>
                  ))}
                </div>
                {seatChangeError && (
                  <p className="text-red-500 text-xs mt-2">{seatChangeError}</p>
                )}
                <button
                  onClick={() => {
                    setShowSeatChange(false);
                    setSeatChangeError("");
                  }}
                  className="mt-2 text-xs text-warm-500 hover:text-warm-700"
                >
                  キャンセル
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full bg-warm-100 hover:bg-warm-200 text-warm-700 font-medium py-2 rounded-lg transition-colors text-sm"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}

/* ===== Reservations Tab ===== */

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
  const [popupReservation, setPopupReservation] = useState<Reservation | null>(
    null
  );

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
              onClick={() => setPopupReservation(r)}
            />
          ))}
        </div>
      )}

      {popupReservation && (
        <ReservationPopup
          reservation={popupReservation}
          allReservations={reservations}
          onClose={() => setPopupReservation(null)}
          onUpdate={() => {
            setPopupReservation(null);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}

/* ===== Settings Tab ===== */

function SettingsTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [maxGuestsPerSlot, setMaxGuestsPerSlot] = useState(10);
  const [maxGuestsPerGroup, setMaxGuestsPerGroup] = useState(8);
  const [morningLastOrder, setMorningLastOrder] = useState("10:00");
  const [lunchLastOrder, setLunchLastOrder] = useState("13:45");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setMaxGuestsPerSlot(data.max_guests_per_slot);
          setMaxGuestsPerGroup(data.max_guests_per_group);
          if (data.morning_last_order) setMorningLastOrder(data.morning_last_order);
          if (data.lunch_last_order) setLunchLastOrder(data.lunch_last_order);
        }
      } catch {
        // ignore
      } finally {
        setSettingsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  async function handleSettingsSave(e: React.FormEvent) {
    e.preventDefault();
    setSettingsMessage("");
    setSettingsError("");

    if (maxGuestsPerSlot < 1 || maxGuestsPerGroup < 1) {
      setSettingsError("1以上の値を入力してください");
      return;
    }

    setSettingsSubmitting(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_guests_per_slot: maxGuestsPerSlot,
          max_guests_per_group: maxGuestsPerGroup,
          morning_last_order: morningLastOrder,
          lunch_last_order: lunchLastOrder,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSettingsMessage("設定を保存しました");
      } else {
        setSettingsError(data.error || "設定の保存に失敗しました");
      }
    } catch {
      setSettingsError("通信エラーが発生しました");
    } finally {
      setSettingsSubmitting(false);
    }
  }

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

      <div className="bg-white rounded-xl shadow-sm p-6 max-w-md mb-6">
        <h3 className="text-lg font-bold text-warm-800 mb-4">予約設定</h3>
        {settingsLoading ? (
          <p className="text-warm-500 text-sm">読み込み中...</p>
        ) : (
          <form onSubmit={handleSettingsSave} className="space-y-4">
            <div>
              <label className="block text-sm text-warm-600 mb-1">
                同時スタート人数上限
              </label>
              <input
                type="number"
                min={1}
                value={maxGuestsPerSlot}
                onChange={(e) => setMaxGuestsPerSlot(Number(e.target.value))}
                className="w-full border border-warm-300 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
              />
              <p className="text-xs text-warm-400 mt-1">
                同じ開始時刻に受け入れる合計人数の上限
              </p>
            </div>
            <div>
              <label className="block text-sm text-warm-600 mb-1">
                1団体の人数上限
              </label>
              <input
                type="number"
                min={1}
                value={maxGuestsPerGroup}
                onChange={(e) => setMaxGuestsPerGroup(Number(e.target.value))}
                className="w-full border border-warm-300 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
              />
              <p className="text-xs text-warm-400 mt-1">
                1回の予約で指定できる最大人数
              </p>
            </div>
            <div>
              <label className="block text-sm text-warm-600 mb-1">
                モーニング ラストオーダー時刻
              </label>
              <input
                type="time"
                value={morningLastOrder}
                onChange={(e) => setMorningLastOrder(e.target.value)}
                className="w-full border border-warm-300 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
              />
              <p className="text-xs text-warm-400 mt-1">
                この時刻が最後に選べる開始時刻になります（土日の朝食）
              </p>
            </div>
            <div>
              <label className="block text-sm text-warm-600 mb-1">
                ランチ ラストオーダー時刻
              </label>
              <input
                type="time"
                value={lunchLastOrder}
                onChange={(e) => setLunchLastOrder(e.target.value)}
                className="w-full border border-warm-300 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
              />
              <p className="text-xs text-warm-400 mt-1">
                この時刻が最後に選べる開始時刻になります（ランチ）
              </p>
            </div>

            {settingsError && (
              <p className="text-red-500 text-sm">{settingsError}</p>
            )}
            {settingsMessage && (
              <p className="text-green-600 text-sm">{settingsMessage}</p>
            )}

            <button
              type="submit"
              disabled={settingsSubmitting}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium py-2 rounded-lg transition-colors"
            >
              {settingsSubmitting ? "保存中..." : "設定を保存"}
            </button>
          </form>
        )}
      </div>

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

/* ===== Reservation Card ===== */

function ReservationCard({
  reservation: r,
  showActions,
  onCancel,
  onRestore,
  onClick,
}: {
  reservation: Reservation;
  showActions?: boolean;
  onCancel?: () => void;
  onRestore?: () => void;
  onClick?: () => void;
}) {
  const d = parseDate(r.date);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${
        r.status === "cancelled"
          ? "border-warm-300 opacity-60"
          : "border-green-500"
      } ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
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
            {r.auto_moved && (
              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                自動移動
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
          <p className="text-sm text-warm-500">席: {r.seat_label}</p>
          <p className="text-sm text-warm-500">TEL: {r.phone}</p>
          {r.note && (
            <p className="text-sm text-warm-400">備考: {r.note}</p>
          )}
        </div>
        {showActions && (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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
