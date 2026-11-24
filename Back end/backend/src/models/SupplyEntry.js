import mongoose from "mongoose";

/**
 * Kirim nakladnoyi: bitta ta'minotchidan bir martada olingan tovarlar ro'yxati.
 * Har bir qator omborga qo'shiladi, to'lanmagan qismi ta'minotchi qarziga yoziladi.
 */
const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, default: "dona" }, // qop, blok, quti, kg...
    unitPrice: { type: Number, required: true, min: 0 }, // nakladnoy valyutasida
    total: { type: Number, required: true }, // nakladnoy valyutasida
    isNewProduct: { type: Boolean, default: false }, // omborda yo'q edi — yangi yaratildi
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNo: { type: Number, unique: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    supplierName: { type: String },
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    currency: { type: String, enum: ["UZS", "USD"], default: "UZS" },
    rate: { type: Number }, // USD bo'lsa o'sha paytdagi kurs
    totalCurrency: { type: Number, required: true }, // nakladnoy valyutasida jami
    total: { type: Number, required: true }, // so'mda jami
    paid: { type: Number, default: 0 }, // so'mda to'langan
    debt: { type: Number, default: 0 }, // so'mda qarzga qolgan
    note: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
  },
  { timestamps: true }
);

invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ supplier: 1, createdAt: -1 });

export const SupplyInvoice = mongoose.model("SupplyInvoice", invoiceSchema);
