import mongoose from "mongoose";

const rateSchema = new mongoose.Schema(
  {
    rate: { type: Number, required: true, min: 1 }, // 1 $ = ? so'm
    previousRate: { type: Number },
    setBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const ExchangeRate = mongoose.model("ExchangeRate", rateSchema);

/** Joriy va oldingi kursni qaytaradi */
export async function getRates() {
  const last = await ExchangeRate.findOne().sort({ createdAt: -1 }).lean();
  if (!last) return { rate: 12850, previousRate: 12850, updatedAt: null };
  return { rate: last.rate, previousRate: last.previousRate ?? last.rate, updatedAt: last.createdAt };
}
