import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";

// PUT /api/auth/password - パスワード変更
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "現在のパスワードと新しいパスワードを入力してください" },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "新しいパスワードは8文字以上にしてください" },
      { status: 400 }
    );
  }

  // 現在のパスワードを検証
  const { data, error } = await supabase
    .from("admin_settings")
    .select("id, password_hash")
    .limit(1)
    .single();

  if (error || !data) {
    // DBにレコードがない場合は環境変数フォールバック
    const adminPassword = process.env.ADMIN_PASSWORD || "satoyama2026";
    if (currentPassword !== adminPassword) {
      return NextResponse.json(
        { error: "現在のパスワードが違います" },
        { status: 401 }
      );
    }

    // 初回：新しいレコードをINSERT
    const newHash = await bcrypt.hash(newPassword, 10);
    const { error: insertError } = await supabase
      .from("admin_settings")
      .insert({ password_hash: newHash });

    if (insertError) {
      return NextResponse.json(
        { error: "パスワードの保存に失敗しました" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  }

  // bcryptで現在のパスワードを検証
  const match = await bcrypt.compare(currentPassword, data.password_hash);
  if (!match) {
    return NextResponse.json(
      { error: "現在のパスワードが違います" },
      { status: 401 }
    );
  }

  // 新しいパスワードをハッシュ化してUPDATE
  const newHash = await bcrypt.hash(newPassword, 10);
  const { error: updateError } = await supabase
    .from("admin_settings")
    .update({ password_hash: newHash, updated_at: new Date().toISOString() })
    .eq("id", data.id);

  if (updateError) {
    return NextResponse.json(
      { error: "パスワードの更新に失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
