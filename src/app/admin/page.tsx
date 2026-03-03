"use client";

import { useState, useEffect, useCallback } from "react";
import {
  formatDate,
  parseDate,
  isRegularHoliday,
  getDayLabel,
} from "@/lib/slots";
import type { Reservation } from "@/lib/availability";

type Tab = "dashboard" | "calendar" | "reservations";
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
  const [loading, setLoading] = useState(true);

  const todayStr = formatDate(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [resReservations, resSpecial] = await Promise.all([
        fetch(`/api/reservations?from=2020-01-01&to=2099-12-31`),
        fetch("/api/special-open-days"),
      ]);
      const reservationsData = await resReservations.json();
      const specialData = await resSpecial.json();
      setReservations(Array.isArray(reservationsData) ? reservationsData : []);
      setSpecialOpenDays(
        Array.isArray(specialData)
          ? specialData.map((d: { date: string }) => d.date)
          : []
      );
    } catch {
      // ignore
    } finally {
      setLoading(false);
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
  onUpdate,
}: {
  reservations: Reservation[];
  specialOpenDays: string[];
  onUpdate: () => void;
}) {
  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );
  const [toggling, setToggling] = useState(false);

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

  async function toggleSpecialDay(dateStr: string) {
    setToggling(true);
    try {
      if (specialOpenDays.includes(dateStr)) {
        await fetch(`/api/special-open-days/${dateStr}`, { method: "DELETE" });
      } else {
        await fetch("/api/special-open-days", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: dateStr }),
        });
      }
      onUpdate();
    } finally {
      setToggling(false);
    }
  }

  return (
    <div>
      <h2
        className="text-xl font-bold text-warm-800 mb-6"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        カレンダー
      </h2>

      <div className="bg-white rounded-xl shadow-sm p-6">
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
            className="text-warm-600 hover:text-warm-800 px-3 py-1"
          >
            ◀ 前月
          </button>
          <span className="text-lg font-bold text-warm-800">
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
            className="text-warm-600 hover:text-warm-800 px-3 py-1"
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
            const count = getReservationCount(dateStr);
            const dayOfWeek = d.getDay();

            return (
              <div
                key={dateStr}
                className={`p-2 rounded-lg text-center min-h-[60px] ${
                  isHoliday && !isSpecial
                    ? "bg-warm-100"
                    : isSpecial
                    ? "bg-green-50 border border-green-300"
                    : "bg-white border border-warm-100"
                }`}
              >
                <div
                  className={`text-sm font-medium ${
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
                  <div className="text-xs text-green-600 font-bold">
                    {count}件
                  </div>
                )}
                {isHoliday && (
                  <button
                    onClick={() => toggleSpecialDay(dateStr)}
                    disabled={toggling}
                    className={`text-[10px] mt-1 px-1 py-0.5 rounded ${
                      isSpecial
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-warm-300 text-white hover:bg-warm-400"
                    }`}
                  >
                    {isSpecial ? "臨時営業" : "定休日"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-warm-400 mt-3">
        火曜・水曜の「定休日」ボタンを押すと臨時営業に切り替えられます
      </p>
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
