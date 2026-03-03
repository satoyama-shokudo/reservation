import { Seat, getSeatTiers } from "./seats";
import { timeToMinutes, getEndTime } from "./slots";

export interface Reservation {
  id: string;
  date: string;
  slot: string;
  slot_label: string;
  start_time: string;
  end_time: string;
  guests: number;
  seat_id: string;
  seat_label: string;
  seat_type: string;
  uses_seats: string[];
  name: string;
  phone: string;
  email?: string;
  note?: string;
  status: string;
  created_at: string;
}

/** 2つの時間範囲が重なるかチェック */
function isTimeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a0 = timeToMinutes(startA);
  const a1 = timeToMinutes(endA);
  const b0 = timeToMinutes(startB);
  const b1 = timeToMinutes(endB);
  return a0 < b1 && b0 < a1;
}

/** 指定した席が指定時間帯で空いているか判定 */
export function isSeatAvailable(
  seat: Seat,
  startTime: string,
  reservations: Reservation[]
): boolean {
  const endTime = getEndTime(startTime);
  const physicalSeats = seat.usesSeats;

  // confirmed な予約のみチェック
  const activeReservations = reservations.filter((r) => r.status === "confirmed");

  for (const r of activeReservations) {
    // この予約が使用する物理席
    const reservedPhysicalSeats = r.uses_seats || [r.seat_id];

    // 物理席の重なりがあるかチェック
    const hasSeatOverlap = physicalSeats.some((ps) =>
      reservedPhysicalSeats.includes(ps)
    );

    if (hasSeatOverlap) {
      // 時間の重なりチェック
      if (isTimeOverlap(startTime, endTime, r.start_time, r.end_time)) {
        return false;
      }
    }
  }
  return true;
}

/** ティア優先ロジックで利用可能な席を返す */
export function getAvailableSeats(
  guests: number,
  startTime: string,
  reservations: Reservation[]
): Seat[] {
  const tiers = getSeatTiers(guests);

  for (const tier of tiers) {
    const available = tier.filter((seat) =>
      isSeatAvailable(seat, startTime, reservations)
    );
    if (available.length > 0) {
      return available;
    }
  }
  return [];
}

/** 指定日・人数の全開始時刻における空席数を返す */
export function getAvailabilityForDate(
  startTimes: string[],
  guests: number,
  reservations: Reservation[]
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const time of startTimes) {
    result[time] = getAvailableSeats(guests, time, reservations).length;
  }
  return result;
}
