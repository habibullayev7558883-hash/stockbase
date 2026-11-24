import mongoose from "mongoose";
import { Branch } from "../models/index.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Qaysi filial bilan ishlayotganini aniqlaydi -> req.branchId (ObjectId yoki null = barcha filiallar).
 * Xodim: doim o'zining filiali (biriktirilmagan bo'lsa — birinchi filial).
 * Admin: "X-Branch" sarlavhasi orqali tanlaydi; "all" yoki bo'sh = barcha filiallar (faqat ko'rish uchun).
 */
export async function branchScope(req, _res, next) {
  const branches = await Branch.find({ isActive: true }).sort({ createdAt: 1 }).select("_id name").lean();
  const ids = new Set(branches.map((b) => String(b._id)));
  let id = null;
  if (req.user.role !== "admin") {
    const own = req.user.branch && ids.has(String(req.user.branch)) ? req.user.branch : branches[0]?._id;
    id = own || null;
  } else {
    const h = String(req.headers["x-branch"] || "");
    id = ids.has(h) ? h : null;
  }
  req.branchId = id ? new mongoose.Types.ObjectId(String(id)) : null;
  req.branchName = id ? branches.find((b) => String(b._id) === String(id))?.name : null;
  next();
}

/** So'rovlar uchun filtr: { branch: id } yoki {} (barcha filiallar) */
export const branchFilter = (req, field = "branch") => (req.branchId ? { [field]: req.branchId } : {});

/** Yozish amallari (sotuv, xarajat, kirim...) aniq filialni talab qiladi */
export function requireBranch(req) {
  if (!req.branchId) throw ApiError.badRequest("Avval filialni tanlang («Barcha filiallar» rejimida faqat ko'rish mumkin)");
  return req.branchId;
}
