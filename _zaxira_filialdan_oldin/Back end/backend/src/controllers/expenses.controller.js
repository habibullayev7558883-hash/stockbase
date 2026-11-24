import mongoose from "mongoose";
import { Expense, EXPENSE_CATEGORIES, User } from "../models/index.js";
import { ApiError, requireFields, toPositiveNumber } from "../utils/ApiError.js";
import { periodRange } from "../utils/dates.js";

// GET /api/expenses/categories
export function categories(_req, res) {
  res.json({ success: true, data: EXPENSE_CATEGORIES });
}

/**
 * GET /api/expenses?period=today|week|month&date=&from=&to=&user=&category=
 * Admin hammasini ko'radi, xodim faqat o'zinikini.
 * Javob: ro'yxat + jami + kim qancha sarfladi + turlari bo'yicha.
 */
export async function listExpenses(req, res) {
  const { start, end } = periodRange(req.query);
  const filter = { spentAt: { $gte: start, $lt: end } };
  if (req.user.role !== "admin") filter.user = req.user._id;
  else if (req.query.user) filter.user = new mongoose.Types.ObjectId(String(req.query.user));
  if (req.query.category) filter.category = req.query.category;

  const [data, byUser, byCategory] = await Promise.all([
    Expense.find(filter).sort({ spentAt: -1 }).populate("user", "name position").populate("createdBy", "name"),
    Expense.aggregate([
      { $match: filter },
      { $group: { _id: "$user", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
      { $unwind: "$u" },
      { $project: { _id: 0, user: "$_id", name: "$u.name", position: "$u.position", total: 1, count: 1 } },
      { $sort: { total: -1 } },
    ]),
    Expense.aggregate([
      { $match: filter },
      { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $project: { _id: 0, category: "$_id", total: 1, count: 1 } },
      { $sort: { total: -1 } },
    ]),
  ]);

  const total = data.reduce((s, e) => s + e.amount, 0);
  res.json({ success: true, summary: { total, count: data.length, byUser, byCategory }, data });
}

/**
 * POST /api/expenses  { note, amount, category?, user?, spentAt? }
 * Xodim faqat o'zi uchun kiritadi; admin istalgan xodim nomidan.
 */
export async function createExpense(req, res) {
  requireFields(req.body, ["note", "amount"]);
  const amount = toPositiveNumber(req.body.amount, "Summa");
  if (amount < 1) throw ApiError.badRequest("Summa 0 dan katta bo'lishi kerak");
  const category = req.body.category || "Boshqa";
  if (!EXPENSE_CATEGORIES.includes(category)) throw ApiError.badRequest(`Turi: ${EXPENSE_CATEGORIES.join(", ")}`);

  let userId = req.user._id;
  if (req.user.role === "admin" && req.body.user) {
    const u = await User.findById(req.body.user);
    if (!u) throw ApiError.notFound("Xodim topilmadi");
    userId = u._id;
  }

  const exp = await Expense.create({
    user: userId, category, note: req.body.note, amount,
    spentAt: req.body.spentAt ? new Date(req.body.spentAt) : new Date(),
    createdBy: req.user._id, branch: req.user.branch,
  });
  await exp.populate("user", "name position");
  res.status(201).json({ success: true, data: exp });
}

// PUT /api/expenses/:id (admin)
export async function updateExpense(req, res) {
  const allowed = ["note", "amount", "category", "user", "spentAt"];
  const upd = {};
  for (const k of allowed) if (req.body[k] !== undefined) upd[k] = req.body[k];
  const exp = await Expense.findByIdAndUpdate(req.params.id, upd, { new: true, runValidators: true }).populate("user", "name position");
  if (!exp) throw ApiError.notFound("Xarajat topilmadi");
  res.json({ success: true, data: exp });
}

// DELETE /api/expenses/:id (admin)
export async function deleteExpense(req, res) {
  const exp = await Expense.findByIdAndDelete(req.params.id);
  if (!exp) throw ApiError.notFound("Xarajat topilmadi");
  res.json({ success: true, message: "Xarajat o'chirildi" });
}
