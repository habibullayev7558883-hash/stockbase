import mongoose from "mongoose";
import { Sale, Product, Return, Customer, Notification } from "../models/index.js";
import { fmt } from "../utils/format.js";
import { ApiError, toPositiveNumber } from "../utils/ApiError.js";
import { slotRange, TIME_SLOTS, periodRange } from "../utils/dates.js";
import { branchFilter, requireBranch } from "../middleware/branch.js";

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/returns/slots — "Taxminiy vaqt" ro'yxati
export function slots(_req, res) {
  res.json({ success: true, data: Object.entries(TIME_SLOTS).map(([value, s]) => ({ value, label: s.label })) });
}

/**
 * GET /api/returns/search?date=2026-11-10&slot=tushdan&amount=518000&product=coca&receiptNo=10428
 * Mijoz aytgan vaqt, summa yoki mahsulot orqali asl chekni topadi.
 */
export async function searchSales(req, res) {
  const { date, slot = "nomalum", amount, product } = req.query;
  const code = String(req.query.barcode || req.query.receiptNo || "").trim().replace(/^#/, "");

  // Chek shtrix-kodi "00" + 6 raqam (masalan 00010065) yoki qo'lda yozilgan chek raqami (1-6 raqam)
  const findReceipt = async (n) => {
    const sale = await Sale.findOne({ receiptNo: Number(n), ...branchFilter(req) }).populate("cashier", "name");
    return res.json({ success: true, data: sale ? [sale] : [] });
  };
  if (/^00\d{6}$/.test(code) || /^\d{1,6}$/.test(code)) return findReceipt(code);
  if (!amount && !product && !code && (!slot || slot === "nomalum")) {
    throw ApiError.badRequest("Kamida vaqt, summa, mahsulot yoki shtrix-kodni kiriting");
  }

  const { start, end } = slotRange(date, slot);
  const filter = { createdAt: { $gte: start, $lt: end }, status: { $ne: "qaytarilgan" }, ...branchFilter(req) };

  // Mahsulot shtrix-kodi: shu kunda (va vaqtda) shu mahsulot sotilgan cheklar
  if (code) {
    const prod = await Product.findOne({ barcode: code });
    if (!prod) {
      if (/^\d{1,8}$/.test(code)) return findReceipt(code);
      return res.json({ success: true, data: [], message: "Bu shtrix-kod bilan mahsulot topilmadi" });
    }
    filter["items.product"] = prod._id;
  }

  if (product) filter["items.name"] = new RegExp(escapeRe(String(product)), "i");

  const amt = amount ? Number(String(amount).replace(/\s/g, "")) : null;
  if (amt) {
    const tol = Math.max(1000, amt * 0.01); // ±1% yoki ±1000 so'm
    filter.$or = [
      { total: { $gte: amt - tol, $lte: amt + tol } },
      { "items.total": { $gte: amt - tol, $lte: amt + tol } },
      { "items.price": { $gte: amt - tol, $lte: amt + tol } },
    ];
  }

  let data = await Sale.find(filter).sort({ createdAt: -1 }).limit(30).populate("cashier", "name");
  if (amt) data = data.sort((a, b) => Math.abs(a.total - amt) - Math.abs(b.total - amt));
  res.json({ success: true, data });
}

/**
 * POST /api/returns
 * { saleId, items?: [{ product, quantity }], reason? }
 * items berilmasa — chekdagi qolgan barcha mahsulot qaytariladi.
 */
export async function createReturn(req, res) {
  const { saleId, reason } = req.body;
  if (!mongoose.isValidObjectId(saleId)) throw ApiError.badRequest("Chek ID noto'g'ri");
  const sale = await Sale.findById(saleId);
  if (!sale) throw ApiError.notFound("Chek topilmadi");
  if (sale.status === "qaytarilgan") throw ApiError.badRequest("Bu chek to'liq qaytarilgan");
  if (req.branchId && sale.branch && String(sale.branch) !== String(req.branchId)) {
    throw ApiError.badRequest("Bu chek boshqa filialda sotilgan — qaytarishni o'sha filialda qiling");
  }

  const wanted = Array.isArray(req.body.items) && req.body.items.length
    ? req.body.items
    : sale.items.map((i) => ({ product: i.product, quantity: i.quantity - i.returnedQuantity }));

  const retItems = [];
  for (const w of wanted) {
    const line = sale.items.find((i) => String(i.product) === String(w.product));
    if (!line) throw ApiError.badRequest("Mahsulot bu chekda yo'q");
    const q = toPositiveNumber(w.quantity, "Miqdor");
    if (q <= 0) continue;
    const left = line.quantity - line.returnedQuantity;
    if (q > left) throw ApiError.badRequest(`"${line.name}" dan faqat ${left} ta qaytarish mumkin`);
    retItems.push({ line, q });
  }
  if (!retItems.length) throw ApiError.badRequest("Qaytariladigan mahsulot tanlanmagan");

  // Chegirmani proporsional taqsimlaymiz
  const ratio = sale.subtotal ? sale.total / sale.subtotal : 1;
  let amount = 0;
  const items = retItems.map(({ line, q }) => {
    const total = Math.round(line.price * q * ratio);
    amount += total;
    line.returnedQuantity += q;
    return { product: line.product, name: line.name, quantity: q, price: line.price, total };
  });

  await Promise.all(items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { quantity: i.quantity } })));

  sale.returnedAmount += amount;
  sale.status = sale.items.every((i) => i.returnedQuantity >= i.quantity) ? "qaytarilgan" : "qisman_qaytarilgan";
  await sale.save();

  if (sale.paymentType === "nasiya" && sale.customer) {
    const c = await Customer.findById(sale.customer);
    if (c) { c.debt = Math.max(0, c.debt - amount); await c.save(); }
  }

  const ret = await Return.create({
    sale: sale._id, receiptNo: sale.receiptNo, items, amount, paymentType: sale.paymentType, reason, createdBy: req.user._id, branch: sale.branch,
  });

  // Adminlarga xabar
  const what = items.map((i) => `${i.name} ×${i.quantity}`).join(", ");
  await Notification.create({
    type: "return",
    title: "Tovar qaytarildi",
    message: `${req.branchName ? `[${req.branchName}] ` : ""}${req.user.name} #${sale.receiptNo} chekdan ${fmt(amount)} so'mlik tovar qaytardi: ${what}${reason ? `. Sababi: ${reason}` : ""}`,
    link: "/qaytarish",
    data: { receiptNo: sale.receiptNo, amount, returnId: ret._id },
    createdBy: req.user._id,
    branch: sale.branch,
    readBy: [req.user._id],
  });
  res.status(201).json({ success: true, message: "Mahsulot qaytarildi, omborga qo'shildi", data: { return: ret, sale } });
}

// GET /api/returns?period=today|week|month
export async function listReturns(req, res) {
  const { start, end } = periodRange(req.query);
  const filter = { createdAt: { $gte: start, $lt: end }, ...branchFilter(req) };
  if (req.user.role !== "admin") filter.createdBy = req.user._id;
  const data = await Return.find(filter).sort({ createdAt: -1 }).populate("createdBy", "name");
  res.json({ success: true, summary: { count: data.length, amount: data.reduce((s, r) => s + r.amount, 0) }, data });
}
