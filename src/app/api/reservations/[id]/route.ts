import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSeatById, SEATS } from "@/lib/seats";
import { isSeatAvailable } from "@/lib/availability";
import type { Reservation } from "@/lib/availability";

// PATCH /api/reservations/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // 席変更
  if (body.seat_id) {
    const newSeat = getSeatById(body.seat_id);
    if (!newSeat) {
      return NextResponse.json(
        { error: "指定された席が見つかりません" },
        { status: 400 }
      );
    }

    // 対象予約を取得
    const { data: reservation, error: fetchError } = await supabase
      .from("reservations")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !reservation) {
      return NextResponse.json(
        { error: "予約が見つかりません" },
        { status: 404 }
      );
    }

    // 定員チェック
    if (reservation.guests > newSeat.maxGuests) {
      return NextResponse.json(
        {
          error: `人数（${reservation.guests}名）が席の定員（${newSeat.maxGuests}名）を超えています`,
        },
        { status: 400 }
      );
    }

    // その日の他の予約を取得して物理席重複チェック
    const { data: dayReservations } = await supabase
      .from("reservations")
      .select("*")
      .eq("date", reservation.date)
      .neq("id", id);

    const otherConfirmed = (
      (dayReservations || []) as Reservation[]
    ).filter((r) => r.status === "confirmed");

    if (!isSeatAvailable(newSeat, reservation.start_time, otherConfirmed)) {
      return NextResponse.json(
        { error: "この席は同じ時間帯に他の予約と重複しています" },
        { status: 409 }
      );
    }

    // 更新
    const { data, error } = await supabase
      .from("reservations")
      .update({
        seat_id: newSeat.id,
        seat_label: newSeat.label,
        seat_type: newSeat.type,
        uses_seats: newSeat.usesSeats,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  }

  // ステータス変更
  const { status } = body;
  if (!status || !["confirmed", "cancelled"].includes(status)) {
    return NextResponse.json(
      { error: "status は confirmed または cancelled を指定してください" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("reservations")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
