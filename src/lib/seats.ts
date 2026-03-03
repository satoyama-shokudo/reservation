export interface Seat {
  id: string;
  label: string;
  maxGuests: number;
  type: "counter" | "table" | "combined";
  usesSeats: string[]; // 結合席の場合、構成する個別席ID
}

export const SEATS: Seat[] = [
  { id: "counter", label: "カウンター", maxGuests: 2, type: "counter", usesSeats: ["counter"] },
  { id: "table2a", label: "テーブル2名席A", maxGuests: 2, type: "table", usesSeats: ["table2a"] },
  { id: "table2b", label: "テーブル2名席B", maxGuests: 2, type: "table", usesSeats: ["table2b"] },
  { id: "table4", label: "テーブル4名席", maxGuests: 4, type: "table", usesSeats: ["table4"] },
  { id: "table6", label: "テーブル6名席", maxGuests: 6, type: "table", usesSeats: ["table6"] },
  { id: "table2ab", label: "テーブル2名席A+B（結合）", maxGuests: 4, type: "combined", usesSeats: ["table2a", "table2b"] },
];

export function getSeatById(id: string): Seat | undefined {
  return SEATS.find((s) => s.id === id);
}

/** 人数に応じたティア別の席リストを返す */
export function getSeatTiers(guests: number): Seat[][] {
  if (guests <= 2) {
    return [
      // Tier 1: カウンター、テーブル2名席A、テーブル2名席B
      SEATS.filter((s) => ["counter", "table2a", "table2b"].includes(s.id)),
      // Tier 2: テーブル4名席
      SEATS.filter((s) => s.id === "table4"),
      // Tier 3: テーブル6名席
      SEATS.filter((s) => s.id === "table6"),
    ];
  }
  if (guests <= 4) {
    return [
      // Tier 1: テーブル4名席
      SEATS.filter((s) => s.id === "table4"),
      // Tier 2: テーブル2名席A+B（結合）
      SEATS.filter((s) => s.id === "table2ab"),
      // Tier 3: テーブル6名席
      SEATS.filter((s) => s.id === "table6"),
    ];
  }
  // 5〜6名
  return [SEATS.filter((s) => s.id === "table6")];
}
