export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("ru-RU").replace(/ /g, " ");

export const fmtShort = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, "") + " mlrd";
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, "") + " mln";
  if (Math.abs(v) >= 1e3) return Math.round(v / 1e3) + " ming";
  return String(Math.round(v));
};

export const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
export const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
export const MONTHS_SHORT = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];

export const todayStr = () => new Date().toLocaleDateString("sv"); // YYYY-MM-DD
export const monthStr = () => todayStr().slice(0, 7);

export const longDate = (d = new Date()) => `${d.getDate()} ${MONTHS[d.getMonth()]}, ${WEEKDAYS[d.getDay()]}`;
export const time = (d) => new Date(d).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
export const dateTime = (d) => {
  const x = new Date(d);
  return `${x.getDate()} ${MONTHS_SHORT[x.getMonth()]}, ${time(x)}`;
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Xayrli tong";
  if (h < 18) return "Xayrli kun";
  return "Xayrli kech";
};

export const initials = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

const PALETTE = ["#F1E3C8", "#F5D46A", "#EE6F66", "#B9D3EC", "#C5DCCB", "#CDB7E1", "#EFB977", "#A9DAD3", "#E9E4DA"];
const AVATARS = [
  ["#F3D5BC", "#8A4B1F"], ["#F8DCE3", "#9B3550"], ["#DCE8F6", "#3E6A92"], ["#E6DEF5", "#5B3F86"],
  ["#DDEFE3", "#2F6B45"], ["#FBEACB", "#8C6A2A"],
];
const hash = (s = "") => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export const productColor = (p) => p.color || PALETTE[hash(p._id || p.name) % PALETTE.length];
export const avatarColors = (key) => AVATARS[hash(key) % AVATARS.length];

export const STATUS = {
  yetarli: { label: "Yetarli", cls: "green" },
  kam: { label: "Kam qoldi", cls: "orange" },
  tugadi: { label: "Tugadi", cls: "red" },
};

export const PAY_LABEL = { naqd: "Naqd", karta: "Karta", nasiya: "Nasiya" };
export const SALE_STATUS = {
  yakunlandi: { label: "Yakunlandi", cls: "green" },
  qisman_qaytarilgan: { label: "Qisman qaytarilgan", cls: "orange" },
  qaytarilgan: { label: "Qaytarilgan", cls: "red" },
};

export const CATEGORY_COLORS = {
  Transport: "purple", "Xo'jalik": "orange", "Ta'mirlash": "blue", Kommunal: "red", "Oziq-ovqat": "green", "Ish haqi": "teal", Boshqa: "gray",
};
