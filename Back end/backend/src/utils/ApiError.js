export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
  static badRequest(msg, details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = "Avval tizimga kiring") { return new ApiError(401, msg); }
  static forbidden(msg = "Bu bo'limga ruxsatingiz yo'q") { return new ApiError(403, msg); }
  static notFound(msg = "Topilmadi") { return new ApiError(404, msg); }
}

/** Majburiy maydonlarni tekshiradi */
export function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === "");
  if (missing.length) throw ApiError.badRequest(`Majburiy maydonlar to'ldirilmagan: ${missing.join(", ")}`, { missing });
}

export function toPositiveNumber(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw ApiError.badRequest(`${name} noto'g'ri qiymat`);
  return n;
}
