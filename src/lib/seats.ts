export interface Seat {
  id: string;
  label: string;
  maxGuests: number;
  type: "counter" | "table" | "combined";
  usesSeats: string[]; // 結合席の場合、構成する個別席ID
}

export const SEATS: Seat[] = [
  { id: "counter", label: "C2", maxGuests: 2, type: "counter", usesSeats: ["counter"] },
  { id: "table2a", label: "T2a", maxGuests: 2, type: "table", usesSeats: ["table2a"] },
  { id: "table2b", label: "T2b", maxGuests: 2, type: "table", usesSeats: ["table2b"] },
  { id: "table4", label: "T4", maxGuests: 4, type: "table", usesSeats: ["table4"] },
  { id: "table6", label: "T6", maxGuests: 6, type: "table", usesSeats: ["table6"] },
  { id: "table2ab", label: "T2aT2b", maxGuests: 4, type: "combined", usesSeats: ["table2a", "table2b"] },
  { id: "table2b4", label: "T2bT4", maxGuests: 6, type: "combined", usesSeats: ["table2b", "table4"] },
  { id: "table2ab4", label: "T2aT2bT4", maxGuests: 8, type: "combined", usesSeats: ["table2a", "table2b", "table4"] },
];

export function getSeatById(id: string): Seat | undefined {
  return SEATS.find((s) => s.id === id);
}

/** 人数・開始時刻に応じた優先順位で席リストを返す */
export function getSeatTiers(guests: number, startTime?: string): Seat[][] {
  const seat = (id: string) => SEATS.find((s) => s.id === id)!;

  if (guests <= 2) {
    // 12:30以降はカウンターを2番目に上げ、T2bを後ろに回す
    const isAfterNoon = startTime && startTime >= "12:30";
    if (isAfterNoon) {
      return [[seat("table2a")], [seat("counter")], [seat("table2b")]];
    }
    return [[seat("table2a")], [seat("table2b")], [seat("counter")]];
  }
  if (guests <= 4) {
    return [[seat("table4")], [seat("table2ab")], [seat("table6")]];
  }
  if (guests <= 6) {
    return [[seat("table6")], [seat("table2b4")]];
  }
  // 7〜8名
  return [[seat("table2ab4")]];
}
