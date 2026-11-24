import { Router } from "express";
import { protect, allow } from "../middleware/auth.js";
import * as auth from "../controllers/auth.controller.js";
import * as products from "../controllers/products.controller.js";
import * as sales from "../controllers/sales.controller.js";
import * as returns from "../controllers/returns.controller.js";
import * as expenses from "../controllers/expenses.controller.js";
import * as suppliers from "../controllers/suppliers.controller.js";
import * as customers from "../controllers/customers.controller.js";
import * as reports from "../controllers/reports.controller.js";
import * as notifications from "../controllers/notifications.controller.js";
import * as branches from "../controllers/branches.controller.js";
import { branchScope } from "../middleware/branch.js";

const r = Router();
const admin = allow("admin");

// ---------- Auth ----------
r.post("/auth/login", auth.login);
r.get("/auth/me", protect, auth.me);
r.get("/auth/permissions", protect, auth.permissions);

// Hamma yo'llar quyida — token kerak
r.use(protect, branchScope);

// ---------- Filiallar (ko'rish: hamma, o'zgartirish: admin) ----------
r.get("/branches", branches.listBranches);
r.post("/branches", admin, branches.createBranch);
r.put("/branches/:id", admin, branches.updateBranch);
r.delete("/branches/:id", admin, branches.deleteBranch);

// ---------- Xodimlar (admin) ----------
r.get("/users", admin, auth.listUsers);
r.post("/users", admin, auth.createUser);
r.put("/users/:id", admin, auth.updateUser);
r.delete("/users/:id", admin, auth.deleteUser);

// ---------- Bosh sahifa / Hisobotlar (admin) ----------
r.get("/dashboard", admin, reports.dashboard);
r.get("/reports/daily", admin, reports.daily);
r.get("/reports/monthly", admin, reports.monthly);

// ---------- Ombor (o'qish: hamma, o'zgartirish: admin) ----------
r.get("/products", products.listProducts);
r.get("/products/alerts", products.stockAlerts);
r.get("/products/barcode/:code", products.getByBarcode);
r.get("/products/:id", products.getProduct);
r.post("/products", products.createProduct);
r.put("/products/:id", products.updateProduct);
r.patch("/products/:id/stock", admin, products.adjustStock);
r.delete("/products/:id", admin, products.deleteProduct);

// ---------- Dollar kursi ----------
r.get("/rates/current", products.currentRate);
r.get("/rates/history", admin, products.rateHistory);
r.post("/rates", admin, products.setRate);

// ---------- Sotuv (hamma) ----------
r.post("/sales", sales.createSale);
r.get("/sales", sales.listSales);
r.get("/sales/:id", sales.getSale);

// ---------- Mijozlar (nasiya) ----------
r.get("/customers", customers.listCustomers);
r.post("/customers", customers.createCustomer);
r.post("/customers/:id/pay", customers.payCustomerDebt);

// ---------- Qaytarish (hamma) ----------
r.get("/returns/slots", returns.slots);
r.get("/returns/search", returns.searchSales);
r.get("/returns", returns.listReturns);
r.post("/returns", returns.createReturn);

// ---------- Xarajatlar (hamma; xodim faqat o'zinikini ko'radi) ----------
r.get("/expenses/categories", expenses.categories);
r.get("/expenses", expenses.listExpenses);
r.post("/expenses", expenses.createExpense);
r.put("/expenses/:id", admin, expenses.updateExpense);
r.delete("/expenses/:id", admin, expenses.deleteExpense);

// ---------- Ta'minotchilar va kirim (hamma; to'lov va bekor qilish — admin) ----------
r.get("/suppliers", suppliers.listSuppliers);
r.get("/suppliers/:id", suppliers.getSupplier);
r.post("/suppliers", suppliers.createSupplier);
r.put("/suppliers/:id", suppliers.updateSupplier);
r.delete("/suppliers/:id", admin, suppliers.deleteSupplier);
r.post("/suppliers/:id/pay", admin, suppliers.paySupplier);

r.get("/supplies", suppliers.listSupplies);
r.get("/supplies/:id", suppliers.getSupply);
r.post("/supplies", suppliers.createSupply);
r.delete("/supplies/:id", admin, suppliers.deleteSupply);

// ---------- Bildirishnomalar (admin) ----------
r.get("/notifications", admin, notifications.list);
r.post("/notifications/read", admin, notifications.readAll);

export default r;
