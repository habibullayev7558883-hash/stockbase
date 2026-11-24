/**
 * Namuna ma'lumotlar bilan bazani to'ldirish:  npm run seed
 * DIQQAT: bazadagi barcha eski ma'lumotlar o'chiriladi!
 */
import mongoose from "mongoose";
import readline from "node:readline/promises";
import { connectDB } from "./config/db.js";
import {
  User, Branch, Product, ExchangeRate, Supplier, SupplyInvoice, Sale, Return, Expense, Customer, Counter, SupplierPayment, Notification, nextSeq,
} from "./models/index.js";

const RATE_OLD = 12700, RATE = 12850;

export async function seed({ withSales = true, toza = false } = {}) {
  await Promise.all(
    [User, Branch, Product, ExchangeRate, Supplier, SupplyInvoice, Sale, Return, Expense, Customer, Counter, SupplierPayment, Notification].map((m) => m.deleteMany({}))
  );

  const branch = await Branch.create({ name: "Chorsu markaziy", address: "Toshkent, Chorsu bozori" });

  const mk = (name, login, role, position, password = "123456") => {
    const [firstName, ...rest] = name.split(" ");
    return new User({ name, firstName, lastName: rest.join(" ") || undefined, login, password, role, position, branch: branch._id }).save();
  };
  // Haqiqiy foydalanuvchilar
  const admin = await mk("Anasxon Ganiyev", "anasxon", "admin", "Do'kon egasi", "anasxon1985Aa");
  const otabek = await mk("Otabek", "otabek", "admin", "Administrator", "otabek2010");
  const habibullo = await mk("Habibullo", "habibullo", "xodim", "Sotuvchi", "habibullo0053");
  // Namuna savdo/xarajatlar shu uch kishiga yoziladi
  const dilnoza = habibullo, sardor = otabek, malika = habibullo, jasur = habibullo, bekzod = otabek;

  await ExchangeRate.create({ rate: RATE_OLD, previousRate: RATE_OLD, setBy: admin._id, createdAt: new Date(Date.now() - 86400000) });
  await ExchangeRate.create({ rate: RATE, previousRate: RATE_OLD, setBy: admin._id });

  // --toza: faqat foydalanuvchilar, filial va kurs (mahsulot, savdo, xarajat yo'q)
  if (toza) return { admin, branch };

  const P = (name, unit, stockUnit, category, quantity, costCurrency, costPrice, sellPrice, label, color, barcode) =>
    ({ name, unit, stockUnit, category, quantity, costCurrency, costPrice, sellPrice, label, color, barcode, branch: branch._id });
  const products = await Product.insertMany([
    P("Oliy navli un", "50 kg / qop", "qop", "Oziq-ovqat", 120, "USD", 18.5, 286000, "UN", "#F1E3C8", "4780000000011"),
    P("Paxta yog'i", "5 L / dona", "dona", "Oziq-ovqat", 48, "USD", 5.4, 89000, "YOG'", "#F5D46A", "4780000000028"),
    P("Coca-Cola", "1.5 L / blok", "blok", "Ichimliklar", 5, "USD", 7.2, 116000, "COLA", "#EE6F66", "5449000000996"),
    P("Lazer guruch", "25 kg / qop", "qop", "Oziq-ovqat", 86, "USD", 26, 412000, "GURUCH", "#B9D3EC", "4780000000035"),
    P("Qora choy", "100 g / blok", "blok", "Ichimliklar", 0, "USD", 4.1, 73000, "CHOY", "#C5DCCB", "4780000000042"),
    P("Artel salfetka", "24 dona / blok", "blok", "Maishiy", 32, "UZS", 38000, 54000, "SOFT", "#CDB7E1", "4780000000059"),
    P("Makaron", "20 kg / quti", "quti", "Oziq-ovqat", 14, "USD", 11.2, 178000, "PASTA", "#EFB977", "4780000000066"),
    P("Kir sovuni", "60 dona / quti", "quti", "Maishiy", 64, "USD", 12.4, 195000, "SOAP", "#A9DAD3", "4780000000073"),
    P("Shakar", "50 kg / qop", "qop", "Oziq-ovqat", 0, "UZS", 384000, 430000, "SHAKAR", "#E9E4DA", "4780000000080"),
  ]);

  const [baraka, oltin, cola, sardorU] = await Supplier.insertMany([
    { name: "Baraka Trade", phone: "+998 90 123 45 67", debt: 6200000 },
    { name: "Oltin Don MChJ", phone: "+998 93 555 12 30", debt: 4150000 },
    { name: "Coca-Cola Ichimliklari", phone: "+998 71 200 30 40", debt: 0 },
    { name: "Sardor ulgurji", phone: "+998 97 410 88 09", debt: 2480000 },
  ]);

  await Customer.insertMany([
    { name: "Baraka Market", phone: "+998 90 111 22 33", debt: 0 },
    { name: "Nodira Opa", phone: "+998 94 222 33 44", debt: 1214000, dueDate: new Date(Date.now() - 3 * 86400000) },
    { name: "Sardor Savdo", phone: "+998 99 333 44 55", debt: 0 },
  ]);

  if (withSales) {
    // Oxirgi 7 kunlik namunaviy savdolar
    const cashiers = [dilnoza, dilnoza, admin, sardor, malika];
    const sellable = products.filter((p) => p.quantity > 0);
    let seedRand = 7;
    const rnd = () => ((seedRand = (seedRand * 9301 + 49297) % 233280) / 233280);
    for (let day = 6; day >= 0; day--) {
      const n = 6 + Math.floor(rnd() * 6);
      for (let i = 0; i < n; i++) {
        const when = new Date(Date.now() - day * 86400000 - Math.floor(rnd() * 8) * 3600000 - Math.floor(rnd() * 59) * 60000);
        const picks = [sellable[Math.floor(rnd() * sellable.length)], sellable[Math.floor(rnd() * sellable.length)]];
        const items = [...new Map(picks.map((p) => [String(p._id), p])).values()].map((p) => {
          const q = 1 + Math.floor(rnd() * 3);
          const cost = p.costCurrency === "USD" ? Math.round(p.costPrice * RATE) : p.costPrice;
          return { product: p._id, name: p.name, quantity: q, price: p.sellPrice, costPrice: cost, total: p.sellPrice * q };
        });
        const total = items.reduce((s, x) => s + x.total, 0);
        const paymentType = ["naqd", "naqd", "karta", "naqd", "karta"][Math.floor(rnd() * 5)];
        await Sale.create({
          receiptNo: await nextSeq("receipt"), items, subtotal: total, total, paymentType,
          customerName: "Naqd savdo", cashier: cashiers[Math.floor(rnd() * cashiers.length)]._id, branch: branch._id,
          createdAt: when, updatedAt: when,
        });
      }
    }

    // Bugungi xarajatlar
    const today = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
    await Expense.insertMany([
      { user: jasur._id, category: "Transport", note: "Yetkazib berish uchun benzin", amount: 180000, spentAt: today(14, 52), createdBy: jasur._id },
      { user: dilnoza._id, category: "Xo'jalik", note: "Kassa lentasi va paketlar", amount: 95000, spentAt: today(13, 40), createdBy: dilnoza._id },
      { user: bekzod._id, category: "Ta'mirlash", note: "Ombordagi javonni tuzatish", amount: 250000, spentAt: today(12, 15), createdBy: bekzod._id },
      { user: jasur._id, category: "Transport", note: "Yuk tashish — Chorsu bozori", amount: 300000, spentAt: today(11, 30), createdBy: jasur._id },
      { user: admin._id, category: "Kommunal", note: "Elektr energiya to'lovi", amount: 320000, spentAt: today(10, 5), createdBy: admin._id },
      { user: dilnoza._id, category: "Oziq-ovqat", note: "Xodimlar tushligi", amount: 100000, spentAt: today(9, 20), createdBy: dilnoza._id },
    ]);

    // Bugungi kirim nakladnoylari (ombor va qarzga allaqachon kiritilgan holat)
    const byName = Object.fromEntries(products.map((p) => [p.name, p]));
    const L = (name, quantity, unitPrice) => ({ product: byName[name]._id, name, quantity, unit: byName[name].stockUnit, unitPrice, total: quantity * unitPrice });
    const INV = async (sup, lines, paid, minsAgo) => {
      const total = lines.reduce((a, l) => a + l.total, 0);
      const when = new Date(Date.now() - minsAgo * 60000);
      await SupplyInvoice.create({
        invoiceNo: await nextSeq("supply", 1000), supplier: sup._id, supplierName: sup.name, items: lines, currency: "UZS",
        totalCurrency: total, total, paid, debt: total - paid, createdBy: admin._id, createdAt: when, updatedAt: when,
      });
    };
    await INV(sardorU, [L("Makaron", 8, 143750)], 500000, 40);
    await INV(oltin, [L("Lazer guruch", 6, 390000), L("Shakar", 5, 384000)], 3340000, 30);
    await INV(cola, [L("Coca-Cola", 20, 93000)], 1860000, 15);
    await INV(baraka, [L("Oliy navli un", 10, 238000), L("Paxta yog'i", 30, 69000), L("Kir sovuni", 4, 160000)], 3140000, 5);
  }

  return { admin, branch };
}

// To'g'ridan-to'g'ri ishga tushirilganda
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("seed.js")) {
  try {
    await connectDB();
    const toza = process.argv.includes("--toza");
    // Himoya: bazada ma'lumot bo'lsa, tasdiq so'raymiz
    const existing = (await User.countDocuments()) + (await Product.countDocuments()) + (await Sale.countDocuments());
    if (existing > 0 && !process.argv.includes("--majburiy")) {
      console.log("\n⚠️  DIQQAT! Bazada ma'lumotlar bor:");
      console.log(`   mahsulotlar: ${await Product.countDocuments()}, savdolar: ${await Sale.countDocuments()}, xarajatlar: ${await Expense.countDocuments()}`);
      console.log("   Davom etsangiz, HAMMASI O'CHIB KETADI va qaytadan yoziladi.");
      console.log("   (Avval zaxira olish uchun: npm run backup)\n");
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ans = (await rl.question('   Rostdan ham o\'chirilsinmi? Tasdiqlash uchun HA deb yozing: ')).trim();
      rl.close();
      if (ans !== "HA") {
        console.log("\n✋ Bekor qilindi. Hech narsa o'chirilmadi.");
        process.exit(0);
      }
    }
    await seed({ toza });
    console.log(toza ? "✅ Toza baza tayyor (faqat foydalanuvchilar)." : "✅ Namuna ma'lumotlar qo'shildi.");
    console.log("   Admin:  anasxon, otabek");
    console.log("   Xodim:  habibullo");
  } catch (e) {
    console.error("❌ Seed xatosi:", e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
