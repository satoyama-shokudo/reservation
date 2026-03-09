import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/settings - 設定値を取得
export async function GET() {
  const { data, error } = await supabase
    .from("admin_settings")
    .select("max_guests_per_slot, max_guests_per_group")
    .limit(1)
    .single();

  if (error || !data) {
    // レコードがない場合はデフォルト値を返す
    return NextResponse.json({
      max_guests_per_slot: 10,
      max_guests_per_group: 8,
    });
  }

  return NextResponse.json({
    max_guests_per_slot: data.max_guests_per_slot ?? 10,
    max_guests_per_group: data.max_guests_per_group ?? 8,
  });
}

// PUT /api/settings - 設定値を更新
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { max_guests_per_slot, max_guests_per_group } = body;

  if (
    typeof max_guests_per_slot !== "number" ||
    typeof max_guests_per_group !== "number"
  ) {
    return NextResponse.json(
      { error: "数値を入力してください" },
      { status: 400 }
    );
  }

  if (max_guests_per_slot < 1 || max_guests_per_group < 1) {
    return NextResponse.json(
      { error: "1以上の値を入力してください" },
      { status: 400 }
    );
  }

  // 既存レコードを取得
  const { data: existing } = await supabase
    .from("admin_settings")
    .select("id")
    .limit(1)
    .single();

  if (existing) {
    const { error } = await supabase
      .from("admin_settings")
      .update({
        max_guests_per_slot,
        max_guests_per_group,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      return NextResponse.json(
        { error: "設定の保存に失敗しました" },
        { status: 500 }
      );
    }
  } else {
    // admin_settingsにレコードがない場合は新規作成（password_hashはダミー）
    const { error } = await supabase.from("admin_settings").insert({
      password_hash: "",
      max_guests_per_slot,
      max_guests_per_group,
    });

    if (error) {
      return NextResponse.json(
        { error: "設定の保存に失敗しました" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true });
}
