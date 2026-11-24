import { Product, withPricing, ExchangeRate, getRates, CURRENCIES } from "../models/index.js";
import { ApiError, requireFields, toPositiveNumber } from "../utils/ApiError.js";

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/products?search=&category=&status=kam|tugadi|yetarli|oshgan
export async function listProducts(req, res) {
  const { search, category, status } = req.query;
  const { rate, previousRate } = await getRates();

  const all = await Product.find({ isActive: true }).sort({ name: 1 });
  const priced = all.map((p) => withPricing(p, rate, previousRate));

  // Umumiy ko'rsatkichlar (filtrdan oldin)
  const summary = {
    total: priced.length,
    low: priced.filter((p) => p.status === "kam").length,
    out: priced.filter((p) => p.status === "tugadi").length,
    priceUp: priced.filter((p) => p.priceChange.amount > 0).length,
    noPrice: priced.filter((p) => !(p.sellPrice > 0)).length,
    stockValue: priced.reduce((s, p) => s + p.stockValueUzs, 0),
    categories: [...new Set(priced.map((p) => p.category))],
  };

  let data = priced;
  if (search) {
    const re = new RegExp(escapeRe(String(search)), "i");
    data = data.filter((p) => re.test(p.name) || re.test(p.barcode || ""));
  }
  if (category) data = data.filter((p) => p.category === category);
  if (status === "oshgan") data = data.filter((p) => p.priceChange.amount > 0);
  else if (status === "narxsiz") data = data.filter((p) => !(p.sellPrice > 0));
  else if (status) data = data.filter((p) => p.status === status);

  res.json({ success: true, rate: { rate, previousRate }, summary, data });
}

// GET /api/products/alerts — kam qolgan va tugaganlar (ombor holati vidjeti)
export async function stockAlerts(_req, res) {
  const { rate, previousRate } = await getRates();
  const items = (await Product.find({ isActive: true, $expr: { $lte: ["$quantity", "$minQuantity"] } }).sort({ quantity: 1 }))
    .map((p) => withPricing(p, rate, previousRate));
  res.json({
    success: true,
    summary: { low: items.filter((i) => i.status === "kam").length, out: items.filter((i) => i.status === "tugadi").length },
    data: items,
  });
}

// GET /api/products/:id
export async function getProduct(req, res) {
  const p = await Product.findById(req.params.id);
  if (!p) throw ApiError.notFound("Mahsulot topilmadi");
  const { rate, previousRate } = await getRates();
  res.json({ success: true, data: withPricing(p, rate, previousRate) });
}

// GET /api/products/barcode/:code — shtrix-kod bo'yicha (sotuv terminali)
export async function getByBarcode(req, res) {
  const p = await Product.findOne({ barcode: req.params.code, isActive: true });
  if (!p) throw ApiError.notFound("Bu shtrix-kod bilan mahsulot topilmadi");
  const { rate, previousRate } = await getRates();
  res.json({ success: true, data: withPricing(p, rate, previousRate) });
}

const EDITABLE = ["name", "unit", "stockUnit", "category", "barcode", "label", "color", "quantity", "minQuantity", "costCurrency", "costPrice", "sellPrice", "branch", "isActive"];

function pick(body) {
  const out = {};
  for (const k of EDITABLE) if (body[k] !== undefined) out[k] = body[k];
  if (out.costCurrency && !CURRENCIES.includes(out.costCurrency)) throw ApiError.badRequest("Valyuta UZS yoki USD bo'lishi kerak");
  return out;
}

// POST /api/products
export async function createProduct(req, res) {
  requireFields(req.body, ["name"]);
  const p = await Product.create(pick(req.body));
  const { rate, previousRate } = await getRates();
  res.status(201).json({ success: true, data: withPricing(p, rate, previousRate) });
}

// PUT /api/products/:id
export async function updateProduct(req, res) {
  const data = pick(req.body);
  // Xodim mavjud tovar qoldig'ini qo'lda o'zgartira olmaydi (faqat kirim/sotuv orqali) va arxivlay olmaydi
  if (req.user.role !== "admin") {
    delete data.quantity;
    delete data.isActive;
  }
  const p = await Product.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  if (!p) throw ApiError.notFound("Mahsulot topilmadi");
  const { rate, previousRate } = await getRates();
  res.json({ success: true, data: withPricing(p, rate, previousRate) });
}

// PATCH /api/products/:id/stock  { quantity, mode: "add" | "set" }  — inventarizatsiya
export async function adjustStock(req, res) {
  const qty = toPositiveNumber(req.body.quantity, "Miqdor");
  const mode = req.body.mode === "set" ? "set" : "add";
  const update = mode === "set" ? { $set: { quantity: qty } } : { $inc: { quantity: qty } };
  const p = await Product.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!p) throw ApiError.notFound("Mahsulot topilmadi");
  const { rate, previousRate } = await getRates();
  res.json({ success: true, data: withPricing(p, rate, previousRate) });
}

// DELETE /api/products/:id (arxivlash)
export async function deleteProduct(req, res) {
  const p = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!p) throw ApiError.notFound("Mahsulot topilmadi");
  res.json({ success: true, message: "Mahsulot arxivlandi" });
}

// ---------- Dollar kursi ----------

// GET /api/rates/current
export async function currentRate(_req, res) {
  const { rate, previousRate, updatedAt } = await getRates();
  const affected = await Product.countDocuments({ isActive: true, costCurrency: "USD" });
  res.json({
    success: true,
    data: {
      rate,
      previousRate,
      change: rate - previousRate,
      percent: previousRate ? +(((rate - previousRate) / previousRate) * 100).toFixed(2) : 0,
      affectedProducts: affected,
      updatedAt,
    },
  });
}

// POST /api/rates  { rate }  — yangi kurs kiritish va ta'sirini ko'rsatish
export async function setRate(req, res) {
  requireFields(req.body, ["rate"]);
  const newRate = toPositiveNumber(req.body.rate, "Kurs");
  if (newRate < 1) throw ApiError.badRequest("Kurs noto'g'ri");
  const { rate: oldRate } = await getRates();
  const rec = await ExchangeRate.create({ rate: newRate, previousRate: oldRate, setBy: req.user._id });

  const usd = await Product.find({ isActive: true, costCurrency: "USD" }).sort({ name: 1 }).lean();
  const impact = usd.map((p) => {
    const oldCost = Math.round(p.costPrice * oldRate);
    const newCost = Math.round(p.costPrice * newRate);
    return {
      _id: p._id,
      name: p.name,
      costUsd: p.costPrice,
      oldCostUzs: oldCost,
      newCostUzs: newCost,
      changePerUnit: newCost - oldCost,
      quantity: p.quantity,
      totalChange: (newCost - oldCost) * p.quantity,
      sellPrice: p.sellPrice,
      marginAfter: p.sellPrice - newCost,
    };
  });
  res.status(201).json({
    success: true,
    data: {
      rate: rec.rate,
      previousRate: oldRate,
      change: rec.rate - oldRate,
      percent: +(((rec.rate - oldRate) / oldRate) * 100).toFixed(2),
      totalStockValueChange: impact.reduce((s, i) => s + i.totalChange, 0),
      impact,
    },
  });
}

// GET /api/rates/history
export async function rateHistory(_req, res) {
  const data = await ExchangeRate.find().sort({ createdAt: -1 }).limit(60).populate("setBy", "name");
  res.json({ success: true, data });
}
