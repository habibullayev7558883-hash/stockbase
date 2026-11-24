import { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icon.jsx";
import { Avatar, Card, Empty, ErrorBox, Field, Loader, Modal, Money, PageHead, Pill, Seg, useToast } from "../components/ui.jsx";
import { PrintInvoice, printNow } from "../components/Receipt.jsx";
import { api, useApi } from "../api.js";
import { useAuth } from "../auth.jsx";
import { dateTime, fmt, time } from "../format.js";

const SUP_COLORS = [
  ["#E3F2E8", "#1A7A4C"], ["#FDF0DC", "#D98A1F"], ["#FCE5E7", "#D94B5A"], ["#ECEBFB", "#6B63D9"], ["#E3EEF8", "#3E6A92"], ["#E6F4F1", "#2A6B62"],
];
const supColor = (i) => SUP_COLORS[i % SUP_COLORS.length];
const UNITS = ["dona", "qop", "blok", "quti", "kg", "litr", "pachka", "yashik"];
const num = (v) => Number(String(v).replace(/\s/g, "").replace(",", ".")) || 0;
const newRow = () => ({ key: Math.random(), name: "", quantity: "", unit: "", unitPrice: "", sellPrice: "" });
const money2 = (v, cur) => (cur === "USD" ? `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : `${fmt(v)} so'm`);

function SupplierModal({ open, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", phone: "", debt: "" });
  useEffect(() => {
    if (open) setF({ name: "", phone: "", debt: "" });
  }, [open]);
  const save = async () => {
    try {
      const r = await api("/suppliers", { method: "POST", body: { ...f, debt: Number(f.debt) || 0 } });
      toast(`"${r.data.name}" qo'shildi`);
      onSaved(r.data);
    } catch (e) {
      toast(e.message, "error");
    }
  };
  return (
    <Modal open={open} onClose={onClose} kicker="TA'MINOTCHI" title="Yangi ta'minotchi qo'shish">
      <div className="form-col">
        <Field label="Ismi yoki firma nomi" icon="truck">
          <input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && f.name && save()} />
        </Field>
        <Field label="Telefon raqami (ixtiyoriy)" icon="phone">
          <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <Field label="Oldingi qarzimiz, bo'lsa (ixtiyoriy)" icon="wallet" suffix="so'm">
          <input inputMode="numeric" value={f.debt} onChange={(e) => setF({ ...f, debt: e.target.value.replace(/\D/g, "") })} />
        </Field>
        <button className="btn btn-primary btn-lg btn-block" onClick={save} disabled={!f.name.trim()}>
          <Icon name="check" stroke={2.4} /> Saqlash
        </button>
      </div>
    </Modal>
  );
}

function PayModal({ supplier, onClose, onSaved }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  useEffect(() => {
    setAmount(supplier ? String(supplier.debt) : "");
  }, [supplier]);
  const pay = async () => {
    try {
      await api(`/suppliers/${supplier._id}/pay`, { method: "POST", body: { amount: Number(amount) } });
      toast("To'lov saqlandi");
      onSaved();
    } catch (e) {
      toast(e.message, "error");
    }
  };
  return (
    <Modal open={!!supplier} onClose={onClose} kicker="QARZNI TO'LASH" title={supplier?.name}>
      <div className="pay-amount">
        <small className="muted">Joriy qarzimiz</small>
        <b className="red">{fmt(supplier?.debt)} so'm</b>
      </div>
      <Field label="To'lanadigan summa" icon="wallet" suffix="so'm">
        <input autoFocus inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
      </Field>
      <button className="btn btn-primary btn-lg btn-block mt16" onClick={pay} disabled={!Number(amount) || Number(amount) > (supplier?.debt || 0)}>
        <Icon name="check" stroke={2.4} /> To'lash
      </button>
    </Modal>
  );
}

/** Kirim nakladnoyi formasi: ta'minotchi + tovarlar ro'yxati + jami */
function InvoiceForm({ suppliers, products, rate, pickedSupplier, onSaved }) {
  const toast = useToast();
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [currency, setCurrency] = useState("UZS");
  const [rows, setRows] = useState([newRow()]);
  const [paid, setPaid] = useState("");
  const [busy, setBusy] = useState(false);

  // Kartadan tanlangan ta'minotchi formaga tushadi
  useEffect(() => {
    if (pickedSupplier) setSupName(pickedSupplier.name);
  }, [pickedSupplier]);

  const matchSup = suppliers.find((s) => s.name.toLowerCase() === supName.trim().toLowerCase());
  const byName = useMemo(() => new Map(products.map((p) => [p.name.toLowerCase(), p])), [products]);
  const prodOf = (r) => byName.get(r.name.trim().toLowerCase());

  const setRow = (i, patch) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const onName = (i, v) => {
    const p = byName.get(v.trim().toLowerCase());
    const r = rows[i];
    setRow(i, {
      name: v,
      ...(p && !r.unit ? { unit: p.stockUnit } : {}),
      ...(p && !r.unitPrice && p.costCurrency === currency && p.costPrice ? { unitPrice: String(p.costPrice) } : {}),
    });
  };
  const addRow = () => {
    setRows((rs) => [...rs, newRow()]);
    setTimeout(() => {
      const els = document.querySelectorAll(".inv-row input[data-f='name']");
      els[els.length - 1]?.focus();
    }, 30);
  };
  const removeRow = (i) => setRows((rs) => (rs.length === 1 ? [newRow()] : rs.filter((_, k) => k !== i)));

  const filled = rows.filter((r) => r.name.trim() && num(r.quantity) > 0);
  const totalCur = filled.reduce((s, r) => s + num(r.quantity) * num(r.unitPrice), 0);
  const total = Math.round(currency === "USD" ? totalCur * rate : totalCur);
  const paidN = Math.min(num(paid), total);
  const debt = total - paidN;

  const save = async () => {
    if (!supName.trim()) return toast("Ta'minotchi ismini yozing yoki tanlang", "error");
    if (!filled.length) return toast("Kamida bitta tovar kiriting (nomi va miqdori)", "error");
    setBusy(true);
    try {
      const r = await api("/supplies", {
        method: "POST",
        body: {
          supplier: matchSup?._id,
          supplierName: supName.trim(),
          supplierPhone: supPhone || undefined,
          currency,
          paid: paidN,
          items: filled.map((r) => ({
            name: r.name.trim(),
            quantity: num(r.quantity),
            unit: r.unit || "dona",
            unitPrice: num(r.unitPrice),
            sellPrice: num(r.sellPrice) || undefined,
            product: prodOf(r)?._id,
          })),
        },
      });
      toast(`Kirim №${r.data.invoiceNo} saqlandi: ${filled.length} xil tovar, ${fmt(r.data.total)} so'm`);
      setRows([newRow()]);
      setPaid("");
      setSupPhone("");
      onSaved(r.data);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card quick">
      <div className="card-head">
        <div className="row gap10">
          <span className="iconbox ib-green" style={{ width: 40, height: 40 }}>
            <Icon name="download" size={20} />
          </span>
          <div>
            <h3>Yangi kirim (nakladnoy)</h3>
            <p className="muted small">Ta'minotchini tanlang, olingan tovarlarni qatorma-qator yozing</p>
          </div>
        </div>
        <span className="cur-toggle big-toggle">
          {["UZS", "USD"].map((c) => (
            <button type="button" key={c} className={currency === c ? "active" : ""} onClick={() => setCurrency(c)}>
              {c === "UZS" ? "so'm" : "$ dollar"}
            </button>
          ))}
        </span>
      </div>

      <Field label="Ta'minotchi (ismini yozing yoki pastdan tanlang)" icon="truck">
        <input list="sup-names" value={supName} onChange={(e) => setSupName(e.target.value)} />
        <datalist id="sup-names">
          {suppliers.map((s) => (
            <option key={s._id} value={s.name} />
          ))}
        </datalist>
      </Field>
      {suppliers.length > 0 && (
        <div className="sup-chips">
          {suppliers.map((s, i) => {
            const [bg, fg] = supColor(i);
            const on = matchSup?._id === s._id;
            return (
              <button type="button" key={s._id} className={on ? "active" : ""} onClick={() => setSupName(s.name)}>
                <Avatar name={s.name} bg={bg} fg={fg} size={22} radius={6} />
                {s.name}
                {on && <Icon name="checkCircle" size={14} />}
              </button>
            );
          })}
        </div>
      )}
      {supName.trim() && !matchSup && (
        <div className="new-sup">
          <Pill color="purple">Yangi ta'minotchi</Pill>
          <span className="muted small">"{supName.trim()}" saqlanganda ro'yxatga qo'shiladi</span>
          <Field label="Telefon (ixtiyoriy)" icon="phone" className="grow">
            <input value={supPhone} onChange={(e) => setSupPhone(e.target.value)} />
          </Field>
        </div>
      )}

      <div className="inv-table">
        <div className="inv-head">
          <span>#</span>
          <span>Tovar nomi</span>
          <span>Miqdori</span>
          <span>Birligi</span>
          <span>1 dona narxi ({currency === "USD" ? "$" : "so'm"})</span>
          <span className="right">Summa</span>
          <span />
        </div>
        <datalist id="prod-names">
          {products.map((p) => (
            <option key={p._id} value={p.name} />
          ))}
        </datalist>
        <datalist id="units">
          {UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        {rows.map((r, i) => {
          const p = prodOf(r);
          const sum = num(r.quantity) * num(r.unitPrice);
          return (
            <div className="inv-row" key={r.key}>
              <span className="inv-n">{i + 1}</span>
              <div className="inv-name">
                <input data-f="name" list="prod-names" value={r.name} onChange={(e) => onName(i, e.target.value)} aria-label="Tovar nomi" />
                {r.name.trim() &&
                  (p ? (
                    <small className="muted">
                      Omborda: {p.quantity} {p.stockUnit} · sotuv: {p.sellPrice ? fmt(p.sellPrice) : "kiritilmagan"}
                    </small>
                  ) : (
                    <small className="new-prod">
                      <b>Yangi tovar</b> · sotuv narxi:
                      <input value={r.sellPrice} inputMode="numeric" onChange={(e) => setRow(i, { sellPrice: e.target.value.replace(/[^\d]/g, "") })} aria-label="Sotuv narxi" />
                      so'm
                    </small>
                  ))}
              </div>
              <label className="inv-cell c-q">
                <span className="cap">Miqdori</span>
                <input inputMode="decimal" value={r.quantity} onChange={(e) => setRow(i, { quantity: e.target.value.replace(/[^\d.,]/g, "") })} aria-label="Miqdori" />
              </label>
              <label className="inv-cell c-u">
                <span className="cap">Birligi</span>
                <input list="units" value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} aria-label="Birligi" />
              </label>
              <label className="inv-cell c-p">
                <span className="cap">Narxi</span>
              <input
                inputMode="decimal"
                value={r.unitPrice}
                onChange={(e) => setRow(i, { unitPrice: e.target.value.replace(/[^\d.,]/g, "") })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRow();
                  }
                }}
                aria-label="Narxi"
              />
              </label>
              <b className="inv-sum">{sum ? money2(sum, currency) : "—"}</b>
              <button type="button" className="icon-btn sm" onClick={() => removeRow(i)} title="Qatorni o'chirish">
                <Icon name="x" size={15} />
              </button>
            </div>
          );
        })}
        <button type="button" className="btn btn-outline btn-block add-row" onClick={addRow}>
          <Icon name="plus" /> Tovar qo'shish
        </button>
        <p className="muted small">Narxni yozib Enter bossangiz, yangi qator qo'shiladi.</p>
      </div>

      <div className="summary-box">
        <div className="row-between">
          <span className="muted">Tovarlar</span>
          <b>{filled.length} xil</b>
        </div>
        <div className="row-between">
          <span className="muted">Jami summa{currency === "USD" ? ` (1$ = ${fmt(rate)})` : ""}</span>
          <b className="big">
            {currency === "USD" && <small className="muted">{money2(totalCur, "USD")} = </small>}
            {fmt(total)} so'm
          </b>
        </div>
        <div className="row-between paid-row">
          <span className="muted">To'landi</span>
          <span className="paid-input">
            <input inputMode="numeric" value={paid} onChange={(e) => setPaid(e.target.value.replace(/\D/g, ""))} aria-label="To'langan summa" />
            <span className="muted">so'm</span>
            <button type="button" className="link small" onClick={() => setPaid(String(total))}>
              To'liq
            </button>
          </span>
        </div>
        <div className="row-between">
          <span className="muted">Qarzga qoladi</span>
          <b className={debt > 0 ? "red big" : "green big"}>{fmt(debt)} so'm</b>
        </div>
      </div>

      <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={save}>
        <Icon name="check" stroke={2.4} /> {busy ? "Saqlanmoqda..." : "Kirimni saqlash"}
      </button>
    </section>
  );
}

/** Kirimlar tarixi: har bir nakladnoy ochiladi va ichidagi tovarlar ko'rinadi */
function History({ period, setPeriod, supplier, clearSupplier, data, error, reload, onPrint, onUndo, colorOf, isAdmin }) {
  const [open, setOpen] = useState(null);
  const list = data?.data || [];
  const s = data?.summary;
  const label = { today: "Bugun", week: "Oxirgi 7 kun", month: "Shu oy", all: "Hammasi" }[period];
  return (
    <Card
      title="Kirimlar tarixi"
      sub={`${label}${supplier ? ` · ${supplier.name}` : ""} · ${s?.count || 0} ta nakladnoy`}
      action={<Seg items={[["today", "Bugun"], ["week", "Hafta"], ["month", "Oy"], ["all", "Hammasi"]]} value={period} onChange={setPeriod} />}
    >
      {supplier && (
        <div className="filter-tag">
          Faqat: <b>{supplier.name}</b>
          <button className="link" onClick={clearSupplier}>
            <Icon name="x" size={13} /> Hammasini ko'rsatish
          </button>
        </div>
      )}
      <ErrorBox error={error} onRetry={reload} />
      {data && list.length === 0 && <Empty icon="truck" title="Kirim yo'q" text="Chap tomondagi forma orqali kiriting" />}
      <div className="inv-list">
        {list.map((inv) => {
          const [bg, fg] = colorOf(inv.supplier?._id);
          const isOpen = open === inv._id;
          return (
            <div key={inv._id} className={"inv-card" + (isOpen ? " open" : "")}>
              <button className="inv-top" onClick={() => setOpen(isOpen ? null : inv._id)}>
                <Avatar name={inv.supplier?.name || inv.supplierName} bg={bg} fg={fg} size={34} radius={9} />
                <div className="grow">
                  <b>{inv.supplier?.name || inv.supplierName}</b>
                  <small className="muted block">
                    №{inv.invoiceNo} · {period === "today" ? time(inv.createdAt) : dateTime(inv.createdAt)} · {inv.items.length} xil tovar
                  </small>
                </div>
                <div className="right">
                  <b>{fmt(inv.total)}</b>
                  <small className={"block " + (inv.debt ? "red" : "green")}>{inv.debt ? `qarz ${fmt(inv.debt)}` : "to'langan"}</small>
                </div>
                <Icon name="chevDown" size={16} className={"chev" + (isOpen ? " up" : "")} />
              </button>
              {isOpen && (
                <div className="inv-body">
                  <table className="table compact">
                    <thead>
                      <tr>
                        <th>Tovar</th>
                        <th>Miqdor</th>
                        <th className="right">Narxi</th>
                        <th className="right">Summa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inv.items.map((it, k) => (
                        <tr key={k}>
                          <td>
                            {it.name} {it.isNewProduct && <Pill color="purple">yangi</Pill>}
                          </td>
                          <td>
                            {it.quantity} {it.unit}
                          </td>
                          <td className="right">{money2(it.unitPrice, inv.currency)}</td>
                          <td className="right">
                            <b>{money2(it.total, inv.currency)}</b>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="inv-foot">
                    <span>
                      Jami: <b>{money2(inv.totalCurrency, inv.currency)}</b>
                      {inv.currency === "USD" && <> = {fmt(inv.total)} so'm</>} · To'landi: <b className="green">{fmt(inv.paid)}</b> · Qarz:{" "}
                      <b className="red">{fmt(inv.debt)}</b>
                    </span>
                    <span className="muted small">Qabul qildi: {inv.createdBy?.name}</span>
                  </div>
                  <div className="row gap10">
                    <button className="btn btn-sm btn-outline" onClick={() => onPrint(inv)}>
                      <Icon name="receipt" size={15} /> Chop etish
                    </button>
                    {isAdmin && (
                      <button className="btn btn-sm btn-ghost danger" onClick={() => onUndo(inv)}>
                        <Icon name="undo" size={15} /> Bekor qilish
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {s && s.count > 0 && (
        <div className="total-row">
          <div>
            <b>Jami ({s.count} ta nakladnoy, {s.items} qator)</b>
            <small className="muted block">
              To'landi: {fmt(s.paid)} · Qarz: <span className="red">{fmt(s.debt)}</span>
            </small>
          </div>
          <Money value={s.total} className="total-big" />
        </div>
      )}
    </Card>
  );
}

export default function Taminotchilar() {
  const toast = useToast();
  const { user, isAdmin } = useAuth();
  const sup = useApi(() => api("/suppliers"), []);
  const prods = useApi(() => api("/products"), []);
  const rates = useApi(() => api("/rates/current"), []);
  const [selected, setSelected] = useState(null); // tarixni filtrlash uchun
  const [picked, setPicked] = useState(null); // formaga tushirish uchun
  const [period, setPeriod] = useState("today");
  const hist = useApi(() => api("/supplies", { query: { period, supplier: selected?._id } }), [period, selected?._id]);
  const [paying, setPaying] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [printInv, setPrintInv] = useState(null);

  const suppliers = useMemo(() => sup.data?.data || [], [sup.data]);
  const idx = Object.fromEntries(suppliers.map((s, i) => [s._id, i]));
  const colorOf = (id) => supColor(idx[id] ?? 0);
  const sum = sup.data?.summary;

  const refreshAll = () => {
    sup.reload();
    hist.reload();
    prods.reload();
    window.dispatchEvent(new Event("stock:changed"));
  };
  const print = (inv) => {
    setPrintInv(inv);
    printNow();
  };
  const undo = async (inv) => {
    if (!confirm(`№${inv.invoiceNo} nakladnoy bekor qilinsinmi? Tovarlar ombordan ayriladi va qarz kamayadi.`)) return;
    try {
      await api(`/supplies/${inv._id}`, { method: "DELETE" });
      toast("Kirim bekor qilindi");
      refreshAll();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <>
      <PageHead kicker="TA'MINOTCHILAR" title="Ta'minotchilar va kirim" sub="Kimdan qachon qanday tovar olindi, qancha to'landi va qancha qarz qoldi.">
        {sum && (
          <div className="sum-box">
            <div>
              <small className="muted">Bugungi kirim ({sum.todayCount} ta)</small>
              <Money value={sum.todayTotal} />
            </div>
            <div>
              <small className="muted">Umumiy qarzimiz</small>
              <Money value={sum.totalDebt} className="red" />
            </div>
          </div>
        )}
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
          <Icon name="plus" /> Ta'minotchi qo'shish
        </button>
      </PageHead>

      <ErrorBox error={sup.error} onRetry={sup.reload} />
      {sup.loading && !sup.data && <Loader />}

      {suppliers.length > 0 && (
        <div className="sup-cards">
          {suppliers.map((s, i) => {
            const [bg, fg] = supColor(i);
            return (
              <div
                key={s._id}
                className={"card sup-card" + (selected?._id === s._id ? " active" : "")}
                onClick={() => {
                  setSelected(s);
                  setPicked(s);
                  setPeriod("all");
                }}
              >
                <div className="row gap10">
                  <Avatar name={s.name} bg={bg} fg={fg} size={38} radius={10} />
                  <div className="grow">
                    <b>{s.name}</b>
                    <small className="muted block">{s.phone || "—"}</small>
                  </div>
                  {s.today.count > 0 && <Pill color="green">bugun {s.today.count}</Pill>}
                </div>
                <div className="sup-nums">
                  <div>
                    <small className="muted">Jami olingan</small>
                    <Money value={s.allTime.total} />
                  </div>
                  <div className="right">
                    <small className="muted">Qarzimiz</small>
                    {s.debt > 0 ? <Money value={s.debt} className="red" /> : <Pill color="green">To'langan</Pill>}
                  </div>
                </div>
                {s.debt > 0 && isAdmin && (
                  <button
                    className="btn btn-sm btn-outline btn-block"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPaying(s);
                    }}
                  >
                    Qarzni to'lash
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="grid-side wide">
        <InvoiceForm
          suppliers={suppliers}
          products={prods.data?.data || []}
          rate={rates.data?.data.rate || 0}
          pickedSupplier={picked}
          onSaved={(inv) => {
            refreshAll();
            setPrintInv(inv);
          }}
        />
        <History
          period={period}
          setPeriod={setPeriod}
          supplier={selected}
          clearSupplier={() => setSelected(null)}
          data={hist.data}
          error={hist.error}
          reload={hist.reload}
          onPrint={print}
          onUndo={undo}
          colorOf={colorOf}
          isAdmin={isAdmin}
        />
      </div>

      <SupplierModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={(s) => {
          setAddOpen(false);
          sup.reload();
          setPicked(s);
        }}
      />
      <PayModal supplier={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); sup.reload(); }} />
      <PrintInvoice inv={printInv} branch={user?.branch?.name} />
    </>
  );
}

