import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";

// POST /api/auth - 管理画面パスワード認証（bcrypt + DB）
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password } = body;

  if (!password) {
    return NextResponse.json({ error: "パスワードが必要です" }, { status: 400 });
  }

  // DBからパスワードハッシュを取得
  const { data, error } = await supabase
    .from("admin_settings")
    .select("password_hash")
    .limit(1)
    .single();

  if (error || !data) {
    // DBにレコードがない場合は環境変数フォールバック（移行期間の互換性）
    const adminPassword = process.env.ADMIN_PASSWORD || "satoyama2026";
    if (password === adminPassword) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  // bcryptでハッシュ比較
  const match = await bcrypt.compare(password, data.password_hash);
  if (match) {
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
}
