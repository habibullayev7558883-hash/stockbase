import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { Avatar, Empty, ErrorBox, Loader, Modal, Money, PageHead, useToast } from "../components/ui.jsx";
import { api, useApi } from "../api.js";
import { useAuth } from "../auth.jsx";
import { fmt, productColor } from "../format.js";
import { Barcode, PrintReceipt, printNow, receiptCode } from "../components/Receipt.jsx";

function ProductCard({ p, inCart, onAdd }) {
  const out = p.quantity <= 0 || !(p.sellPrice > 0);
  return (
    <button className={"product" + (out ? " out" : "")} onClick={() => !out && onAdd(p)} disabled={out}>
      <div className="product-img" style={{ background: productColor(p) }}>
        <span className="product-tag">{p.label || p.name.slice(0, 6).toUpperCase()}</span>
        {inCart > 0 && <span className="product-badge">{inCart}</span>}
      </div>
      <div className="product-body">
        <span className="product-name">{p.name}</span>
        <small className="muted">{p.unit}</small>
        <Money value={p.sellPrice} className="product-price" />
        <small className={"stock " + (p.sellPrice > 0 ? p.status : "tugadi")}>
          {!(p.sellPrice > 0) ? "Narx kiritilmagan" : p.status === "tugadi" ? "Tugadi" : p.status === "kam" ? `Kam qoldi: ${p.quantity}` : `Omborda: ${p.quantity}`}
        </small>
      </div>
      {!out && (
        <span className="product-add">
          <Icon name="plus" size={16} stroke={2.2} />
        </span>
      )}
    </button>
  );
}

function Stepper({ value, max, onChange }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(value - 1)} aria-label="Kamaytirish">
        <Icon name="minus" size={14} stroke={2} />
      </button>
      <input
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^\d.]/g, ""));
          if (!Number.isNaN(n)) onChange(Math.min(n, max));
        }}
      />
      <button onClick={() => onChange(Math.min(value + 1, max))} disabled={value >= max} aria-label="Ko'paytirish">
        <Icon name="plus" size={14} stroke={2} />
      </button>
    </div>
  );
}

function CartPanel({ cart, setQty, customer, setCustomer, customers, discount, setDiscount, totals, onPay, onClose }) {
  const [showDisc, setShowDisc] = useState(discount > 0);
  return (
    <div className="cart">
      <div className="cart-head">
        <div>
          <h3>Joriy savat</h3>
          <small className="muted">{cart.length ? `${cart.length} xil mahsulot` : "Savat bo'sh"}</small>
        </div>
        {onClose && (
          <button className="icon-btn" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        )}
      </div>

      <label className="customer">
        <span className="iconbox ib-green" style={{ width: 30, height: 30 }}>
          <Icon name="user" size={16} />
        </span>
        <span className="grow">
          <small className="muted">Mijoz</small>
          <select value={customer} onChange={(e) => setCustomer(e.target.value)}>
            <option value="">Naqd savdo</option>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
                {c.debt > 0 ? ` (qarz: ${fmt(c.debt)})` : ""}
              </option>
            ))}
          </select>
        </span>
        <Icon name="chevDown" size={16} />
      </label>

      <div className="cart-items">
        {cart.length === 0 && <Empty icon="cart" title="Savat bo'sh" text="Mahsulotni bosib savatga qo'shing" />}
        {cart.map(({ p, qty }) => (
          <div className="cart-item" key={p._id}>
            <Avatar name={p.label || p.name} bg={productColor(p)} fg="#2B3036" size={36} radius={9} />
            <div className="grow">
              <div className="row-between">
                <b>{p.name}</b>
                <Money value={p.sellPrice * qty} />
              </div>
              <small className="muted">{fmt(p.sellPrice)} so'm / {p.stockUnit}</small>
              <div className="row-between mt6">
                <Stepper value={qty} max={p.quantity} onChange={(v) => setQty(p, v)} />
                <button className="link danger" onClick={() => setQty(p, 0)}>
                  O'chirish
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-foot">
        <div className="row-between muted">
          <span>Oraliq summa</span>
          <span>{fmt(totals.subtotal)} so'm</span>
        </div>
        <div className="row-between muted">
          <span>Chegirma</span>
          {showDisc ? (
            <input className="disc-input" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value.replace(/\D/g, "")) || 0)} />
          ) : (
            <button className="link" onClick={() => setShowDisc(true)}>
              + Qo'shish
            </button>
          )}
        </div>
        <div className="row-between total">
          <span>Jami</span>
          <b>{fmt(totals.total)} so'm</b>
        </div>
        <button className="btn btn-primary btn-lg btn-block pay-btn" disabled={!cart.length || totals.total < 0} onClick={onPay}>
          <Icon name="card" /> To'lovga o'tish <kbd>F9</kbd>
        </button>
      </div>
    </div>
  );
}

function PaymentModal({ open, onClose, total, customer, customers, onDone, payload, reloadCustomers }) {
  const toast = useToast();
  const [type, setType] = useState("naqd");
  const [cust, setCust] = useState(customer);
  const [newCust, setNewCust] = useState({ name: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setType("naqd");
      setCust(customer);
      setErr("");
    }
  }, [open, customer]);

  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      let customerId = cust || undefined;
      if (type === "nasiya" && !customerId) {
        if (!newCust.name.trim()) throw new Error("Nasiya uchun mijozni tanlang yoki yangisini kiriting");
        const c = await api("/customers", { method: "POST", body: newCust });
        customerId = c.data._id;
        reloadCustomers();
      }
      const r = await api("/sales", { method: "POST", body: { ...payload, paymentType: type, customer: customerId } });
      onDone(r.data);
    } catch (e) {
      setErr(e.message);
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const types = [
    ["naqd", "Naqd", "wallet"],
    ["karta", "Karta", "card"],
    ["nasiya", "Nasiya", "card"],
  ];
  return (
    <Modal open={open} onClose={onClose} kicker="TO'LOV" title="To'lov turini tanlang">
      <div className="pay-amount">
        <small className="muted">To'lanadigan summa</small>
        <b>{fmt(total)} so'm</b>
      </div>
      <div className="pay-types">
        {types.map(([v, l, ic]) => (
          <button key={v} className={type === v ? "active" : ""} onClick={() => setType(v)}>
            {type === v && <Icon name="checkCircle" size={15} className="pay-check" />}
            <Icon name={ic} size={22} stroke={1.7} />
            {l}
          </button>
        ))}
      </div>
      {type === "nasiya" && (
        <div className="nasiya-box">
          <label className="field">
            <span className="field-label">Mijoz (qarzga yoziladi)</span>
            <span className="input-wrap">
              <select value={cust} onChange={(e) => setCust(e.target.value)}>
                <option value="">— Yangi mijoz —</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </span>
          </label>
          {!cust && (
            <div className="grid-2">
              <label className="field">
                <span className="field-label">Ism</span>
                <span className="input-wrap">
                  <input value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
                </span>
              </label>
              <label className="field">
                <span className="field-label">Telefon</span>
                <span className="input-wrap">
                  <input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
                </span>
              </label>
            </div>
          )}
        </div>
      )}
      {err && <div className="error-box">{err}</div>}
      <button className="btn btn-primary btn-lg btn-block" onClick={submit} disabled={busy}>
        <Icon name="check" stroke={2.4} /> {busy ? "Saqlanmoqda..." : "To'lovni yakunlash"}
      </button>
    </Modal>
  );
}

export default function Sotuv() {
  const { isAdmin, branch } = useAuth();
  const branchName = branch?.name;
  const products = useApi(() => api("/products"), []);
  const today = useApi(() => api("/sales", { query: { period: "today", limit: 1 } }), []);
  const customersQ = useApi(() => api("/customers"), []);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [sort, setSort] = useState("name");
  const [cart, setCart] = useState([]); // [{p, qty}]
  const [customer, setCustomer] = useState("");
  const [discount, setDiscount] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [done, setDone] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const searchRef = useRef(null);

  const list = products.data?.data || [];
  const categories = products.data?.summary.categories || [];
  const customers = customersQ.data?.data || [];

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    let r = list.filter((p) => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q) || (p.barcode || "").includes(q)));
    if (sort === "price") r = [...r].sort((a, b) => a.sellPrice - b.sellPrice);
    if (sort === "stock") r = [...r].sort((a, b) => b.quantity - a.quantity);
    return r;
  }, [list, search, cat, sort]);

  const qtyOf = (id) => cart.find((c) => c.p._id === id)?.qty || 0;
  const add = (p) =>
    setCart((c) => {
      const ex = c.find((x) => x.p._id === p._id);
      if (ex) return c.map((x) => (x.p._id === p._id ? { ...x, qty: Math.min(x.qty + 1, p.quantity) } : x));
      return [...c, { p, qty: 1 }];
    });
  const setQty = (p, v) => setCart((c) => (v <= 0 ? c.filter((x) => x.p._id !== p._id) : c.map((x) => (x.p._id === p._id ? { ...x, qty: v } : x))));

  const subtotal = cart.reduce((s, x) => s + x.p.sellPrice * x.qty, 0);
  const totals = { subtotal, total: subtotal - Math.min(discount, subtotal) };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "F9" && cart.length) {
        e.preventDefault();
        setPayOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart.length]);

  const onSearchEnter = (e) => {
    if (e.key !== "Enter") return;
    const q = search.trim();
    const byCode = list.find((p) => p.barcode && p.barcode === q);
    const target = byCode || (shown.length === 1 ? shown[0] : null);
    if (target && target.quantity > 0) {
      add(target);
      setSearch("");
    }
  };

  const finish = (sale) => {
    setPayOpen(false);
    setCartOpen(false);
    setDone(sale);
    setCart([]);
    setDiscount(0);
    setCustomer("");
    products.reload();
    today.reload();
    customersQ.reload();
    window.dispatchEvent(new Event("stock:changed"));
  };

  const cartProps = { cart, setQty, customer, setCustomer, customers, discount, setDiscount, totals, onPay: () => setPayOpen(true) };

  return (
    <div className="pos">
      <div className="pos-main">
        <PageHead kicker="SOTUV TERMINALI" title="Yangi sotuv">
          <div className="kassa">
            <span className="iconbox ib-green" style={{ width: 28, height: 28 }}>
              <Icon name="wallet" size={15} />
            </span>
            <div>
              <small className="muted">{isAdmin ? "Bugungi savdo" : "Bugungi savdom"}</small>
              <b>{fmt(today.data?.summary.total || 0)} so'm</b>
            </div>
            <span className="live-dot" />
          </div>
        </PageHead>

        <div className="pos-search">
          <Icon name="search" size={20} />
          <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={onSearchEnter} />
          <kbd>F2</kbd>
        </div>

        <div className="chips">
          <button className={!cat ? "active" : ""} onClick={() => setCat("")}>
            Barchasi
          </button>
          {categories.map((c) => (
            <button key={c} className={cat === c ? "active" : ""} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>

        <div className="row-between section-title">
          <h3>
            Mahsulotlar <small className="muted">{shown.length}</small>
          </h3>
          <label className="sort">
            <Icon name="sort" size={14} />
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name">Nomi bo'yicha</option>
              <option value="price">Narxi bo'yicha</option>
              <option value="stock">Qoldiq bo'yicha</option>
            </select>
          </label>
        </div>

        <ErrorBox error={products.error} onRetry={products.reload} />
        {products.loading && !products.data && <Loader />}
        <div className="products">
          {shown.map((p) => (
            <ProductCard key={p._id} p={p} inCart={qtyOf(p._id)} onAdd={add} />
          ))}
        </div>
        {products.data && shown.length === 0 && <Empty title="Mahsulot topilmadi" text="Boshqa nom bilan qidirib ko'ring" />}
      </div>

      <aside className="pos-cart">
        <CartPanel {...cartProps} />
      </aside>

      {cart.length > 0 && (
        <button className="cart-bar" onClick={() => setCartOpen(true)}>
          <span className="cart-bar-icon">
            <Icon name="cart" size={18} />
            <i>{cart.reduce((s, x) => s + x.qty, 0)}</i>
          </span>
          <span className="grow">
            <b>{fmt(totals.total)} so'm</b>
            <small>{cart.length} xil mahsulot</small>
          </span>
          Savat <Icon name="chevRight" size={16} />
        </button>
      )}

      {cartOpen && (
        <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setCartOpen(false)}>
          <div className="sheet">
            <CartPanel {...cartProps} onClose={() => setCartOpen(false)} />
          </div>
        </div>
      )}

      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        total={totals.total}
        customer={customer}
        customers={customers}
        reloadCustomers={customersQ.reload}
        payload={{ items: cart.map((x) => ({ product: x.p._id, quantity: x.qty })), discount: Math.min(discount, subtotal) }}
        onDone={finish}
      />

      <Modal open={!!done} onClose={() => setDone(null)} width={420}>
        <div className="success">
          <span className="success-icon">
            <Icon name="check" size={30} stroke={2.6} />
          </span>
          <h2>To'lov yakunlandi</h2>
          <p className="muted">
            Chek <b>#{done?.receiptNo}</b> — {fmt(done?.total)} so'm saqlandi. Endi bu chekni "Qaytarish" bo'limidan vaqt va summa orqali topish mumkin.
          </p>
          <button
            className="btn btn-primary btn-lg btn-block"
            onClick={() => {
              setDone(null);
              searchRef.current?.focus();
            }}
          >
            Yangi savdoni boshlash
          </button>
          <button className="btn btn-outline btn-block" onClick={printNow}>
            <Icon name="receipt" /> Chekni chop etish
          </button>
          {done && (
            <div className="success-code">
              <Barcode value={receiptCode(done.receiptNo)} height={34} module={1.2} />
              <small className="muted">{receiptCode(done.receiptNo)}</small>
            </div>
          )}
        </div>
      </Modal>
      <PrintReceipt sale={done} branch={branchName} />
    </div>
  );
}
