import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Yo'l topilmadi: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message || "Server xatosi";
  let details = err.details;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = "Ma'lumotlar noto'g'ri";
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Noto'g'ri ID yoki qiymat: ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    const keys = Object.keys(err.keyValue || {});
    message = keys.includes("login") ? "Bu login band — boshqasini tanlang" : keys.includes("barcode") ? "Bu shtrix-kod boshqa mahsulotda bor" : `Bunday qiymat allaqachon mavjud: ${keys.join(", ")}`;
  } else if (!(err instanceof ApiError) && status === 500) {
    console.error(err);
  }

  if (status >= 500 && process.env.NODE_ENV === "production") message = "Server xatosi";
  res.status(status).json({ success: false, message, ...(details ? { details } : {}) });
}
