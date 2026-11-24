import mongoose from "mongoose";

export const EXPENSE_CATEGORIES = ["Transport", "Xo'jalik", "Ta'mirlash", "Kommunal", "Oziq-ovqat", "Ish haqi", "Boshqa"];

const expenseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // kim sarfladi
    category: { type: String, enum: EXPENSE_CATEGORIES, default: "Boshqa" },
    note: { type: String, trim: true, required: true }, // nimaga
    amount: { type: Number, required: true, min: 1 },
    spentAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
  },
  { timestamps: true }
);

expenseSchema.index({ spentAt: -1 });

export const Expense = mongoose.model("Expense", expenseSchema);
