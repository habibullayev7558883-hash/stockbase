import { useState } from "react";
import Icon from "../components/Icon.jsx";
import { Card, Empty, Field, Modal, Money, PageHead, Pill, useToast } from "../components/ui.jsx";
import { api } from "../api.js";
import { PAY_LABEL, SALE_STATUS, dateTime, fmt, todayStr } from "../format.js";
import { useAuth } from "../auth.jsx";
import { PrintReceipt, printNow } from "../components/Receipt.jsx";

const SLOTS = [
  ["ertalab", "Ertalab (06:00-12:00)"],
  ["tushdan", "Tushdan keyin (12:00-18:00)"],
  ["kechqurun", "Kechqurun (18:00-24:00)"],
  ["nomalum", "Vaqti noma'lum"],
];

function ReturnModal({ sale, onClose, onDone }) {
  const toast = useToast();
  const [qty, setQty] = useState({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!sale) return null;
  const items = sale.items.map((i) => ({ ...i, left: i.quantity - i.returnedQuantity }));
  const ratio = sale.subtotal ? sale.total / sale.subtotal : 1;
  const amount = items.reduce((s, i) => s + Math.round((qty[i.product] || 0) * i.price * ratio), 0);
  const any = Object.values(qty).some((v) => v > 0);

  const submit = async () => {
    setBusy(true);
    try {
      const body = { saleId: sale._id, reason, items: items.filter((i) => qty[i.product] > 0).map((i) => ({ product: i.product, quantity: qty[i.product] })) };
      const r = await api("/returns", { method: "POST", body });
      toast(`${fmt(r.data.return.amount)} so'm qaytarildi, tovar omborga qo'shildi`);
      window.dispatchEvent(new Event("stock:changed"));
      window.dispatchEvent(new Event("notify:changed"));
      onDone();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} kicker={`CHEK #${sale.receiptNo}`} title="Qaytariladigan mahsulotlar" width={520}>
      <div className="ret-items">
        {items.map((i) => (
          <div key={i.product} className={"ret-item" + (i.left <= 0 ? " disabled" : "")}>
            <label className="row gap10 grow">
              <input type="checkbox" disabled={i.left <= 0} checked={(qty[i.product] || 0) > 0} onChange={(e) => setQty({ ...qty, [i.product]: e.target.checked ? i.left : 0 })} />
              <div>
                <b>{i.name}</b>
                <small className="muted block">
                  {fmt(i.price)} so'm · sotilgan {i.quantity}
                  {i.returnedQuantity ? `, qaytarilgan ${i.returnedQuantity}` : ""}
                </small>
              </div>
            </label>
            <input className="qty-input" type="number" min={0} max={i.left} disabled={i.left <= 0} value={qty[i.product] || 0} onChange={(e) => setQty({ ...qty, [i.product]: Math.max(0, Math.min(i.left, Number(e.target.value))) })} />
          </div>
        ))}
      </div>
      <Field label="Sababi (ixtiyoriy)">
        <input value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="pay-amount mt16">
        <small className="muted">Mijozga qaytariladigan summa ({PAY_LABEL[sale.paymentType]})</small>
        <b>{fmt(amount)} so'm</b>
      </div>
      <button className="btn btn-primary btn-lg btn-block" disabled={!any || busy} onClick={submit}>
        <Icon name="undo" /> {busy ? "Saqlanmoqda..." : "Qaytarishni tasdiqlash"}
      </button>
    </Modal>
  );
}

export default function Qaytarish() {
  const toast = useToast();
  const { branch } = useAuth();
  const branchName = branch?.name;
  const [f, setF] = useState({ barcode: "", date: todayStr(), slot: "nomalum", amount: "", product: "" });
  const [printSale, setPrintSale] = useState(null);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState(null);

  const search = async (e) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const r = await api("/returns/search", { query: { ...f, amount: f.amount.replace(/\s/g, "") } });
      setResults(r.data);
      if (r.message) toast(r.message, "error");
    } catch (er) {
      toast(er.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead kicker="SAVDONI TEKSHIRISH" title="Mahsulotni qaytarish" sub="Mijoz aytgan vaqt, summa yoki mahsulot orqali asl chekni toping." />
      <div className="grid-half">
        <form className="card" onSubmit={search}>
          <div className="card-head">
            <div className="row gap10">
              <span className="iconbox ib-green" style={{ width: 40, height: 40 }}>
                <Icon name="receipt" size={20} />
              </span>
              <div>
                <h3>Chekni qidirish</h3>
                <p className="muted small">Chek shtrix-kodini skanerlang yoki sana, vaqt va mahsulotni kiriting.</p>
              </div>
            </div>
          </div>
          <Field label="Shtrix-kod (chekdagi yoki mahsulotdagi)" icon="scan" className="mb14">
            <input autoFocus value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value.trim() })} />
          </Field>
          <div className="form-grid">
            <Field label="Savdo sanasi" icon="calendar">
              <input type="date" value={f.date} max={todayStr()} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </Field>
            <Field label="Taxminiy vaqt" icon="clock">
              <select value={f.slot} onChange={(e) => setF({ ...f, slot: e.target.value })}>
                {SLOTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Jami yoki mahsulot narxi" icon="coin">
              <input inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d\s]/g, "") })} />
            </Field>
            <Field label="Mahsulot" icon="box">
              <input value={f.product} onChange={(e) => setF({ ...f, product: e.target.value })} />
            </Field>
          </div>
          <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
            <Icon name="search" stroke={2} /> {busy ? "Qidirilmoqda..." : "Mos savdoni topish"}
          </button>
          <div className="hint-box">
            <b>Qanday topiladi:</b> chekdagi shtrix-kodni skanerlang — chek darhol chiqadi. Chek yo'q bo'lsa: sana + vaqt + mahsulot shtrix-kodi (yoki summa).
          </div>
        </form>

        <Card title="Qidiruv natijasi" sub={results ? `${results.length} ta chek topildi` : "Mezonlarni kiriting va qidiring"}>
          {!results && <Empty title="Natijalar shu yerda chiqadi" text="Mijozdan savdo vaqti va umumiy summani so'rang." />}
          {results && results.length === 0 && <Empty icon="receipt" title="Chek topilmadi" text="Vaqtni “Vaqti noma'lum” qilib yoki summasiz qidirib ko'ring" />}
          <div className="receipts">
            {results?.map((s) => (
              <div className="receipt" key={s._id}>
                <div className="row-between">
                  <div>
                    <b>#{s.receiptNo}</b> <Pill color={SALE_STATUS[s.status].cls}>{SALE_STATUS[s.status].label}</Pill>
                    <small className="muted block">
                      {dateTime(s.createdAt)} · {PAY_LABEL[s.paymentType]} · {s.cashier?.name}
                    </small>
                  </div>
                  <Money value={s.total} className="total-big" />
                </div>
                <ul>
                  {s.items.map((i) => (
                    <li key={i.product}>
                      <span>
                        {i.name} × {i.quantity}
                        {i.returnedQuantity > 0 && <small className="orange"> (qaytarilgan: {i.returnedQuantity})</small>}
                      </span>
                      <span>{fmt(i.total)}</span>
                    </li>
                  ))}
                </ul>
                <div className="grid-2">
                  <button
                    className="btn btn-outline"
                    onClick={() => {
                      setPrintSale(s);
                      printNow();
                    }}
                  >
                    <Icon name="receipt" /> Chop etish
                  </button>
                  <button className="btn btn-primary" disabled={s.status === "qaytarilgan"} onClick={() => setPicked(s)}>
                    <Icon name="undo" /> Qaytarish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <PrintReceipt sale={printSale} branch={branchName} />
      <ReturnModal
        sale={picked}
        onClose={() => setPicked(null)}
        onDone={() => {
          setPicked(null);
          search();
        }}
      />
    </>
  );
}
