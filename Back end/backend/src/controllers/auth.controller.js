import { User, PERMISSIONS, ROLES } from "../models/index.js";
import { signToken } from "../middleware/auth.js";
import { ApiError, requireFields } from "../utils/ApiError.js";

// POST /api/auth/login
export async function login(req, res) {
  requireFields(req.body, ["login", "password"]);
  const user = await User.findOne({ login: String(req.body.login).toLowerCase().trim() }).select("+password");
  if (!user || !(await user.comparePassword(String(req.body.password)))) {
    throw ApiError.unauthorized("Login yoki parol noto'g'ri");
  }
  if (!user.isActive) throw ApiError.forbidden("Foydalanuvchi bloklangan");
  await user.populate("branch", "name");
  res.json({ success: true, token: signToken(user), user: user.toPublic() });
}

// GET /api/auth/me
export async function me(req, res) {
  await req.user.populate("branch", "name");
  res.json({ success: true, user: req.user.toPublic() });
}

// ---------- Xodimlar (faqat admin) ----------

// GET /api/users
export async function listUsers(_req, res) {
  const users = await User.find().populate("branch", "name").sort({ createdAt: 1 });
  res.json({ success: true, data: users.map((u) => u.toPublic()) });
}

const PROFILE = ["firstName", "lastName", "age", "phone", "address", "position", "branch"];
const fullName = (f, l) => [f, l].filter(Boolean).map((x) => String(x).trim()).join(" ");

/** Oxirgi faol adminni o'chirib/rolini tushirib bo'lmaydi */
async function ensureAnotherAdmin(userId) {
  const others = await User.countDocuments({ _id: { $ne: userId }, role: "admin", isActive: true });
  if (!others) throw ApiError.badRequest("Kamida bitta faol admin qolishi kerak");
}

// POST /api/users  — yangi xodim yoki admin
export async function createUser(req, res) {
  requireFields(req.body, ["firstName", "login", "password"]);
  const { role = "xodim" } = req.body;
  if (!ROLES.includes(role)) throw ApiError.badRequest("Rol noto'g'ri (admin yoki xodim)");
  if (String(req.body.password).length < 6) throw ApiError.badRequest("Parol kamida 6 ta belgidan iborat bo'lsin");
  const data = { role, login: String(req.body.login).trim().toLowerCase(), password: String(req.body.password) };
  for (const k of PROFILE) if (req.body[k] !== undefined && req.body[k] !== "") data[k] = req.body[k];
  if (!data.branch) data.branch = req.branchId || req.user.branch;
  data.name = fullName(data.firstName, data.lastName);
  if (!/^[a-z0-9._-]{3,30}$/.test(data.login)) throw ApiError.badRequest("Login 3-30 ta lotin harf yoki raqamdan iborat bo'lsin (bo'sh joysiz)");
  const user = await User.create(data);
  res.status(201).json({ success: true, data: user.toPublic() });
}

// PUT /api/users/:id  — ma'lumotlarni, rolni, parolni o'zgartirish yoki bloklash/faollashtirish
export async function updateUser(req, res) {
  const user = await User.findById(req.params.id).select("+password");
  if (!user) throw ApiError.notFound("Xodim topilmadi");
  const isSelf = String(user._id) === String(req.user._id);

  for (const k of PROFILE) if (req.body[k] !== undefined) user[k] = req.body[k] === "" ? undefined : req.body[k];
  if (req.body.firstName !== undefined || req.body.lastName !== undefined) {
    const f = req.body.firstName ?? user.firstName, l = req.body.lastName ?? user.lastName;
    if (!String(f || "").trim()) throw ApiError.badRequest("Ismni kiriting");
    user.name = fullName(f, l);
  }
  if (req.body.login !== undefined) {
    const lg = String(req.body.login).trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(lg)) throw ApiError.badRequest("Login 3-30 ta lotin harf yoki raqamdan iborat bo'lsin (bo'sh joysiz)");
    user.login = lg;
  }
  if (req.body.password) {
    if (String(req.body.password).length < 6) throw ApiError.badRequest("Parol kamida 6 ta belgidan iborat bo'lsin");
    user.password = String(req.body.password);
  }
  if (req.body.role !== undefined) {
    if (!ROLES.includes(req.body.role)) throw ApiError.badRequest("Rol noto'g'ri");
    if (user.role === "admin" && req.body.role !== "admin") {
      if (isSelf) throw ApiError.badRequest("O'zingizni admin rolidan chiqara olmaysiz");
      await ensureAnotherAdmin(user._id);
    }
    user.role = req.body.role;
  }
  if (req.body.isActive !== undefined) {
    if (req.body.isActive === false) {
      if (isSelf) throw ApiError.badRequest("O'zingizni bloklay olmaysiz");
      if (user.role === "admin") await ensureAnotherAdmin(user._id);
    }
    user.isActive = !!req.body.isActive;
  }
  await user.save();
  await user.populate("branch", "name");
  res.json({ success: true, data: user.toPublic() });
}

// DELETE /api/users/:id  (bloklash — tarix saqlanib qoladi)
export async function deleteUser(req, res) {
  if (String(req.params.id) === String(req.user._id)) throw ApiError.badRequest("O'zingizni bloklay olmaysiz");
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("Xodim topilmadi");
  if (user.role === "admin") await ensureAnotherAdmin(user._id);
  user.isActive = false;
  await user.save();
  res.json({ success: true, data: user.toPublic() });
}

// GET /api/auth/permissions — rollar va ular ko'radigan bo'limlar
export function permissions(_req, res) {
  res.json({ success: true, data: PERMISSIONS });
}
