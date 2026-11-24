import mongoose from "mongoose";
import { Product, Sale, Customer, getRates, nextSeq, PAYMENT_TYPES } from "../models/index.js";
import { ApiError, toPositiveNumber } from "../utils/ApiError.js";
import { periodRange } from "../utils/dates.js";

/**
 * POST /api/sales
 * { items: [{ product, quantity }], paymentType: "naqd"|"karta"|"nasiya", discount?, customer?, customerName? }
 */
export async function createSale(req, res) {
  const { items, paymentType = "naqd", customer, customerName } = req.body;
  if (!Array.isArray(items) || !items.length) throw ApiError.badRequest("Savat bo'sh");
  if (!PAYMENT_TYPES.includes(paymentType)) throw ApiError.badRequest("To'lov turi: naqd, karta yoki nasiya");
  const discount = toPositiveNumber(req.body.discount || 0, "Chegirma");

  // Bir xil mahsulotlarni birlashtiramiz
  const merged = new Map();
  for (const it of items) {
    if (!mongoose.isValidObjectId(it.product)) throw ApiError.badRequest("Mahsulot ID noto'g'ri");
    const q = toPositiveNumber(it.quantity, "Miqdor");
    if (q <= 0) throw ApiError.badRequest("Miqdor 0 dan katta bo'lishi kerak");
    merged.set(String(it.product), (merged.get(String(it.product)) || 0) + q);
  }

  const products = await Product.find({ _id: { $in: [...merged.keys()] }, isActive: true });
  if (products.length !== merged.size) throw ApiError.badRequest("Ba'zi mahsulotlar topilmadi yoki arxivlangan");

  let cust = null;
  if (paymentType === "nasiya") {
    if (!customer) throw ApiError.badRequest("Nasiya uchun mijozni tanlang");
    cust = await Customer.findById(customer);
    if (!cust) throw ApiError.notFound("Mijoz topilmadi");
  }

  const { rate } = await getRates();
  const decremented = [];
  const rollback = () =>
    Promise.all(decremented.map(([id, q]) => Product.updateOne({ _id: id }, { $inc: { quantity: q } })));

  try {
    // Narxi kiritilmagan tovarni sotib bo'lmaydi
    const noPrice = products.find((p) => !(p.sellPrice > 0));
    if (noPrice) throw ApiError.badRequest(`"${noPrice.name}" ning sotuv narxi kiritilmagan (Ombor bo'limida kiriting)`);

    // Ombordan atomar ayiramiz (yetmasa — xato)
    for (const p of products) {
      const q = merged.get(String(p._id));
      const ok = await Product.findOneAndUpdate({ _id: p._id, quantity: { $gte: q } }, { $inc: { quantity: -q } });
      if (!ok) throw ApiError.badRequest(`"${p.name}" omborda yetarli emas (qoldiq: ${p.quantity} ${p.stockUnit})`);
      decremented.push([p._id, q]);
    }

    const saleItems = products.map((p) => {
      const q = merged.get(String(p._id));
      const cost = p.costCurrency === "USD" ? Math.round(p.costPrice * rate) : p.costPrice;
      return { product: p._id, name: p.name, barcode: p.barcode, unit: p.stockUnit, quantity: q, price: p.sellPrice, costPrice: cost, total: Math.round(p.sellPrice * q) };
    });
    const subtotal = saleItems.reduce((s, i) => s + i.total, 0);
    if (discount > subtotal) throw ApiError.badRequest("Chegirma summadan katta bo'lishi mumkin emas");
    const total = subtotal - discount;

    const sale = await Sale.create({
      receiptNo: await nextSeq("receipt"),
      items: saleItems,
      subtotal,
      discount,
      total,
      paymentType,
      customer: cust?._id,
      customerName: cust?.name || customerName || "Naqd savdo",
      cashier: req.user._id,
      branch: req.user.branch,
    });

    if (cust) await Customer.updateOne({ _id: cust._id }, { $inc: { debt: total } });

    await sale.populate("cashier", "name position");
    res.status(201).json({ success: true, message: "To'lov yakunlandi", data: sale });
  } catch (err) {
    await rollback();
    throw err;
  }
}

/**
 * GET /api/sales?period=today|week|month&date=&from=&to=&paymentType=&cashier=&limit=
 * Xodim faqat o'zining savdolarini ko'radi.
 */
export async function listSales(req, res) {
  const { start, end } = periodRange(req.query);
  const filter = { createdAt: { $gte: start, $lt: end } };
  if (req.query.paymentType) filter.paymentType = req.query.paymentType;
  if (req.user.role !== "admin") filter.cashier = req.user._id;
  else if (req.query.cashier) filter.cashier = req.query.cashier;

  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const [data, agg] = await Promise.all([
    Sale.find(filter).sort({ createdAt: -1 }).limit(limit).populate("cashier", "name position"),
    Sale.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: { $subtract: ["$total", "$returnedAmount"] } }, count: { $sum: 1 } } },
    ]),
  ]);
  res.json({ success: true, summary: { total: agg[0]?.total || 0, count: agg[0]?.count || 0 }, data });
}

// GET /api/sales/:id
export async function getSale(req, res) {
  const sale = await Sale.findById(req.params.id).populate("cashier", "name position").populate("customer", "name phone");
  if (!sale) throw ApiError.notFound("Chek topilmadi");
  if (req.user.role !== "admin" && String(sale.cashier._id) !== String(req.user._id)) throw ApiError.forbidden();
  res.json({ success: true, data: sale });
}
