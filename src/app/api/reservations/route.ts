import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { notifyNewReservation } from "@/lib/notify";
import { allocateSeats } from "@/lib/allocation";
import { timeToMinutes } from "@/lib/slots";
import type { Reservation } from "@/lib/availability";
import type { ReservationBlock } from "@/lib/allocation";

// GET /api/reservations?date=YYYY-MM-DD or ?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase
    .from("reservations")
    .select("*")
    .order("date")
    .order("start_time");

  if (date) {
    query = query.eq("date", date);
  } else if (from && to) {
    query = query.gte("date", from).lte("date", to);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST /api/reservations
export async function POST(request: NextRequest) {
  const body = await request.json();

  const { date, slot, slot_label, start_time, end_time, guests, name, phone, email, note } = body;

  if (!date || !slot || !start_time || !end_time || !guests || !name || !phone) {
    return NextResponse.json(
      { error: "必須項目が不足しています" },
      { status: 400 }
    );
  }

  // 管理者設定を取得
  const { data: settings } = await supabase
    .from("admin_settings")
    .select("max_guests_per_slot, max_guests_per_group, morning_last_order, lunch_last_order")
    .limit(1)
    .single();

  const maxGuestsPerSlot = settings?.max_guests_per_slot ?? 10;
  const maxGuestsPerGroup = settings?.max_guests_per_group ?? 8;
  const morningLastOrder = settings?.morning_last_order ?? "10:00";
  const lunchLastOrder = settings?.lunch_last_order ?? "13:45";

  // ラストオーダーチェック
  const startMin = timeToMinutes(start_time);
  if (slot === "breakfast" && startMin > timeToMinutes(morningLastOrder)) {
    return NextResponse.json(
      { error: "モーニングのラストオーダー時刻を過ぎています" },
      { status: 400 }
    );
  }
  if (slot === "lunch" && startMin > timeToMinutes(lunchLastOrder)) {
    return NextResponse.json(
      { error: "ランチのラストオーダー時刻を過ぎています" },
      { status: 400 }
    );
  }

  // その日の全予約を取得
  const { data: reservations, error: resError } = await supabase
    .from("reservations")
    .select("*")
    .eq("date", date);

  if (resError) {
    return NextResponse.json({ error: resError.message }, { status: 500 });
  }

  const confirmedReservations = ((reservations || []) as Reservation[]).filter(
    (r) => r.status === "confirmed"
  );

  // その日の予約ブロックを取得
  const { data: blocks } = await supabase
    .from("reservation_blocks")
    .select("*")
    .eq("date", date);

  const activeBlocks = (blocks || []) as ReservationBlock[];

  // 配席アルゴリズムを実行
  const result = allocateSeats(
    date,
    start_time,
    guests,
    { maxGuestsPerSlot, maxGuestsPerGroup },
    confirmedReservations,
    activeBlocks
  );

  if (!result.success || !result.newSeat) {
    return NextResponse.json(
      { error: result.error || "席を割り当てできませんでした" },
      { status: 409 }
    );
  }

  const seat = result.newSeat;

  // 既存予約の自動移動を先に実行
  for (const move of result.moves) {
    const { error: moveError } = await supabase
      .from("reservations")
      .update({
        seat_id: move.toSeat.id,
        seat_label: move.toSeat.label,
        seat_type: move.toSeat.type,
        uses_seats: move.toSeat.usesSeats,
        auto_moved: true,
        original_seat_id: move.fromSeatId,
      })
      .eq("id", move.reservationId);

    if (moveError) {
      return NextResponse.json(
        { error: "既存予約の席移動に失敗しました" },
        { status: 500 }
      );
    }
  }

  // 新規予約を作成
  const { data: newReservation, error: insertError } = await supabase
    .from("reservations")
    .insert({
      date,
      slot,
      slot_label: slot_label || slot,
      start_time,
      end_time,
      guests,
      seat_id: seat.id,
      seat_label: seat.label,
      seat_type: seat.type,
      uses_seats: seat.usesSeats,
      name,
      phone,
      email: email || null,
      note: note || null,
      status: "confirmed",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    );
  }

  // LINE通知（プレースホルダー）
  await notifyNewReservation(newReservation);

  return NextResponse.json(newReservation, { status: 201 });
}
