import { useEffect, useState } from "react";

/** Oddiy hash-router: #/sotuv?q=un */
function parse() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, qs = ""] = raw.split("?");
  return { path: path || "/", query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function navigate(path) {
  window.location.hash = path;
}

/** Bo'limlar: yo'l, nom, ikon va ruxsat kaliti */
export const SECTIONS = [
  { key: "dashboard", path: "/", label: "Bosh sahifa", icon: "grid", sub: "Bugungi holat" },
  { key: "sotuv", path: "/sotuv", label: "Sotuv", icon: "cart", sub: "Yangi savdo" },
  { key: "ombor", path: "/ombor", label: "Ombor", icon: "warehouse", sub: "Qoldiq va narxlar" },
  { key: "xarajatlar", path: "/xarajatlar", label: "Xarajatlar", icon: "wallet", sub: "Kim nimaga sarfladi" },
  { key: "hisobotlar", path: "/hisobotlar", label: "Hisobotlar", icon: "chart", sub: "Kunlik va oylik" },
  { key: "taminotchilar", path: "/taminotchilar", label: "Ta'minotchilar", icon: "truck", sub: "Kirim va qarzlar" },
  { key: "qaytarish", path: "/qaytarish", label: "Qaytarish", icon: "undo", sub: "Chekni topish" },
  { key: "xodimlar", path: "/xodimlar", label: "Xodimlar", icon: "users", sub: "Login va parollar" },
];