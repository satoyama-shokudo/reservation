import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/special-closed-days
export async function GET() {
  const { data, error } = await supabase
    .from("special_closed_days")
    .select("*")
    .order("date");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST /api/special-closed-days
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { date } = body;

  if (!date) {
    return NextResponse.json({ error: "date は必須です" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("special_closed_days")
    .insert({ date })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "この日付は既に臨時休業日として登録されています" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
