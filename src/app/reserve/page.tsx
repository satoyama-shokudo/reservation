"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  formatDate,
  parseDate,
  isRegularHoliday,
  isReservationClosed,
  getDayLabel,
  getMaxDate,
} from "@/lib/slots";

interface TimeAvailability {
  time: string;
  availableCount: number;
  seats: {
    id: string;
    label: string;
    maxGuests: number;
    type: string;
    usesSeats: string[];
  }[];
}

interface SlotAvailability {
  id: string;
  label: string;
  startHour: string;
  endHour: string;
  times: TimeAvailability[];
}

interface SelectedSeat {
  id: string;
  label: string;
  maxGuests: number;
  type: string;
  usesSeats: string[];
}

const STEPS = ["日時を選ぶ", "お席を選ぶ", "お客様情報", "確認"];

export default function ReservePage() {
  const [step, setStep] = useState(0);

  // Step 1: 日時選択
  const [selectedDate, setSelectedDate] = useState("");
  const [guests, setGuests] = useState(2);
  const [availability, setAvailability] = useState<SlotAvailability[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotAvailability | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [specialOpenDays, setSpecialOpenDays] = useState<string[]>([]);
  const [specialClosedDays, setSpecialClosedDays] = useState<string[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState("");

  // Step 2: 席選択
  const [availableSeats, setAvailableSeats] = useState<SelectedSeat[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<SelectedSeat | null>(null);

  // Step 3: お客様情報
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  // Step 4: 確認・完了
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  // 臨時営業日・臨時休業日を取得
  useEffect(() => {
    fetch("/api/special-open-days")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSpecialOpenDays(data.map((d: { date: string }) => d.date));
        }
      })
      .catch(() => {});
    fetch("/api/special-closed-days")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSpecialClosedDays(data.map((d: { date: string }) => d.date));
        }
      })
      .catch(() => {});
  }, []);

  // 日付・人数が変わったら空席を取得
  const fetchAvailability = useCallback(async () => {
    if (!selectedDate) return;
    setLoadingAvailability(true);
    setAvailabilityMessage("");
    try {
      const res = await fetch(
        `/api/availability?date=${selectedDate}&guests=${guests}`
      );
      const data = await res.json();
      setAvailability(data.slots || []);
      if (data.error && (!data.slots || data.slots.length === 0)) {
        setAvailabilityMessage(data.error);
      }
    } catch {
      setAvailability([]);
    } finally {
      setLoadingAvailability(false);
    }
  }, [selectedDate, guests]);

  useEffect(() => {
    setSelectedSlot(null);
    setSelectedTime("");
    fetchAvailability();
  }, [fetchAvailability]);

  // 日付が選択可能か判定
  function isDateSelectable(dateStr: string): boolean {
    const date = parseDate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const max = getMaxDate();
    if (date < today || date > max) return false;
    if (isRegularHoliday(date) && !specialOpenDays.includes(dateStr)) return false;
    if (specialClosedDays.includes(dateStr)) return false;
    if (isReservationClosed(dateStr)) return false;
    return true;
  }

  // カレンダー生成
  function generateCalendarDays(yearMonth: string) {
    const [y, m] = yearMonth.split("-").map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0);
    const days: (string | null)[] = [];

    // 先頭の空白
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push(dateStr);
    }
    return days;
  }

  const today = new Date();
  const [calendarMonth, setCalendarMonth] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  );

  function handleTimeSelect(slot: SlotAvailability, time: string) {
    setSelectedSlot(slot);
    setSelectedTime(time);
    const timeData = slot.times.find((t) => t.time === time);
    setAvailableSeats(timeData?.seats || []);
    setSelectedSeat(null);
  }

  function handleSeatSelect(seat: SelectedSeat) {
    setSelectedSeat(seat);
  }

  // 終了時刻の計算
  function calcEndTime(startTime: string): string {
    const [h, m] = startTime.split(":").map(Number);
    const total = h * 60 + m + 90;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  async function handleSubmit() {
    if (!selectedDate || !selectedSlot || !selectedTime || !selectedSeat || !name || !phone) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          slot: selectedSlot.id,
          slot_label: selectedSlot.label,
          start_time: selectedTime,
          end_time: calcEndTime(selectedTime),
          guests,
          seat_id: selectedSeat.id,
          seat_label: selectedSeat.label,
          seat_type: selectedSeat.type,
          uses_seats: selectedSeat.usesSeats,
          name,
          phone,
          email: email || null,
          note: note || null,
        }),
      });
      if (res.ok) {
        setCompleted(true);
      } else {
        const err = await res.json();
        alert(err.error || "予約に失敗しました");
      }
    } catch {
      alert("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-warm-50">
        <Header />
        <div className="max-w-lg mx-auto px-4 py-12 text-center">
          <div className="bg-white rounded-2xl shadow-md p-8">
            <div className="text-4xl mb-4">🎉</div>
            <h2
              className="text-2xl font-bold text-warm-800 mb-4"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              ご予約ありがとうございます
            </h2>
            <div className="text-left bg-warm-50 rounded-lg p-4 mb-6 space-y-2 text-sm">
              <p>
                <span className="text-warm-500">日付：</span>
                {selectedDate} ({getDayLabel(parseDate(selectedDate))})
              </p>
              <p>
                <span className="text-warm-500">時間帯：</span>
                {selectedSlot?.label}
              </p>
              <p>
                <span className="text-warm-500">時間：</span>
                {selectedTime}〜{calcEndTime(selectedTime)}
              </p>
              <p>
                <span className="text-warm-500">人数：</span>
                {guests}名
              </p>
              <p>
                <span className="text-warm-500">お席：</span>
                {selectedSeat?.label}
              </p>
              <p>
                <span className="text-warm-500">お名前：</span>
                {name}
              </p>
            </div>
            <p className="text-warm-600 text-sm mb-6">
              お気をつけてお越しくださいませ。
              <br />
              ご不明な点がございましたらお電話ください。
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-green-600 hover:text-green-700 underline text-sm"
            >
              新しい予約をする
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50">
      <Header />
      {/* ステップ表示 */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  i <= step
                    ? "bg-green-600 text-white"
                    : "bg-warm-200 text-warm-500"
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-xs hidden sm:inline ${
                  i <= step ? "text-green-700 font-bold" : "text-warm-400"
                }`}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 ${
                    i < step ? "bg-green-600" : "bg-warm-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: 日時を選ぶ */}
        {step === 0 && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2
              className="text-xl font-bold text-warm-800 mb-6"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              日時を選ぶ
            </h2>

            {/* 人数選択 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-warm-700 mb-2">
                人数
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => setGuests(n)}
                    className={`w-12 h-12 rounded-lg font-bold transition-colors ${
                      guests === n
                        ? "bg-green-600 text-white"
                        : "bg-warm-100 text-warm-700 hover:bg-warm-200"
                    }`}
                  >
                    {n}名
                  </button>
                ))}
              </div>
            </div>

            {/* カレンダー */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-warm-700 mb-2">
                日付
              </label>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => {
                    const [y, m] = calendarMonth.split("-").map(Number);
                    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
                    setCalendarMonth(prev);
                  }}
                  className="text-warm-600 hover:text-warm-800 px-2 py-1"
                >
                  ◀
                </button>
                <span className="font-bold text-warm-800">
                  {calendarMonth.replace("-", "年")}月
                </span>
                <button
                  onClick={() => {
                    const [y, m] = calendarMonth.split("-").map(Number);
                    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
                    setCalendarMonth(next);
                  }}
                  className="text-warm-600 hover:text-warm-800 px-2 py-1"
                >
                  ▶
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
                {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
                  <div key={d} className="text-warm-500 font-medium py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {generateCalendarDays(calendarMonth).map((dateStr, i) => {
                  if (!dateStr) {
                    return <div key={`empty-${i}`} />;
                  }
                  const d = parseDate(dateStr);
                  const selectable = isDateSelectable(dateStr);
                  const isSelected = dateStr === selectedDate;
                  const isHoliday = isRegularHoliday(d);
                  const isSpecial = specialOpenDays.includes(dateStr);
                  const isClosed = specialClosedDays.includes(dateStr);
                  const dayNum = d.getDate();
                  const dayOfWeek = d.getDay();

                  return (
                    <button
                      key={dateStr}
                      disabled={!selectable}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`relative py-2 rounded-lg text-sm transition-colors ${
                        isSelected
                          ? "bg-green-600 text-white font-bold"
                          : selectable
                          ? "hover:bg-warm-100 text-warm-800"
                          : "text-warm-300 cursor-not-allowed"
                      } ${
                        dayOfWeek === 0
                          ? "text-red-400"
                          : dayOfWeek === 6
                          ? "text-blue-400"
                          : ""
                      } ${isSelected ? "!text-white" : ""}`}
                    >
                      {dayNum}
                      {isHoliday && !isSpecial && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] text-warm-300">
                          休
                        </span>
                      )}
                      {isSpecial && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] text-green-500">
                          営
                        </span>
                      )}
                      {isClosed && (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[8px] text-red-400">
                          休
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 時間帯・開始時刻 */}
            {selectedDate && (
              <div>
                {loadingAvailability ? (
                  <p className="text-center text-warm-500 py-4">読み込み中...</p>
                ) : availability.length === 0 ? (
                  <p className="text-center text-warm-500 py-4">
                    {availabilityMessage || "この日はご予約いただけません"}
                  </p>
                ) : (
                  availability.map((slot) => (
                    <div key={slot.id} className="mb-6">
                      <h3 className="text-sm font-bold text-warm-700 mb-2">
                        {slot.label}（{slot.startHour}〜{slot.endHour}）
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {slot.times.map((t) => {
                          const isAvailable = t.availableCount > 0;
                          const isTimeSelected =
                            selectedSlot?.id === slot.id &&
                            selectedTime === t.time;

                          return (
                            <button
                              key={t.time}
                              disabled={!isAvailable}
                              onClick={() => handleTimeSelect(slot, t.time)}
                              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                                isTimeSelected
                                  ? "bg-green-600 text-white font-bold"
                                  : isAvailable
                                  ? "bg-warm-100 hover:bg-warm-200 text-warm-800"
                                  : "bg-warm-100 text-warm-300 cursor-not-allowed"
                              }`}
                            >
                              <div>{t.time}</div>
                              <div className="text-xs mt-0.5">
                                {isAvailable ? (
                                  <span className={isTimeSelected ? "text-green-100" : "text-green-600"}>
                                    残{t.availableCount}席
                                  </span>
                                ) : (
                                  <span className="text-warm-300">満席</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {selectedTime && (
              <div className="mt-6 text-right">
                <button
                  onClick={() => setStep(1)}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                >
                  次へ
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: お席を選ぶ */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2
              className="text-xl font-bold text-warm-800 mb-2"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              お席を選ぶ
            </h2>
            <p className="text-sm text-warm-500 mb-6">
              {selectedDate} ({getDayLabel(parseDate(selectedDate))}) {selectedSlot?.label}{" "}
              {selectedTime}〜{calcEndTime(selectedTime)} / {guests}名
            </p>

            <div className="space-y-3">
              {availableSeats.map((seat) => (
                <button
                  key={seat.id}
                  onClick={() => handleSeatSelect(seat)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    selectedSeat?.id === seat.id
                      ? "border-green-600 bg-green-50"
                      : "border-warm-200 hover:border-warm-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-warm-800">
                        {seat.label}
                      </span>
                      <span className="text-sm text-warm-500 ml-2">
                        最大{seat.maxGuests}名
                      </span>
                    </div>
                    {selectedSeat?.id === seat.id && (
                      <span className="text-green-600 font-bold">✓</span>
                    )}
                  </div>
                  {seat.type === "combined" && (
                    <p className="text-xs text-warm-400 mt-1">
                      ※2名席を結合してご利用いただきます
                    </p>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(0)}
                className="text-warm-600 hover:text-warm-800 py-2 px-4"
              >
                ← 戻る
              </button>
              <button
                onClick={() => selectedSeat && setStep(2)}
                disabled={!selectedSeat}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                次へ
              </button>
            </div>
          </div>
        )}

        {/* Step 3: お客様情報 */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2
              className="text-xl font-bold text-warm-800 mb-6"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              お客様情報
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1">
                  お名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="山田 太郎"
                  className="w-full border border-warm-300 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1">
                  電話番号 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="090-1234-5678"
                  className="w-full border border-warm-300 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full border border-warm-300 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1">
                  備考
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="アレルギー、お子様連れなど"
                  rows={3}
                  className="w-full border border-warm-300 rounded-lg px-4 py-2 focus:outline-none focus:border-green-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="text-warm-600 hover:text-warm-800 py-2 px-4"
              >
                ← 戻る
              </button>
              <button
                onClick={() => name && phone && setStep(3)}
                disabled={!name || !phone}
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
              >
                確認へ
              </button>
            </div>
          </div>
        )}

        {/* Step 4: 確認 */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <h2
              className="text-xl font-bold text-warm-800 mb-6"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              ご予約内容の確認
            </h2>

            <div className="bg-warm-50 rounded-lg p-4 space-y-3 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-warm-500">日付</span>
                <span className="font-medium text-warm-800">
                  {selectedDate} ({getDayLabel(parseDate(selectedDate))})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-warm-500">時間帯</span>
                <span className="font-medium text-warm-800">
                  {selectedSlot?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-warm-500">時間</span>
                <span className="font-medium text-warm-800">
                  {selectedTime}〜{calcEndTime(selectedTime)}（90分）
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-warm-500">人数</span>
                <span className="font-medium text-warm-800">{guests}名</span>
              </div>
              <div className="flex justify-between">
                <span className="text-warm-500">お席</span>
                <span className="font-medium text-warm-800">
                  {selectedSeat?.label}
                </span>
              </div>
              <hr className="border-warm-200" />
              <div className="flex justify-between">
                <span className="text-warm-500">お名前</span>
                <span className="font-medium text-warm-800">{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-warm-500">電話番号</span>
                <span className="font-medium text-warm-800">{phone}</span>
              </div>
              {email && (
                <div className="flex justify-between">
                  <span className="text-warm-500">メール</span>
                  <span className="font-medium text-warm-800">{email}</span>
                </div>
              )}
              {note && (
                <div className="flex justify-between">
                  <span className="text-warm-500">備考</span>
                  <span className="font-medium text-warm-800">{note}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="text-warm-600 hover:text-warm-800 py-2 px-4"
              >
                ← 戻る
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg transition-colors disabled:opacity-50"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {submitting ? "送信中..." : "予約を確定する"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
        <Image
          src="/logo.jpg"
          alt="さとやま食堂"
          width={40}
          height={40}
          className="rounded-full"
        />
        <h1
          className="text-lg font-bold text-warm-800"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          さとやま食堂 ご予約
        </h1>
      </div>
    </header>
  );
}
