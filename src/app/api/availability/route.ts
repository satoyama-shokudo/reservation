import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  parseDate,
  isRegularHoliday,
  isReservationClosed,
  getSlotsForDate,
  getStartTimes,
  timeToMinutes,
  getEndTime,
} from "@/lib/slots";
import { getAvailableSeats } from "@/lib/availability";
import type { Reservation } from "@/lib/availability";
import { getSeatTiers } from "@/lib/seats";
import type { ReservationBlock } from "@/lib/allocation";

// GET /api/availability?date=YYYY-MM-DD&guests=N
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date");
  const guestsStr = searchParams.get("guests");

  if (!dateStr || !guestsStr) {
    return NextResponse.json(
      { error: "date と guests は必須です" },
      { status: 400 }
    );
  }

  const guests = parseInt(guestsStr, 10);
  if (isNaN(guests) || guests < 1) {
    return NextResponse.json(
      { error: "人数が不正です" },
      { status: 400 }
    );
  }

  // 管理者設定を取得
  const { data: settings } = await supabase
    .from("admin_settings")
    .select("max_guests_per_slot, max_guests_per_group")
    .limit(1)
    .single();

  const maxGuestsPerSlot = settings?.max_guests_per_slot ?? 10;
  const maxGuestsPerGroup = settings?.max_guests_per_group ?? 8;

  // 団体人数上限チェック
  if (guests > maxGuestsPerGroup) {
    return NextResponse.json(
      {
        error: `ご予約は${maxGuestsPerGroup}名様までとなっております`,
        slots: [],
      },
      { status: 200 }
    );
  }

  const date = parseDate(dateStr);

  // 予約受付締切チェック
  if (isReservationClosed(dateStr)) {
    return NextResponse.json(
      { error: "予約受付は前日の22時までです", slots: [] },
      { status: 200 }
    );
  }

  // 臨時休業日チェック
  const { data: closedDays } = await supabase
    .from("special_closed_days")
    .select("date")
    .eq("date", dateStr);

  if (closedDays && closedDays.length > 0) {
    return NextResponse.json(
      { error: "臨時休業日です", slots: [] },
      { status: 200 }
    );
  }

  // 定休日チェック（臨時営業日なら営業）
  if (isRegularHoliday(date)) {
    const { data: specialDays } = await supabase
      .from("special_open_days")
      .select("date")
      .eq("date", dateStr);

    if (!specialDays || specialDays.length === 0) {
      return NextResponse.json(
        { error: "定休日です", slots: [] },
        { status: 200 }
      );
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

  // その日の予約ブロックを取得
  const { data: blocks } = await supabase
    .from("reservation_blocks")
    .select("*")
    .eq("date", dateStr);

  const activeReservations = (reservations || []).filter(
    (r: Reservation) => r.status === "confirmed"
  ) as Reservation[];
  const activeBlocks = (blocks || []) as ReservationBlock[];

  const slots = getSlotsForDate(date);

  const result = slots.map((slot) => {
    const startTimes = getStartTimes(slot);
    const timesWithAvailability = startTimes.map((time) => {
      const available = isTimeAvailable(
        time,
        guests,
        activeReservations,
        activeBlocks,
        maxGuestsPerSlot
      );
      return { time, available };
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

/** 指定時刻が予約可能かを判定（席詳細は返さない） */
function isTimeAvailable(
  startTime: string,
  guests: number,
  reservations: Reservation[],
  blocks: ReservationBlock[],
  maxGuestsPerSlot: number
): boolean {
  const endTime = getEndTime(startTime);
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  // 1. 全席ブロックチェック（seat_id=NULLのブロック）
  for (const block of blocks) {
    if (
      !block.seat_id &&
      startMin < timeToMinutes(block.end_time) &&
      timeToMinutes(block.start_time) < endMin
    ) {
      return false;
    }
  }

  // 2. 同時スタート人数上限チェック
  const sameStartGuests = reservations
    .filter((r) => r.start_time === startTime)
    .reduce((sum, r) => sum + r.guests, 0);
  if (sameStartGuests + guests > maxGuestsPerSlot) {
    return false;
  }

  // 3. 席の空き判定（ブロックされた席を除外）
  const availableSeats = getAvailableSeats(guests, startTime, reservations);
  const unblockedSeats = availableSeats.filter((seat) => {
    for (const block of blocks) {
      if (!block.seat_id) continue;
      if (
        seat.usesSeats.includes(block.seat_id) &&
        startMin < timeToMinutes(block.end_time) &&
        timeToMinutes(block.start_time) < endMin
      ) {
        return false;
      }
    }
    return true;
  });

  return unblockedSeats.length > 0;
}
