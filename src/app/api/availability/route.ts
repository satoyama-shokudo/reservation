import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseDate, isRegularHoliday, isReservationClosed, getSlotsForDate, getStartTimes } from "@/lib/slots";
import { getAvailableSeats } from "@/lib/availability";
import type { Reservation } from "@/lib/availability";

// GET /api/availability?date=YYYY-MM-DD&guests=N
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");
  const guestsStr = searchParams.get("guests");

  if (!dateStr || !guestsStr) {
    return NextResponse.json({ error: "date と guests は必須です" }, { status: 400 });
  }

  const guests = parseInt(guestsStr, 10);
  if (isNaN(guests) || guests < 1 || guests > 6) {
    return NextResponse.json({ error: "guests は1〜6の範囲で指定してください" }, { status: 400 });
  }

  const date = parseDate(dateStr);

  // 予約受付締切チェック（前日22:00まで）
  if (isReservationClosed(dateStr)) {
    return NextResponse.json({ error: "予約受付は前日の22時までです", slots: [] }, { status: 200 });
  }

  // 定休日チェック（臨時営業日なら営業）
  if (isRegularHoliday(date)) {
    const { data: specialDays } = await supabase
      .from("special_open_days")
      .select("date")
      .eq("date", dateStr);

    if (!specialDays || specialDays.length === 0) {
      return NextResponse.json({ error: "定休日です", slots: [] }, { status: 200 });
    }
  }

  // その日の予約を取得
  const { data: reservations, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("date", dateStr);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const activeReservations = (reservations || []) as Reservation[];
  const slots = getSlotsForDate(date);

  const result = slots.map((slot) => {
    const startTimes = getStartTimes(slot);
    const timesWithAvailability = startTimes.map((time) => {
      const availableSeats = getAvailableSeats(guests, time, activeReservations);
      return {
        time,
        availableCount: availableSeats.length,
        seats: availableSeats.map((s) => ({
          id: s.id,
          label: s.label,
          maxGuests: s.maxGuests,
          type: s.type,
          usesSeats: s.usesSeats,
        })),
      };
    });

    return {
      id: slot.id,
      label: slot.label,
      startHour: slot.startHour,
      endHour: slot.endHour,
      times: timesWithAvailability,
    };
  });

  return NextResponse.json({ date: dateStr, guests, slots: result });
}
