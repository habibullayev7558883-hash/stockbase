import mongoose from "mongoose";
import { env } from "../config/env.js";

export const CURRENCIES = ["UZS", "USD"];

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    unit: { type: String, trim: true, default: "" }, // "50 kg / qop"
    stockUnit: { type: String, trim: true, default: "dona" }, // "qop", "blok", "quti"
    category: { type: String, trim: true, default: "Boshqa" }, // Oziq-ovqat, Ichimliklar, Maishiy
    barcode: { type: String, trim: true },
    label: { type: String, trim: true }, // kartadagi qisqa yozuv: "UN", "COLA"
    color: { type: String, trim: true }, // kartaning rangi: "#F1E3C8"
    quantity: { type: Number, default: 0, min: 0 }, // ombordagi qoldiq
    minQuantity: { type: Number, default: () => env.lowStockDefault, min: 0 }, // shundan kam bo'lsa "kam qoldi"
    costCurrency: { type: String, enum: CURRENCIES, default: "UZS" }, // tovar qaysi valyutada olingan
    costPrice: { type: Number, default: 0, min: 0 }, // 1 dona kelish narxi (costCurrency da)
    sellPrice: { type: Number, default: 0, min: 0 }, // 1 dona sotuv narxi (so'm)
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", barcode: "text" });
productSchema.index({ barcode: 1 }, { unique: true, partialFilterExpression: { barcode: { $type: "string" } } });

export function stockStatus(p) {
  if (p.quantity <= 0) return "tugadi";
  if (p.quantity <= p.minQuantity) return "kam";
  return "yetarli";
}

/** Kelish narxini so'mga o'giradi va dollar kursi o'zgarishi ta'sirini hisoblaydi */
export function withPricing(p, rate, previousRate) {
  const obj = typeof p.toObject === "function" ? p.toObject() : { ...p };
  const isUsd = obj.costCurrency === "USD";
  const costUzs = isUsd ? Math.round(obj.costPrice * rate) : obj.costPrice;
  const change = isUsd && previousRate ? Math.round(obj.costPrice * (rate - previousRate)) : 0;
  return {
    ...obj,
    status: stockStatus(obj),
    costUzs,
    priceChange: {
      amount: change, // 1 dona uchun necha so'mga oshdi (+) yoki tushdi (-)
      percent: isUsd && previousRate ? +(((rate - previousRate) / previousRate) * 100).toFixed(2) : 0,
      reason: isUsd ? "dollar kursi" : null,
    },
    margin: obj.sellPrice - costUzs, // 1 donadan foyda
    stockValueUzs: costUzs * obj.quantity,
  };
}

export const Product = mongoose.model("Product", productSchema);
