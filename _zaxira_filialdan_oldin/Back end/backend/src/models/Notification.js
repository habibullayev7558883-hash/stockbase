import mongoose from "mongoose";

/** Adminlar uchun bildirishnomalar (masalan: tovar qaytarildi) */
const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, default: "info" }, // return | info
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String }, // frontend yo'li, masalan "/qaytarish"
    data: { type: Object },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
