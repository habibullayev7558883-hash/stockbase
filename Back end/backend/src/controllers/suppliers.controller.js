import mongoose from "mongoose";
import { Supplier, SupplierPayment, SupplyInvoice, Product, getRates, nextSeq } from "../models/index.js";
import { ApiError, requireFields, toPositiveNumber } from "../utils/ApiError.js";
import { dayRange, periodRange } from "../utils/dates.js";
import { branchFilter, requireBranch } from "../middleware/branch.js";

/**
 * GET /api/suppliers?date=
 * Har bir ta'minotchi: bugun nechta kirim, qancha tovar olindi va umumiy qarzimiz.
 */
export async function listSuppliers(req, res) {
  const { start, end } = dayRange(req.query.date);
  const group = { $group: { _id: "$supplier", count: { $sum: 1 }, total: { $sum: "$total" }, paid: { $sum: "$paid" }, debt: { $sum: "$debt" }, last: { $max: "$createdAt" } } };
  const [suppliers, stats, all] = await Promise.all([
    Supplier.find({ isActive: true, ...branchFilter(req) }).sort({ name: 1 }).populate("branch", "name").lean(),
    SupplyInvoice.aggregate([{ $match: { createdAt: { $gte: start, $lt: end }, ...branchFilter(req) } }, group]),
    SupplyInvoice.aggregate([{ $match: branchFilter(req) }, group]),
  ]);
  const map = new Map(stats.map((s) => [String(s._id), s]));
  const allMap = new Map(all.map((s) => [String(s._id), s]));
  const zero = { count: 0, total: 0, paid: 0, debt: 0 };
  const data = suppliers.map((s) => {
    const st = map.get(String(s._id)) || zero;
    const at = allMap.get(String(s._id)) || zero;
    return {
      ...s,
      today: { count: st.count, total: st.total, paid: st.paid, debt: st.debt },
      allTime: { count: at.count, total: at.total, paid: at.paid, last: at.last || null },
    };
  });
  res.json({
    success: true,
    summary: {
      todayCount: data.reduce((a, s) => a + s.today.count, 0),
      todayTotal: data.reduce((a, s) => a + s.today.total, 0),
      totalDebt: data.reduce((a, s) => a + s.debt, 0),
    },
    data,
  });
}

// GET /api/suppliers/:id — tafsilot: oxirgi kirimlar va to'lovlar
export async function getSupplier(req, res) {
  const s = await Supplier.findById(req.params.id);
  if (!s) throw ApiError.notFound("Ta'minotchi topilmadi");
  const [entries, payments] = await Promise.all([
    SupplyInvoice.find({ supplier: s._id }).sort({ createdAt: -1 }).limit(200).populate("createdBy", "name"),
    SupplierPayment.find({ supplier: s._id }).sort({ createdAt: -1 }).limit(50).populate("createdBy", "name"),
  ]);
  res.json({ success: true, data: { supplier: s, entries, payments } });
}

// POST /api/suppliers
export async function createSupplier(req, res) {
  const branch = requireBranch(req);
  requireFields(req.body, ["name"]);
  const { name, phone, note, debt = 0 } = req.body;
  const s = await Supplier.create({ name, phone, note, branch, debt: toPositiveNumber(debt, "Boshlang'ich qarz") });
  res.status(201).json({ success: true, data: s });
}

// PUT /api/suppliers/:id
export async function updateSupplier(req, res) {
  const upd = {};
  for (const k of ["name", "phone", "note", "isActive"]) if (req.body[k] !== undefined) upd[k] = req.body[k];
  const s = await Supplier.findByIdAndUpdate(req.params.id, upd, { new: true, runValidators: true });
  if (!s) throw ApiError.notFound("Ta'minotchi topilmadi");
  res.json({ success: true, data: s });
}

// DELETE /api/suppliers/:id (arxivlash)
export async function deleteSupplier(req, res) {
  const s = await Supplier.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!s) throw ApiError.notFound("Ta'minotchi topilmadi");
  res.json({ success: true, message: "Ta'minotchi arxivlandi" });
}

// POST /api/suppliers/:id/pay  { amount, note }  — qarzni to'lash
export async function paySupplier(req, res) {
  const amount = toPositiveNumber(req.body.amount, "Summa");
  if (amount < 1) throw ApiError.badRequest("Summa 0 dan katta bo'lishi kerak");
  const s = await Supplier.findOneAndUpdate(
    { _id: req.params.id, debt: { $gte: amount } },
    { $inc: { debt: -amount } },
    { new: true }
  );
  if (!s) throw ApiError.badRequest("Ta'minotchi topilmadi yoki to'lov qarzdan katta");
  const p = await SupplierPayment.create({ supplier: s._id, amount, note: req.body.note, branch: s.branch, createdBy: req.user._id });
  res.status(201).json({ success: true, data: { supplier: s, payment: p } });
}

// ---------- Kirimlar (nakladnoy) ----------

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * POST /api/supplies
 * {
 *   supplier?: ID  yoki  supplierName: "Baraka Trade", supplierPhone?,
 *   items: [{ name, quantity, unit?, unitPrice, sellPrice?, product? }],
 *   currency?: "UZS"|"USD", paid?, note?
 * }
 * Ta'minotchi yo'q bo'lsa — yaratiladi. Tovar omborda yo'q bo'lsa — yangi mahsulot yaratiladi.
 * Hamma tovar omborga qo'shiladi, to'lanmagan qismi ta'minotchi qarziga yoziladi.
 */
export async function createSupply(req, res) {
  const branch = requireBranch(req);
  const { supplier, supplierName, supplierPhone, items, currency = "UZS", note, updateCost = true } = req.body;
  if (!["UZS", "USD"].includes(currency)) throw ApiError.badRequest("Valyuta UZS yoki USD");
  if (!Array.isArray(items) || !items.length) throw ApiError.badRequest("Kamida bitta tovar kiriting");

  // Tovarlarni tekshiramiz
  const lines = items.map((it, i) => {
    const name = String(it.name || "").trim();
    if (!name) throw ApiError.badRequest(`${i + 1}-qator: tovar nomi yozilmagan`);
    const quantity = toPositiveNumber(it.quantity, `${i + 1}-qator miqdori`);
    if (quantity <= 0) throw ApiError.badRequest(`${i + 1}-qator: miqdor 0 dan katta bo'lishi kerak`);
    const unitPrice = toPositiveNumber(it.unitPrice, `${i + 1}-qator narxi`);
    return {
      name, quantity, unitPrice,
      unit: String(it.unit || "dona").trim() || "dona",
      sellPrice: it.sellPrice ? toPositiveNumber(it.sellPrice, "Sotuv narxi") : 0,
      product: mongoose.isValidObjectId(it.product) ? it.product : null,
      total: round2(quantity * unitPrice),
    };
  });

  // Ta'minotchi: tanlangan yoki ismi bo'yicha (yo'q bo'lsa yaratiladi)
  let sup = null;
  if (supplier && mongoose.isValidObjectId(supplier)) sup = await Supplier.findById(supplier);
  if (!sup) {
    const nm = String(supplierName || "").trim();
    if (!nm) throw ApiError.badRequest("Ta'minotchini tanlang yoki ismini yozing");
    sup = await Supplier.findOne({ name: new RegExp(`^${escapeRe(nm)}$`, "i"), branch });
    if (!sup) sup = await Supplier.create({ name: nm, phone: supplierPhone, branch });
    else if (!sup.isActive) { sup.isActive = true; await sup.save(); }
  }

  const { rate } = await getRates();
  const totalCurrency = round2(lines.reduce((s, l) => s + l.total, 0));
  const total = Math.round(currency === "USD" ? totalCurrency * rate : totalCurrency);
  const paid = Math.round(toPositiveNumber(req.body.paid ?? 0, "To'langan summa"));
  if (paid > total) throw ApiError.badRequest("To'langan summa jami summadan katta");
  const debt = total - paid;

  // Omborga qo'shamiz
  for (const l of lines) {
    let prod = l.product ? await Product.findById(l.product) : null;
    if (!prod) prod = await Product.findOne({ name: new RegExp(`^${escapeRe(l.name)}$`, "i"), isActive: true });
    if (prod) {
      const upd = { $inc: { quantity: l.quantity } };
      if (updateCost) upd.$set = { costCurrency: currency, costPrice: l.unitPrice, ...(l.sellPrice ? { sellPrice: l.sellPrice } : {}) };
      await Product.updateOne({ _id: prod._id }, upd);
      l.product = prod._id;
      l.isNewProduct = false;
    } else {
      prod = await Product.create({
        name: l.name, stockUnit: l.unit, quantity: l.quantity, costCurrency: currency, costPrice: l.unitPrice,
        sellPrice: l.sellPrice || 0, category: "Boshqa",
      });
      l.product = prod._id;
      l.isNewProduct = true;
    }
  }

  const inv = await SupplyInvoice.create({
    invoiceNo: await nextSeq("supply", 1000),
    supplier: sup._id, supplierName: sup.name,
    items: lines.map(({ sellPrice, ...l }) => l),
    currency, rate: currency === "USD" ? rate : undefined,
    totalCurrency, total, paid, debt, note,
    createdBy: req.user._id, branch,
  });
  if (debt) await Supplier.updateOne({ _id: sup._id }, { $inc: { debt } });

  await inv.populate([{ path: "supplier", select: "name phone" }, { path: "createdBy", select: "name" }]);
  res.status(201).json({ success: true, message: "Kirim saqlandi", data: inv });
}

/**
 * GET /api/supplies?period=today|week|month|all&date=&from=&to=&supplier=&limit=
 * Kirim nakladnoylari (tovarlari bilan) va oxirida jami.
 */
export async function listSupplies(req, res) {
  const filter = { ...branchFilter(req) };
  if (req.query.period !== "all") {
    const { start, end } = req.query.period || req.query.from ? periodRange(req.query) : dayRange(req.query.date);
    filter.createdAt = { $gte: start, $lt: end };
  }
  if (req.query.supplier && mongoose.isValidObjectId(req.query.supplier)) filter.supplier = new mongoose.Types.ObjectId(String(req.query.supplier));
  const limit = Math.min(Number(req.query.limit) || 200, 1000);

  const [data, agg] = await Promise.all([
    SupplyInvoice.find(filter).sort({ createdAt: -1 }).limit(limit).populate("supplier", "name phone").populate("createdBy", "name"),
    SupplyInvoice.aggregate([
      { $match: filter },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$total" }, paid: { $sum: "$paid" }, debt: { $sum: "$debt" }, items: { $sum: { $size: "$items" } } } },
    ]),
  ]);
  const t = agg[0] || { count: 0, total: 0, paid: 0, debt: 0, items: 0 };
  res.json({ success: true, summary: { count: t.count, total: t.total, paid: t.paid, debt: t.debt, items: t.items }, data });
}

// GET /api/supplies/:id
export async function getSupply(req, res) {
  const inv = await SupplyInvoice.findById(req.params.id).populate("supplier", "name phone").populate("createdBy", "name");
  if (!inv) throw ApiError.notFound("Kirim topilmadi");
  res.json({ success: true, data: inv });
}

// DELETE /api/supplies/:id — xato kiritilgan nakladnoyni bekor qilish
export async function deleteSupply(req, res) {
  const inv = await SupplyInvoice.findById(req.params.id);
  if (!inv) throw ApiError.notFound("Kirim topilmadi");
  // Avval hamma tovar omborda yetarliligini tekshiramiz
  for (const it of inv.items) {
    if (!it.product) continue;
    const p = await Product.findById(it.product);
    if (p && p.quantity < it.quantity) throw ApiError.badRequest(`"${it.name}" allaqachon sotilgan — nakladnoyni bekor qilib bo'lmaydi`);
  }
  for (const it of inv.items) if (it.product) await Product.updateOne({ _id: it.product }, { $inc: { quantity: -it.quantity } });
  if (inv.debt) await Supplier.updateOne({ _id: inv.supplier }, { $inc: { debt: -inv.debt } });
  await inv.deleteOne();
  res.json({ success: true, message: "Kirim bekor qilindi" });
}
