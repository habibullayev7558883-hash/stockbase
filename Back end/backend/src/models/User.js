import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const ROLES = ["admin", "xodim"];

/** Har bir rol menyuda qaysi bo'limlarni ko'radi */
export const PERMISSIONS = {
  admin: ["dashboard", "sotuv", "ombor", "xarajatlar", "hisobotlar", "taminotchilar", "qaytarish", "xodimlar"],
  xodim: ["sotuv", "ombor", "xarajatlar", "taminotchilar", "qaytarish"],
};

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // to'liq ism (ko'rsatish uchun)
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    age: { type: Number, min: 14, max: 100 },
    address: { type: String, trim: true }, // uy manzili
    login: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ROLES, default: "xodim" },
    position: { type: String, default: "Sotuvchi", trim: true }, // Kassir, Omborchi, Haydovchi...
    phone: { type: String, trim: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toPublic = function () {
  return {
    _id: this._id,
    name: this.name,
    firstName: this.firstName,
    lastName: this.lastName,
    age: this.age,
    address: this.address,
    login: this.login,
    role: this.role,
    position: this.position,
    phone: this.phone,
    branch: this.branch,
    isActive: this.isActive,
    createdAt: this.createdAt,
    permissions: PERMISSIONS[this.role] || [],
  };
};

export const User = mongoose.model("User", userSchema);
