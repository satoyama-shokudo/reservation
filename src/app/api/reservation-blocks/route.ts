import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/reservation-blocks?date=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  let query = supabase
    .from("reservation_blocks")
    .select("*")
    .order("start_time");

  if (date) {
    query = query.eq("date", date);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST /api/reservation-blocks
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { date, seat_id, start_time, end_time } = body;

  if (!date || !start_time || !end_time) {
    return NextResponse.json(
      { error: "date, start_time, end_time は必須です" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("reservation_blocks")
    .insert({
      date,
      seat_id: seat_id || null,
      start_time,
      end_time,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
