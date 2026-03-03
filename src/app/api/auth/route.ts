import { NextRequest, NextResponse } from "next/server";

// POST /api/auth - 管理画面のシンプルパスワード認証
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password } = body;

  const adminPassword = process.env.ADMIN_PASSWORD || "satoyama2026";

  if (password === adminPassword) {
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
}
