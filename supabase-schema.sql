-- さとやま食堂 予約システム テーブル定義
-- Supabase SQL Editor で実行してください

-- 予約テーブル
CREATE TABLE IF NOT EXISTS reservations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  slot VARCHAR(20) NOT NULL,
  slot_label VARCHAR(20) NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  guests INTEGER NOT NULL,
  seat_id VARCHAR(20) NOT NULL,
  seat_label VARCHAR(50) NOT NULL,
  seat_type VARCHAR(20) NOT NULL,
  uses_seats TEXT[] DEFAULT '{}',
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  note TEXT,
  status VARCHAR(20) DEFAULT 'confirmed',
  auto_moved BOOLEAN DEFAULT false,
  original_seat_id VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 臨時営業日テーブル
CREATE TABLE IF NOT EXISTS special_open_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 臨時休業日テーブル
CREATE TABLE IF NOT EXISTS special_closed_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_special_open_days_date ON special_open_days(date);
CREATE INDEX IF NOT EXISTS idx_special_closed_days_date ON special_closed_days(date);

-- RLS (Row Level Security) を有効化
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_open_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_closed_days ENABLE ROW LEVEL SECURITY;

-- anon ユーザーにフルアクセスを許可（初期段階）
-- 本番運用時はより厳密なポリシーに変更すること
CREATE POLICY "Allow all access to reservations" ON reservations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to special_open_days" ON special_open_days
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to special_closed_days" ON special_closed_days
  FOR ALL USING (true) WITH CHECK (true);

-- 管理者設定テーブル（パスワードハッシュ保存用）
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  password_hash TEXT NOT NULL,
  max_guests_per_slot INTEGER NOT NULL DEFAULT 10,
  max_guests_per_group INTEGER NOT NULL DEFAULT 8,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 予約ブロックテーブル（特定の席・時間帯の予約受付を停止）
CREATE TABLE IF NOT EXISTS reservation_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  seat_id VARCHAR(20),
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservation_blocks_date ON reservation_blocks(date);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to admin_settings" ON admin_settings
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to reservation_blocks" ON reservation_blocks
  FOR ALL USING (true) WITH CHECK (true);
