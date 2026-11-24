/**
 * Zaxiradan tiklash:   npm run restore            (eng oxirgi zaxira)
 *                      npm run restore -- 2026-11-13_09-30   (aniq zaxira)
 * DIQQAT: bazadagi hozirgi ma'lumotlar zaxiradagi bilan almashtiriladi.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";

const { EJSON } = mongoose.mongo.BSON;
const BACKUP_DIR = process.env.BACKUP_DIR || (process.platform === "win32" ? "D:/MongoDB/backup" : "./backups");

try {
  if (!fs.existsSync(BACKUP_DIR)) throw new Error(`Zaxira papkasi topilmadi: ${BACKUP_DIR}`);
  const all = fs.readdirSync(BACKUP_DIR).filter((d) => /^\d{4}-\d{2}-\d{2}_/.test(d)).sort();
  if (!all.length) throw new Error("Hali birorta zaxira yo'q");
  const pick = process.argv[2] || all[all.length - 1];
  const dir = path.join(BACKUP_DIR, pick);
  if (!fs.existsSync(dir)) throw new Error(`Bunday zaxira yo'q: ${pick}. Mavjudlari: ${all.slice(-10).join(", ")}`);

  console.log(`\nTiklanadigan zaxira: ${pick}`);
  console.log("Bazadagi HOZIRGI ma'lumotlar shu zaxiradagi bilan almashtiriladi.");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question("Tasdiqlash uchun HA deb yozing: ")).trim();
  rl.close();
  if (ans !== "HA") {
    console.log("✋ Bekor qilindi.");
    process.exit(0);
  }

  await connectDB();
  const db = mongoose.connection.db;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const name = file.replace(/\.json$/, "");
    const docs = EJSON.parse(fs.readFileSync(path.join(dir, file), "utf8"), { relaxed: false });
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs);
    console.log(`  ✔ ${name}: ${docs.length}`);
  }
  console.log(`✅ Zaxiradan tiklandi: ${pick}`);
} catch (e) {
  console.error("❌ Tiklab bo'lmadi:", e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
