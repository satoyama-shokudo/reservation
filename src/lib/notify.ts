import { Reservation } from "./availability";

/**
 * 新規予約をLINE Messaging APIで女将さんに通知する
 * TODO: LINE Messaging API実装
 */
export async function notifyNewReservation(reservation: Reservation) {
  console.log("📩 新規予約通知:", {
    name: reservation.name,
    date: reservation.date,
    time: `${reservation.start_time}〜${reservation.end_time}`,
    guests: reservation.guests,
    seat: reservation.seat_label,
  });

  // TODO: LINE Messaging API で通知を送信
  // const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  // const LINE_USER_ID = process.env.LINE_NOTIFY_USER_ID;
  // if (LINE_TOKEN && LINE_USER_ID) {
  //   await fetch("https://api.line.me/v2/bot/message/push", {
  //     method: "POST",
  //     headers: {
  //       "Content-Type": "application/json",
  //       Authorization: `Bearer ${LINE_TOKEN}`,
  //     },
  //     body: JSON.stringify({
  //       to: LINE_USER_ID,
  //       messages: [{
  //         type: "text",
  //         text: `🍽 新規予約\n${reservation.name}様\n${reservation.date} ${reservation.start_time}〜\n${reservation.guests}名 ${reservation.seat_label}`,
  //       }],
  //     }),
  //   });
  // }
}
