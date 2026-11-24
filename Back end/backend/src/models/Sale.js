import mongoose from "mongoose";

export const PAYMENT_TYPES = ["naqd", "karta", "nasiya"];

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    barcode: { type: String }, // mahsulot shtrix-kodi (sotuv paytida)
    unit: { type: String },
    quantity: { type: Number, required: true, min: 0.001 },
    price: { type: Number, required: true }, // 1 dona sotuv narxi
    costPrice: { type: Number, default: 0 }, // 1 dona tannarx (so'mda, sotuv paytida)
    total: { type: Number, required: true },
    returnedQuantity: { type: Number, default: 0 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    receiptNo: { type: Number, unique: true }, // #10428
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    returnedAmount: { type: Number, default: 0 },
    paymentType: { type: String, enum: PAYMENT_TYPES, default: "naqd" },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customerName: { type: String, default: "Naqd savdo" },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    status: { type: String, enum: ["yakunlandi", "qisman_qaytarilgan", "qaytarilgan"], default: "yakunlandi" },
  },
  { timestamps: true }
);

saleSchema.index({ createdAt: -1 });
saleSchema.index({ cashier: 1, createdAt: -1 });

export const Sale = mongoose.model("Sale", saleSchema);
