import mongoose from "mongoose";

const returnSchema = new mongoose.Schema(
  {
    sale: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true },
    receiptNo: { type: Number },
    items: [
      {
        _id: false,
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        name: String,
        quantity: Number,
        price: Number,
        total: Number,
      },
    ],
    amount: { type: Number, required: true }, // mijozga qaytarilgan pul
    paymentType: { type: String },
    reason: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
  },
  { timestamps: true }
);

returnSchema.index({ createdAt: -1 });

export const Return = mongoose.model("Return", returnSchema);
