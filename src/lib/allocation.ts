import { Seat, getSeatTiers, getSeatById } from "./seats";
import type { Reservation } from "./availability";
import { timeToMinutes, getEndTime } from "./slots";

/* ===== 型定義 ===== */

export interface ReservationBlock {
  id: string;
  date: string;
  seat_id: string | null;
  start_time: string;
  end_time: string;
}

export interface AllocationMove {
  reservationId: string;
  fromSeatId: string;
  toSeat: Seat;
}

export interface AllocationResult {
  success: boolean;
  error?: string;
  newSeat?: Seat;
  moves: AllocationMove[];
}

interface Entry {
  id: string | null; // null = 新規予約
  guests: number;
  startTime: string;
  endTime: string;
  currentSeatId: string | null;
}

/* ===== ユーティリティ ===== */

function doTimesOverlap(
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

function doSeatsConflict(seatA: Seat, seatB: Seat): boolean {
  return seatA.usesSeats.some((ps) => seatB.usesSeats.includes(ps));
}

/** 席がブロックに該当するか判定 */
function isSeatBlocked(
  seat: Seat,
  startTime: string,
  endTime: string,
  blocks: ReservationBlock[]
): boolean {
  for (const block of blocks) {
    if (!doTimesOverlap(startTime, endTime, block.start_time, block.end_time))
      continue;
    // seat_id が NULL = 全席ブロック
    if (!block.seat_id) return true;
    // 物理席の重複チェック
    if (seat.usesSeats.includes(block.seat_id)) return true;
  }
  return false;
}

/* ===== 安全チェック ===== */

/**
 * 配席結果を検証する。1つでも失敗したらエラーを返す。
 * - 全予約の存在チェック
 * - 定員チェック
 * - 物理席の重複チェック（結合席の整合性含む）
 */
function validateAssignment(
  entries: Entry[],
  assignment: Map<number, Seat>
): { valid: boolean; error?: string } {
  // 全予約が割り当てられているか
  if (assignment.size !== entries.length) {
    return { valid: false, error: "一部の予約に席が割り当てられていません" };
  }

  for (const [i, seat] of assignment.entries()) {
    const entry = entries[i];

    // 定員チェック
    if (entry.guests > seat.maxGuests) {
      return {
        valid: false,
        error: `予約(${entry.id ?? "新規"})の人数${entry.guests}名が席${seat.label}の定員${seat.maxGuests}名を超えています`,
      };
    }

    // 物理席の重複チェック（時間が重なるペアのみ）
    for (const [j, otherSeat] of assignment.entries()) {
      if (i >= j) continue;
      const otherEntry = entries[j];
      if (
        doTimesOverlap(
          entry.startTime,
          entry.endTime,
          otherEntry.startTime,
          otherEntry.endTime
        )
      ) {
        if (doSeatsConflict(seat, otherSeat)) {
          return {
            valid: false,
            error: `席${seat.label}と席${otherSeat.label}の物理席が重複しています（${entry.startTime}–${entry.endTime} / ${otherEntry.startTime}–${otherEntry.endTime}）`,
          };
        }
      }
    }
  }

  return { valid: true };
}

/* ===== バックトラッキング探索 ===== */

function findAssignment(
  entries: Entry[],
  possibleSeats: Seat[][],
  index: number,
  current: Map<number, Seat>
): Map<number, Seat> | null {
  if (index === entries.length) {
    return new Map(current);
  }

  const entry = entries[index];

  for (const seat of possibleSeats[index]) {
    let conflict = false;

    for (const [i, assignedSeat] of current.entries()) {
      const other = entries[i];
      if (
        doTimesOverlap(
          entry.startTime,
          entry.endTime,
          other.startTime,
          other.endTime
        )
      ) {
        if (doSeatsConflict(seat, assignedSeat)) {
          conflict = true;
          break;
        }
      }
    }

    if (!conflict) {
      current.set(index, seat);
      const result = findAssignment(entries, possibleSeats, index + 1, current);
      if (result) return result;
      current.delete(index);
    }
  }

  return null;
}

/* ===== メインアルゴリズム ===== */

/**
 * 最適配席アルゴリズム
 *
 * 新規予約を受け入れるための最適な席配置を計算する。
 * 必要に応じて既存予約の席を自動移動する。
 *
 * @param date        予約日
 * @param startTime   開始時刻
 * @param newGuests   新規予約の人数
 * @param settings    管理者設定（上限値）
 * @param allReservations この日の全 confirmed 予約
 * @param blocks      この日の予約ブロック
 */
export function allocateSeats(
  date: string,
  startTime: string,
  newGuests: number,
  settings: { maxGuestsPerSlot: number; maxGuestsPerGroup: number },
  allReservations: Reservation[],
  blocks: ReservationBlock[]
): AllocationResult {
  const endTime = getEndTime(startTime);

  // --- 1. 団体人数上限チェック ---
  if (newGuests > settings.maxGuestsPerGroup) {
    return {
      success: false,
      error: `1団体の人数上限（${settings.maxGuestsPerGroup}名）を超えています`,
      moves: [],
    };
  }

  // --- 2. 同時スタート人数上限チェック ---
  const sameStartGuests = allReservations
    .filter((r) => r.start_time === startTime)
    .reduce((sum, r) => sum + r.guests, 0);
  if (sameStartGuests + newGuests > settings.maxGuestsPerSlot) {
    return {
      success: false,
      error: `この時間帯の受入人数上限（${settings.maxGuestsPerSlot}名）を超えます`,
      moves: [],
    };
  }

  // --- 3. 全席ブロックチェック ---
  for (const block of blocks) {
    if (
      !block.seat_id &&
      doTimesOverlap(startTime, endTime, block.start_time, block.end_time)
    ) {
      return {
        success: false,
        error: "この時間帯は予約を受け付けていません",
        moves: [],
      };
    }
  }

  // --- 4. 時間重複する予約の Connected Component を構築 ---
  // 新規予約と重複する予約 → それらと重複する予約 → …を再帰的に収集
  const componentIds = new Set<string>();
  const queue: Reservation[] = allReservations.filter((r) =>
    doTimesOverlap(startTime, endTime, r.start_time, r.end_time)
  );

  while (queue.length > 0) {
    const r = queue.pop()!;
    if (componentIds.has(r.id)) continue;
    componentIds.add(r.id);
    for (const other of allReservations) {
      if (
        !componentIds.has(other.id) &&
        doTimesOverlap(r.start_time, r.end_time, other.start_time, other.end_time)
      ) {
        queue.push(other);
      }
    }
  }

  const componentReservations = allReservations.filter((r) =>
    componentIds.has(r.id)
  );

  // --- 5. エントリ構築（新規を先頭に） ---
  const newEntry: Entry = {
    id: null,
    guests: newGuests,
    startTime,
    endTime,
    currentSeatId: null,
  };

  const existingEntries: Entry[] = componentReservations.map((r) => ({
    id: r.id,
    guests: r.guests,
    startTime: r.start_time,
    endTime: r.end_time,
    currentSeatId: r.seat_id,
  }));

  const entries = [newEntry, ...existingEntries];

  // --- 6. 各エントリの候補席リストを構築 ---
  const possibleSeats: Seat[][] = entries.map((entry) => {
    const tiers = getSeatTiers(entry.guests, entry.startTime);
    const flatSeats = tiers.flat();

    // ブロックされた席を除外
    const available = flatSeats.filter(
      (seat) => !isSeatBlocked(seat, entry.startTime, entry.endTime, blocks)
    );

    // 既存予約は現在の席を最優先にする（移動を最小化）
    if (entry.currentSeatId) {
      const currentSeat = getSeatById(entry.currentSeatId);
      if (
        currentSeat &&
        !isSeatBlocked(currentSeat, entry.startTime, entry.endTime, blocks)
      ) {
        const filtered = available.filter((s) => s.id !== currentSeat.id);
        return [currentSeat, ...filtered];
      }
    }

    return available;
  });

  // --- 7. バックトラッキングで割り当て探索 ---
  const assignment = findAssignment(entries, possibleSeats, 0, new Map());

  if (!assignment) {
    return {
      success: false,
      error: "空いている席がありません",
      moves: [],
    };
  }

  // --- 8. 安全チェック ---
  const validation = validateAssignment(entries, assignment);
  if (!validation.valid) {
    return {
      success: false,
      error: `配席安全チェックエラー: ${validation.error}`,
      moves: [],
    };
  }

  // --- 9. 結果を組み立て ---
  const newSeat = assignment.get(0)!;
  const moves: AllocationMove[] = [];

  for (let i = 1; i < entries.length; i++) {
    const entry = entries[i];
    const assignedSeat = assignment.get(i)!;
    if (entry.currentSeatId && assignedSeat.id !== entry.currentSeatId) {
      moves.push({
        reservationId: entry.id!,
        fromSeatId: entry.currentSeatId,
        toSeat: assignedSeat,
      });
    }
  }

  return { success: true, newSeat, moves };
}
