# ULGURJI — Backend (Node.js + Express + MongoDB)

Savdo boshqaruvi tizimi uchun REST API: sotuv, ombor (dollar kursi bilan), xarajatlar, hisobotlar, ta'minotchilar va qaytarish.
**Admin** va **Xodim** rollari bor.

## O'rnatish

```bash
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run seed              # namuna ma'lumotlar (bazani tozalaydi!)
npm run dev               # http://localhost:5000/api
```

Kerak bo'ladi: **Node.js 20+** va **MongoDB** (lokal `mongod` yoki MongoDB Atlas). `.env` faylidagi `MONGO_URI` ni o'zingiznikiga o'zgartiring.

Foydalanuvchilar (seed'dan keyin):

| Ism | Login | Rol |
|---|---|---|
| Anasxon Ganiyev (do'kon egasi) | `anasxon` | Admin |
| Otabek | `otabek` | Admin |
| Habibullo | `habibullo` | Xodim |

- `npm run seed` — foydalanuvchilar + namuna mahsulot, savdo va xarajatlar (sinash uchun)
- `npm run seed:toza` — faqat foydalanuvchilar, bo'sh baza (haqiqiy ish uchun)

⚠️ Ikkala buyruq ham bazadagi ma'lumotlarni o'chiradi. Bazada ma'lumot bo'lsa, avval **HA** deb tasdiqlash so'raladi.

## Zaxira nusxa (backup)

- `npm run backup` — butun bazani `D:\MongoDB\backup\<sana_soat>\` ga saqlaydi (oxirgi 30 tasi qoladi)
- `npm run restore` — eng oxirgi zaxiradan tiklaydi (`npm run restore -- 2026-11-13_09-30` — aniq zaxiradan)

`ISHGA_TUSHIRISH.bat` har ishga tushganda avtomatik zaxira oladi.

## Rollar va bo'limlar

| Bo'lim         | Admin | Xodim |
|----------------|:-----:|:-----:|
| Bosh sahifa    | ✅ | ❌ |
| Sotuv          | ✅ | ✅ |
| Ombor          | ✅ (o'zgartirish ham) | ✅ (faqat ko'rish) |
| Xarajatlar     | ✅ (hammasini ko'radi) | ✅ (faqat o'zinikini) |
| Hisobotlar     | ✅ | ❌ |
| Ta'minotchilar | ✅ | ❌ |
| Qaytarish      | ✅ | ✅ |

Login javobidagi `user.permissions` massivi frontend menyusida qaysi bo'limni ko'rsatishni aytadi:
```json
"permissions": ["sotuv", "ombor", "xarajatlar", "qaytarish"]
```

## So'rov formati

- Har bir so'rovda (login'dan tashqari): `Authorization: Bearer <token>`
- Javob: `{ "success": true, "data": ..., "summary": ... }`
- Xato:  `{ "success": false, "message": "..." }` (400, 401, 403, 404, 409)
- Sanalar Toshkent vaqti bo'yicha: `date=YYYY-MM-DD`, `month=YYYY-MM`
- Davr: `period=today | week | month` yoki `from=...&to=...`

## API

### Auth va xodimlar
| Metod | Yo'l | Izoh |
|---|---|---|
| POST | `/api/auth/login` | `{ login, password }` → `token`, `user` (permissions bilan) |
| GET | `/api/auth/me` | joriy foydalanuvchi |
| GET/POST | `/api/users` | xodimlar ro'yxati / yangi xodim *(admin)* |
| PUT/DELETE | `/api/users/:id` | tahrirlash / bloklash *(admin)* |

### Bosh sahifa va hisobotlar *(admin)*
| GET | `/api/dashboard` | bugungi va haftalik savdo, kassadagi pul, qarzdorlik, 30 kunlik grafik, ombor holati, so'nggi savdolar |
|---|---|---|
| GET | `/api/reports/daily?date=` | **kunlik**: savdo, cheklar, o'rtacha chek, sof foyda, soatlar bo'yicha, to'lov turlari, **xodimlar qancha savdo qildi** |
| GET | `/api/reports/monthly?month=` | **oylik**: jami, kunlar bo'yicha, xodimlar, xarajat turlari, oxirgi 6 oy |

### Ombor va dollar kursi
| GET | `/api/products?search=&category=&status=kam\|tugadi\|yetarli\|oshgan` | qoldiq, holat, `costUzs`, **`priceChange`** (dollar oshgani uchun 1 dona qanchaga qimmatlashgani) |
|---|---|---|
| GET | `/api/products/alerts` | kam qolgan va tugaganlar |
| GET | `/api/products/barcode/:code` | shtrix-kod bo'yicha |
| POST/PUT/DELETE | `/api/products/:id` | *(admin)* |
| PATCH | `/api/products/:id/stock` | `{ quantity, mode: "add"\|"set" }` *(admin)* |
| GET | `/api/rates/current` | joriy kurs va o'zgarish |
| POST | `/api/rates` | `{ rate: 12850 }` — yangi kurs, javobda har bir tovarga ta'siri *(admin)* |

### Sotuv
| POST | `/api/sales` | `{ items:[{product, quantity}], paymentType:"naqd"\|"karta"\|"nasiya", discount?, customer? }` — ombordan avtomatik ayiradi, yetmasa xato |
|---|---|---|
| GET | `/api/sales?period=today` | savdolar (xodim faqat o'zinikini ko'radi) |
| GET | `/api/sales/:id` | chek |
| GET/POST | `/api/customers` | nasiya mijozlari |

### Qaytarish
| GET | `/api/returns/slots` | "Taxminiy vaqt" ro'yxati (ertalab, tushdan, kechqurun, nomalum) |
|---|---|---|
| GET | `/api/returns/search?date=&slot=tushdan&amount=518000&product=coca` | asl chekni topish |
| POST | `/api/returns` | `{ saleId, items?:[{product, quantity}], reason? }` — omborga qaytaradi |

### Xarajatlar
| GET | `/api/expenses?period=today&user=&category=` | ro'yxat + **jami** + **kim qancha sarfladi** + turlari bo'yicha |
|---|---|---|
| POST | `/api/expenses` | `{ note, amount, category }` — kim sarflagani avtomatik yoziladi |
| PUT/DELETE | `/api/expenses/:id` | *(admin)* |

### Ta'minotchilar va kirim *(admin)*
| GET | `/api/suppliers` | har biridan bugun qancha olindi + qarzimiz + umumiy jami |
|---|---|---|
| POST/PUT/DELETE | `/api/suppliers/:id` | ta'minotchi qo'shish/tahrirlash |
| POST | `/api/suppliers/:id/pay` | `{ amount }` — qarzni to'lash |
| POST | `/api/supplies` | **tez kirim**: `{ supplier, product, quantity, unitPrice, currency:"UZS"\|"USD", paid }` → omborga qo'shadi, qarzni hisoblaydi |
| GET | `/api/supplies?date=&supplier=` | bugungi kirimlar + oxirida **jami** (summa, to'landi, qarz) |
| DELETE | `/api/supplies/:id` | xato kirimni bekor qilish |

## Tuzilma

```
src/
  config/        env.js, db.js
  models/        User, Product, Sale, Return, Expense, Supplier, SupplyEntry, ExchangeRate, Customer...
  controllers/   har bir bo'lim mantiqi
  middleware/    auth.js (JWT + rollar), error.js
  routes/        index.js — barcha yo'llar
  utils/         dates.js (Toshkent vaqti), ApiError.js
  seed.js        namuna ma'lumotlar
requests.http    VS Code REST Client uchun tayyor so'rovlar
```
