import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { notifyNewReservation } from "@/lib/notify";

// GET /api/reservations?date=YYYY-MM-DD or ?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supabase.from("reservations").select("*").order("date").order("start_time");

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

  const { date, slot, slot_label, start_time, end_time, guests, seat_id, seat_label, seat_type, uses_seats, name, phone, email, note } = body;

  if (!date || !slot || !start_time || !end_time || !guests || !seat_id || !name || !phone) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      date,
      slot,
      slot_label: slot_label || slot,
      start_time,
      end_time,
      guests,
      seat_id,
      seat_label: seat_label || seat_id,
      seat_type: seat_type || "table",
      uses_seats: uses_seats || [seat_id],
      name,
      phone,
      email: email || null,
      note: note || null,
      status: "confirmed",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // LINE通知（プレースホルダー）
  await notifyNewReservation(data);

  return NextResponse.json(data, { status: 201 });
}
