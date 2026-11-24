import dotenv from "dotenv";
dotenv.config({ quiet: true });

const tz = process.env.TZ_OFFSET || "+05:00";
const sign = tz.startsWith("-") ? -1 : 1;
const [h, m] = tz.replace(/^[+-]/, "").split(":").map(Number);

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/sardoba",
  jwtSecret: process.env.JWT_SECRET || "dev_secret_change_me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrls: (process.env.CLIENT_URL || "http://localhost:5173").split(",").map((s) => s.trim()),
  tz, // MongoDB aggregation uchun: "+05:00"
  tzOffsetMs: sign * ((h || 0) * 60 + (m || 0)) * 60 * 1000,
  lowStockDefault: Number(process.env.LOW_STOCK_DEFAULT) || 15,
};
