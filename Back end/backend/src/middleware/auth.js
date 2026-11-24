import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";

export function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

/** Token tekshiradi: Authorization: Bearer <token> */
export async function protect(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized("Token yaroqsiz yoki muddati tugagan");
  }
  const user = await User.findById(payload.id);
  if (!user || !user.isActive) throw ApiError.unauthorized("Foydalanuvchi topilmadi yoki bloklangan");
  req.user = user;
  next();
}

/** Faqat ko'rsatilgan rollarga ruxsat: allow("admin") */
export const allow = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) throw ApiError.forbidden();
  next();
};
