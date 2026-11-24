import mongoose from "mongoose";

/** Nasiya (qarzga) oladigan mijozlar */
const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    debt: { type: Number, default: 0 }, // mijoz bizga qancha qarz
    dueDate: { type: Date }, // to'lash muddati
  },
  { timestamps: true }
);

export const Customer = mongoose.model("Customer", customerSchema);
