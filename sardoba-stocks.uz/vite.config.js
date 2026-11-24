import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // /api so'rovlari backend'ga (http://localhost:5000) yuboriladi
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
