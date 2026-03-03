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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 臨時営業日テーブル
CREATE TABLE IF NOT EXISTS special_open_days (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_special_open_days_date ON special_open_days(date);

-- RLS (Row Level Security) を有効化
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_open_days ENABLE ROW LEVEL SECURITY;

-- anon ユーザーにフルアクセスを許可（初期段階）
-- 本番運用時はより厳密なポリシーに変更すること
CREATE POLICY "Allow all access to reservations" ON reservations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all access to special_open_days" ON special_open_days
  FOR ALL USING (true) WITH CHECK (true);
