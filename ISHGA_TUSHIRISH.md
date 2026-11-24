# ULGURJI — ishga tushirish

Loyiha ikki qismdan iborat:

```
sardoba26.uz/
├── Back end/backend     ← server (Node.js + Express + MongoDB)
└── sardoba-stocks.uz    ← sayt (React + Vite)
```

## 1. MongoDB (bir marta)
mongodb.com → **MongoDB Community Server** → Windows, `.msi` → o'rnating.
O'rnatishda **"Install MongoD as a Service"** belgisi turgan bo'lsin.

## 2. Backend (1-terminal)
```powershell
cd "Back end/backend"
npm install
copy .env.example .env
npm run seed        # birinchi marta (namuna ma'lumotlar bilan)
npm run dev
```
Terminalda **"MongoDB ulandi"** va **"Server ishga tushdi"** chiqishi kerak.

## 3. Sayt (2-terminal)
VS Code terminalida **+** bosib yangi terminal oching:
```powershell
cd sardoba-stocks.uz
npm run dev
```
Brauzerda oching: **http://localhost:5173**

## Kirish
| Ism | Login | Rol | Ko'radigan bo'limlar |
|---|---|---|---|
| Anasxon Ganiyev (do'kon egasi) | `anasxon` | Admin | hammasi |
| Otabek | `otabek` | Admin | hammasi |
| Habibullo | `habibullo` | Xodim | Sotuv, Ombor, Xarajatlar, Qaytarish |

Parollar sizga alohida aytilgan.

- `npm run seed` — sinash uchun namuna mahsulot, savdo va xarajatlar bilan
- `npm run seed:toza` — haqiqiy ishni boshlash uchun bo'sh baza (faqat foydalanuvchilar)

## Klaviatura (Sotuv sahifasida)
- **F2** — qidiruvga o'tish (shtrix-kod skaneri bilan ham ishlaydi: Enter bosilganda mahsulot savatga qo'shiladi)
- **F9** — to'lovga o'tish

## Telefonda ochish
Kompyuter va telefon bitta Wi-Fi'da bo'lsa, saytni `npm run dev -- --host` bilan ishga tushiring
va terminalda chiqqan `Network: http://192.168...:5173` manzilni telefonda oching.
