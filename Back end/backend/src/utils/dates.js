import { env } from "../config/env.js";
import { ApiError } from "./ApiError.js";

const DAY = 24 * 60 * 60 * 1000;
const OFF = () => env.tzOffsetMs;

/** Toshkent vaqti bo'yicha "YYYY-MM-DD" */
export function localDateStr(d = new Date()) {
  return new Date(d.getTime() + OFF()).toISOString().slice(0, 10);
}

/** Berilgan kun (YYYY-MM-DD) uchun [start, end) — Toshkent vaqti bo'yicha */
export function dayRange(dateStr) {
  const s = dateStr || localDateStr();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw ApiError.badRequest("Sana formati YYYY-MM-DD bo'lishi kerak");
  const [y, m, d] = s.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d) - OFF());
  return { start, end: new Date(start.getTime() + DAY), date: s };
}

/** Oy uchun (YYYY-MM) [start, end) */
export function monthRange(monthStr) {
  const s = monthStr || localDateStr().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(s)) throw ApiError.badRequest("Oy formati YYYY-MM bo'lishi kerak");
  const [y, m] = s.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1) - OFF());
  const end = new Date(Date.UTC(y, m, 1) - OFF());
  return { start, end, month: s };
}

/** period: today | week | month | custom(from,to) */
export function periodRange({ period = "today", from, to, date } = {}) {
  if (from || to) {
    const a = dayRange(from || localDateStr());
    const b = dayRange(to || localDateStr());
    return { start: a.start, end: b.end };
  }
  const today = dayRange(date);
  if (period === "week") return { start: new Date(today.end.getTime() - 7 * DAY), end: today.end };
  if (period === "month") return monthRange((date || localDateStr()).slice(0, 7));
  return { start: today.start, end: today.end };
}

/** Qaytarish uchun taxminiy vaqt oraliqlari */
export const TIME_SLOTS = {
  ertalab: { label: "Ertalab (06:00-12:00)", from: 6, to: 12 },
  tushdan: { label: "Tushdan keyin (12:00-18:00)", from: 12, to: 18 },
  kechqurun: { label: "Kechqurun (18:00-24:00)", from: 18, to: 24 },
  nomalum: { label: "Vaqti noma'lum", from: 0, to: 24 },
};

export function slotRange(dateStr, slot = "nomalum") {
  const { start } = dayRange(dateStr);
  const s = TIME_SLOTS[slot] || TIME_SLOTS.nomalum;
  return { start: new Date(start.getTime() + s.from * 3600000), end: new Date(start.getTime() + s.to * 3600000) };
}

export function shiftDays(date, days) {
  return new Date(date.getTime() + days * DAY);
}
