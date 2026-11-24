import { Customer } from "../models/index.js";
import { ApiError, requireFields, toPositiveNumber } from "../utils/ApiError.js";

// GET /api/customers?search=&debtOnly=true
export async function listCustomers(req, res) {
  const filter = {};
  if (req.query.search) filter.name = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (req.query.debtOnly === "true") filter.debt = { $gt: 0 };
  const data = await Customer.find(filter).sort({ debt: -1, name: 1 }).limit(200);
  res.json({ success: true, summary: { totalDebt: data.reduce((s, c) => s + c.debt, 0) }, data });
}

// POST /api/customers
export async function createCustomer(req, res) {
  requireFields(req.body, ["name"]);
  const c = await Customer.create({ name: req.body.name, phone: req.body.phone, dueDate: req.body.dueDate });
  res.status(201).json({ success: true, data: c });
}

// POST /api/customers/:id/pay { amount } — mijoz nasiyani to'ladi
export async function payCustomerDebt(req, res) {
  const amount = toPositiveNumber(req.body.amount, "Summa");
  const c = await Customer.findOneAndUpdate({ _id: req.params.id, debt: { $gte: amount } }, { $inc: { debt: -amount } }, { new: true });
  if (!c) throw ApiError.badRequest("Mijoz topilmadi yoki summa qarzdan katta");
  res.json({ success: true, data: c });
}
