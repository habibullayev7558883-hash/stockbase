import { Branch } from "../models/index.js";
import { ApiError, requireFields } from "../utils/ApiError.js";

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function ensureUniqueName(name, exceptId) {
  const dup = await Branch.findOne({ name: new RegExp(`^${escapeRe(name)}$`, "i"), isActive: true, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
  if (dup) throw ApiError.badRequest("Bunday nomli filial allaqachon bor");
}

// GET /api/branches — faol filiallar (hamma ko'radi)
export async function listBranches(_req, res) {
  const data = await Branch.find({ isActive: true }).sort({ createdAt: 1 });
  res.json({ success: true, data });
}

// POST /api/branches { name, address? } (admin)
export async function createBranch(req, res) {
  requireFields(req.body, ["name"]);
  const name = String(req.body.name).trim();
  if (!name) throw ApiError.badRequest("Filial nomini yozing");
  await ensureUniqueName(name);
  const b = await Branch.create({ name, address: req.body.address });
  res.status(201).json({ success: true, message: "Filial qo'shildi", data: b });
}

// PUT /api/branches/:id { name?, address? } (admin) — nomini o'zgartirish
export async function updateBranch(req, res) {
  const b = await Branch.findById(req.params.id);
  if (!b || !b.isActive) throw ApiError.notFound("Filial topilmadi");
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) throw ApiError.badRequest("Filial nomini yozing");
    await ensureUniqueName(name, b._id);
    b.name = name;
  }
  if (req.body.address !== undefined) b.address = String(req.body.address).trim() || undefined;
  await b.save();
  res.json({ success: true, message: "Filial saqlandi", data: b });
}

// DELETE /api/branches/:id (admin) — arxivlash, savdo tarixi saqlanib qoladi
export async function deleteBranch(req, res) {
  const b = await Branch.findById(req.params.id);
  if (!b || !b.isActive) throw ApiError.notFound("Filial topilmadi");
  const others = await Branch.countDocuments({ _id: { $ne: b._id }, isActive: true });
  if (!others) throw ApiError.badRequest("Kamida bitta filial qolishi kerak");
  b.isActive = false;
  await b.save();
  res.json({ success: true, message: "Filial o'chirildi (tarixi saqlanib qoldi)" });
}
