import { Branch, Counter, Sale, Return, Expense, Supplier, SupplierPayment, SupplyInvoice, User } from "../models/index.js";

/**
 * Server ishga tushganda:
 * 1) Bir marta: eski "Chorsu markaziy" filiali "Sardoba" ga aylanadi va ikkinchi do'kon "Sardoba 2" qo'shiladi.
 * 2) Har safar: filiali yo'q eski yozuvlar (sotuv, xarajat, ta'minotchi...) birinchi filialga biriktiriladi.
 */
export async function ensureBranches() {
  let branches = await Branch.find().sort({ createdAt: 1 });

  if (!(await Counter.exists({ _id: "migr_branches_v1" }))) {
    if (!branches.length) branches = [await Branch.create({ name: "Sardoba" })];
    else if (branches[0].name === "Chorsu markaziy") {
      branches[0].name = "Sardoba";
      branches[0].address = undefined;
      await branches[0].save();
    }
    if (branches.filter((b) => b.isActive !== false).length < 2) branches.push(await Branch.create({ name: "Sardoba 2" }));
    await Counter.create({ _id: "migr_branches_v1", seq: 1 });
    console.log("🏪 Filiallar sozlandi: " + branches.map((b) => b.name).join(", "));
  }

  let first = await Branch.findOne({ isActive: { $ne: false } }).sort({ createdAt: 1 });
  if (!first) first = await Branch.create({ name: "Sardoba" });

  const none = { $or: [{ branch: { $exists: false } }, { branch: null }] };
  for (const M of [Sale, Return, Expense, Supplier, SupplierPayment, SupplyInvoice, User]) {
    await M.updateMany(none, { $set: { branch: first._id } });
  }
}
