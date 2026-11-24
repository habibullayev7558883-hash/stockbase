import { Sale, Expense, Return, Customer, Product, getRates, withPricing } from "../models/index.js";
import { env } from "../config/env.js";
import { dayRange, monthRange, shiftDays, localDateStr } from "../utils/dates.js";
import { branchFilter } from "../middleware/branch.js";

const NET = { $subtract: ["$total", "$returnedAmount"] };
const pct = (a, b) => (b ? +(((a - b) / b) * 100).toFixed(1) : a ? 100 : 0);

/** Davr bo'yicha savdo statistikasi */
async function salesStats(start, end, bf = {}) {
  const match = { createdAt: { $gte: start, $lt: end }, ...bf };
  const [r] = await Sale.aggregate([
    { $match: match },
    {
      $facet: {
        totals: [
          { $group: { _id: null, gross: { $sum: "$total" }, returned: { $sum: "$returnedAmount" }, discount: { $sum: "$discount" }, count: { $sum: 1 } } },
        ],
        profit: [
          { $unwind: "$items" },
          {
            $group: {
              _id: null,
              p: { $sum: { $multiply: [{ $subtract: ["$items.price", "$items.costPrice"] }, { $subtract: ["$items.quantity", "$items.returnedQuantity"] }] } },
            },
          },
        ],
        byPayment: [{ $group: { _id: "$paymentType", total: { $sum: NET }, count: { $sum: 1 } } }],
        byHour: [{ $group: { _id: { $hour: { date: "$createdAt", timezone: env.tz } }, total: { $sum: NET }, count: { $sum: 1 } } }],
        byDay: [{ $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: env.tz } }, total: { $sum: NET }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
        byBranch: [
          { $group: { _id: "$branch", total: { $sum: NET }, count: { $sum: 1 } } },
          { $lookup: { from: "branches", localField: "_id", foreignField: "_id", as: "b" } },
          { $unwind: { path: "$b", preserveNullAndEmptyArrays: true } },
          { $project: { _id: 0, branch: "$_id", name: "$b.name", total: 1, count: 1 } },
          { $sort: { total: -1 } },
        ],
        byWorker: [
          { $group: { _id: "$cashier", total: { $sum: NET }, count: { $sum: 1 }, items: { $sum: { $size: "$items" } } } },
          { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "u" } },
          { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
          { $project: { _id: 0, user: "$_id", name: "$u.name", position: "$u.position", total: 1, count: 1, items: 1 } },
          { $sort: { total: -1 } },
        ],
      },
    },
  ]);

  const t = r.totals[0] || { gross: 0, returned: 0, discount: 0, count: 0 };
  const sales = t.gross - t.returned;
  const grossProfit = (r.profit[0]?.p || 0) - t.discount;

  return {
    sales,
    receipts: t.count,
    avgReceipt: t.count ? Math.round(sales / t.count) : 0,
    discount: t.discount,
    returned: t.returned,
    grossProfit,
    byPayment: ["naqd", "karta", "nasiya"].map((type) => {
      const p = r.byPayment.find((x) => x._id === type) || { total: 0, count: 0 };
      return { type, total: p.total, count: p.count, share: sales ? +((p.total / sales) * 100).toFixed(1) : 0 };
    }),
    byHour: r.byHour,
    byDay: r.byDay.map((d) => ({ date: d._id, total: d.total, count: d.count })),
    byBranch: r.byBranch.map((b) => ({ ...b, share: sales ? +((b.total / sales) * 100).toFixed(1) : 0 })),
    byWorker: r.byWorker.map((w, i) => ({
      ...w,
      avgReceipt: w.count ? Math.round(w.total / w.count) : 0,
      share: sales ? +((w.total / sales) * 100).toFixed(1) : 0,
      best: i === 0 && w.total > 0,
    })),
  };
}

async function expenseStats(start, end, bf = {}) {
  const [r] = await Expense.aggregate([
    { $match: { spentAt: { $gte: start, $lt: end }, ...bf } },
    {
      $facet: {
        total: [{ $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }],
        byCategory: [{ $group: { _id: "$category", total: { $sum: "$amount" } } }, { $sort: { total: -1 } }],
      },
    },
  ]);
  return {
    total: r.total[0]?.total || 0,
    count: r.total[0]?.count || 0,
    byCategory: r.byCategory.map((c) => ({ category: c._id, total: c.total })),
  };
}

/** GET /api/reports/daily?date=YYYY-MM-DD — kunlik hisobot */
export async function daily(req, res) {
  const { start, end, date } = dayRange(req.query.date);
  const bf = branchFilter(req);
  const [cur, prev, exp] = await Promise.all([
    salesStats(start, end, bf),
    salesStats(shiftDays(start, -1), start, bf),
    expenseStats(start, end, bf),
  ]);

  const hours = [];
  const firstHour = Math.min(6, ...cur.byHour.filter((b) => b.total > 0).map((b) => b._id));
  for (let h = firstHour; h <= 23; h++) {
    const x = cur.byHour.find((b) => b._id === h);
    hours.push({ hour: `${String(h).padStart(2, "0")}:00`, total: x?.total || 0, count: x?.count || 0 });
  }
  const peak = hours.reduce((a, b) => (b.total > a.total ? b : a), hours[0]);

  res.json({
    success: true,
    data: {
      date,
      totals: {
        sales: cur.sales,
        salesChange: pct(cur.sales, prev.sales),
        receipts: cur.receipts,
        receiptsChange: cur.receipts - prev.receipts,
        avgReceipt: cur.avgReceipt,
        discount: cur.discount,
        returned: cur.returned,
        grossProfit: cur.grossProfit,
        expenses: exp.total,
        netProfit: cur.grossProfit - exp.total,
        netMargin: cur.sales ? +(((cur.grossProfit - exp.total) / cur.sales) * 100).toFixed(1) : 0,
      },
      byHour: hours,
      peakHour: peak.total ? peak : null,
      byPayment: cur.byPayment,
      byBranch: cur.byBranch,
      byWorker: cur.byWorker, // xodimlar bir kunda qancha savdo qildi
      expensesByCategory: exp.byCategory,
    },
  });
}

/** GET /api/reports/monthly?month=YYYY-MM — oylik hisobot */
export async function monthly(req, res) {
  const { start, end, month } = monthRange(req.query.month);
  const bf = branchFilter(req);
  const [cur, exp] = await Promise.all([salesStats(start, end, bf), expenseStats(start, end, bf)]);

  // Oxirgi 6 oy grafigi
  const [y, m] = month.split("-").map(Number);
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    const r = monthRange(key);
    const [agg] = await Sale.aggregate([
      { $match: { createdAt: { $gte: r.start, $lt: r.end }, ...bf } },
      { $group: { _id: null, total: { $sum: NET }, count: { $sum: 1 } } },
    ]);
    months.push({ month: key, total: agg?.total || 0, count: agg?.count || 0 });
  }

  res.json({
    success: true,
    data: {
      month,
      totals: {
        sales: cur.sales,
        receipts: cur.receipts,
        avgReceipt: cur.avgReceipt,
        returned: cur.returned,
        grossProfit: cur.grossProfit,
        expenses: exp.total,
        netProfit: cur.grossProfit - exp.total,
      },
      byDay: cur.byDay,
      byPayment: cur.byPayment,
      byBranch: cur.byBranch,
      byWorker: cur.byWorker,
      expensesByCategory: exp.byCategory,
      last6Months: months,
    },
  });
}

/** GET /api/dashboard — bosh sahifa (faqat admin) */
export async function dashboard(req, res) {
  const today = dayRange();
  const bf = branchFilter(req);
  const weekStart = shiftDays(today.end, -7);
  const [t, y, w, pw, expToday, naqdReturns, debt, last30, recent, alerts] = await Promise.all([
    salesStats(today.start, today.end, bf),
    salesStats(shiftDays(today.start, -1), today.start, bf),
    salesStats(weekStart, today.end, bf),
    salesStats(shiftDays(weekStart, -7), weekStart, bf),
    expenseStats(today.start, today.end, bf),
    Return.aggregate([
      { $match: { createdAt: { $gte: today.start, $lt: today.end }, paymentType: "naqd", ...bf } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Customer.aggregate([
      { $match: { debt: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$debt" }, count: { $sum: 1 }, overdue: { $sum: { $cond: [{ $lt: ["$dueDate", new Date()] }, 1, 0] } } } },
    ]),
    salesStats(shiftDays(today.end, -30), today.end, bf),
    Sale.find(bf).sort({ createdAt: -1 }).limit(5).populate("cashier", "name"),
    Product.find({ isActive: true, $expr: { $lte: ["$quantity", "$minQuantity"] } }).sort({ quantity: 1 }),
  ]);

  const naqd = t.byPayment.find((p) => p.type === "naqd")?.total || 0;
  const { rate, previousRate } = await getRates();
  const alertItems = alerts.map((p) => withPricing(p, rate, previousRate));

  // 30 kunlik grafik (bo'sh kunlar 0)
  const series = [];
  for (let i = 29; i >= 0; i--) {
    const d = localDateStr(shiftDays(today.start, -i));
    const x = last30.byDay.find((b) => b.date === d);
    series.push({ date: d, total: x?.total || 0 });
  }

  res.json({
    success: true,
    data: {
      date: today.date,
      todaySales: { total: t.sales, change: pct(t.sales, y.sales), receipts: t.receipts },
      weekSales: { total: w.sales, change: pct(w.sales, pw.sales) },
      cash: { total: naqd - expToday.total - (naqdReturns[0]?.total || 0), naqdSales: naqd, expenses: expToday.total },
      customersDebt: { total: debt[0]?.total || 0, customers: debt[0]?.count || 0, overdue: debt[0]?.overdue || 0 },
      chart30: { total: last30.sales, series },
      stock: {
        low: alertItems.filter((p) => p.status === "kam").length,
        out: alertItems.filter((p) => p.status === "tugadi").length,
        items: alertItems.slice(0, 5).map((p) => ({ _id: p._id, name: p.name, unit: p.unit, quantity: p.quantity, stockUnit: p.stockUnit, status: p.status })),
      },
      recentSales: recent.map((s) => ({
        _id: s._id, receiptNo: s.receiptNo, customerName: s.customerName, createdAt: s.createdAt,
        paymentType: s.paymentType, total: s.total - s.returnedAmount, status: s.status, cashier: s.cashier?.name,
      })),
    },
  });
}
