/**
 * Zaxira nusxa:   npm run backup
 * Barcha ma'lumotlar BACKUP_DIR/<sana_soat>/ papkasiga JSON qilib saqlanadi.
 * Oxirgi 30 ta zaxira saqlanadi, eskilari o'chiriladi.
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";

const { EJSON } = mongoose.mongo.BSON;
export const BACKUP_DIR = process.env.BACKUP_DIR || (process.platform === "win32" ? "D:/MongoDB/backup" : "./backups");
const KEEP = 30;

try {
  await connectDB();
  const stamp = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
  const dir = path.join(BACKUP_DIR, stamp);
  fs.mkdirSync(dir, { recursive: true });

  const cols = await mongoose.connection.db.listCollections().toArray();
  let total = 0;
  for (const { name } of cols) {
    const docs = await mongoose.connection.db.collection(name).find().toArray();
    fs.writeFileSync(path.join(dir, `${name}.json`), EJSON.stringify(docs, { relaxed: false }));
    total += docs.length;
  }
  console.log(`💾 Zaxira olindi: ${dir} (${cols.length} jadval, ${total} yozuv)`);

  // Eski zaxiralarni tozalash
  const all = fs.readdirSync(BACKUP_DIR).filter((d) => /^\d{4}-\d{2}-\d{2}_/.test(d)).sort();
  for (const old of all.slice(0, Math.max(0, all.length - KEEP))) fs.rmSync(path.join(BACKUP_DIR, old), { recursive: true, force: true });
} catch (e) {
  console.error("❌ Zaxira olinmadi:", e.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
