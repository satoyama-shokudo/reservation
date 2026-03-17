-- ラストオーダー時刻カラムを追加
-- Supabase SQL Editor で実行してください

-- モーニング（朝食）のラストオーダー時刻
ALTER TABLE admin_settings
  ADD COLUMN IF NOT EXISTS morning_last_order VARCHAR(5) DEFAULT '10:00';

-- ランチのラストオーダー時刻
ALTER TABLE admin_settings
  ADD COLUMN IF NOT EXISTS lunch_last_order VARCHAR(5) DEFAULT '13:45';
