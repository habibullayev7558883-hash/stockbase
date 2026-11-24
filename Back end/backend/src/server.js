import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { ensureBranches } from "./config/migrate.js";
import { createApp } from "./app.js";

try {
  await connectDB();
  await ensureBranches();
  const app = createApp();
  app.listen(env.port, () => console.log(`🚀 Server ishga tushdi: http://localhost:${env.port}/api`));
} catch (err) {
  console.error("❌ Serverni ishga tushirib bo'lmadi:", err.message);
  process.exit(1);
}
