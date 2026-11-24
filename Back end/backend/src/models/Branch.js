import mongoose from "mongoose";

/** Filial (do'kon). Ombor hamma filiallar uchun bitta, sotuv/xarajat/ta'minotchi/hisobot esa har filialda alohida. */
const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Sardoba"
    address: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Branch = mongoose.model("Branch", branchSchema);
