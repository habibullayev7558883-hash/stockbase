import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Baraka Trade"
    phone: { type: String, trim: true },
    note: { type: String, trim: true },
    debt: { type: Number, default: 0 }, // biz unga qancha qarzmiz
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Supplier = mongoose.model("Supplier", supplierSchema);

/** Ta'minotchiga qilingan to'lovlar (qarzni yopish) */
const paymentSchema = new mongoose.Schema(
  {
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    amount: { type: Number, required: true, min: 1 },
    note: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const SupplierPayment = mongoose.model("SupplierPayment", paymentSchema);
