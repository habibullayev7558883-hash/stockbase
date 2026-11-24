import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
export const Counter = mongoose.model("Counter", counterSchema);

/** Ketma-ket raqam (chek raqami uchun) */
export async function nextSeq(name, start = 10000) {
  await Counter.updateOne({ _id: name }, { $setOnInsert: { seq: start } }, { upsert: true });
  const c = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { new: true });
  return c.seq;
}
