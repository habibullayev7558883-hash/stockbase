import mongoose from "mongoose";

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // "Chorsu markaziy"
    address: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Branch = mongoose.model("Branch", branchSchema);
