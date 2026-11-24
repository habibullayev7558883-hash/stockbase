import { useEffect, useState } from "react";
import Icon from "../components/Icon.jsx";
import { Avatar, Empty, ErrorBox, Field, Loader, Modal, Money, PageHead, Pill, Stat, useToast } from "../components/ui.jsx";
import { api, useApi } from "../api.js";
import { useAuth } from "../auth.jsx";
import { STATUS, fmt, fmtShort, productColor } from "../format.js";
import { navigate, useRoute } from "../router.js";

const EMPTY = { name: "", unit: "", stockUnit: "dona", category: "Oziq-ovqat", barcode: "", label: "", color: "", quantity: 0, minQuantity: 15, costCurrency: "UZS", costPrice: 0, sellPrice: 0 };

function ProductModal({ open, product, categories, onClose, onSaved }) {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const lockQty = !isAdmin && !!product;
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF(product ? { ...EMPTY, ...product, barcode: product.barcode || "", label: product.label || "", color: product.color || "" } : EMPTY);
  }, [open, product]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...f, quantity: Number(f.quantity), minQuantity: Number(f.minQuantity), costPrice: Number(f.costPrice), sellPrice: Number(f.sellPrice) };
      if (!body.barcode) delete body.barcode;
      if (product) await api(`/products/${product._id}`, { method: "PUT", body });
      else await api("/products", { method: "POST", body });
      toast(product ? "Mahsulot yangilandi" : "Mahsulot qo'shildi");
      onSaved();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!confirm(`"${product.name}" arxivlansinmi?`)) return;
    await api(`/products/${product._id}`, { method: "DELETE" });
    toast("Mahsulot arxivlandi");
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} kicker="OMBOR" title={product ? "Mahsulotni tahrirlash" : "Yangi mahsulot"} width={560}>
      <div className="form-grid">
        <Field label="Nomi" className="span-2">
          <input value={f.name} onChange={set("name")} />
        </Field>
        <Field label="O'lchami / qadoq">
          <input value={f.unit} onChange={set("unit")} />
        </Field>
        <Field label="Sanash birligi">
          <input value={f.stockUnit} onChange={set("stockUnit")} />
        </Field>
        <Field label="Kategoriya">
          <input list="cats" value={f.category} onChange={set("category")} />
          <datalist id="cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Shtrix-kod">
          <input value={f.barcode} onChange={set("barcode")} />
        </Field>
        <Field label={lockQty ? "Qoldiq (faqat admin o'zgartiradi)" : "Qoldiq"}>
          <input type="number" value={f.quantity} onChange={set("quantity")} disabled={lockQty} />
        </Field>
        <Field label="Kam qoldi chegarasi">
          <input type="number" value={f.minQuantity} onChange={set("minQuantity")} />
        </Field>
        <Field label="Kelish narxi" suffix={
          <select className="mini-select" value={f.costCurrency} onChange={set("costCurrency")}>
            <option value="UZS">so'm</option>
            <option value="USD">$</option>
          </select>
        }>
          <input type="number" step="0.01" value={f.costPrice} onChange={set("costPrice")} />
        </Field>
        <Field label="Sotuv narxi (so'm)">
          <input type="number" value={f.sellPrice} onChange={set("sellPrice")} />
        </Field>
        <Field label="Kartadagi yozuv">
          <input value={f.label} onChange={set("label")} maxLength={8} />
        </Field>
        <Field label="Rangi">
          <input type="color" value={f.color || "#F1E3C8"} onChange={set("color")} />
        </Field>
      </div>
      <div className="modal-actions">
        {product && isAdmin && (
          <button className="btn btn-ghost danger" onClick={remove}>
            <Icon name="trash" /> Arxivlash
          </button>
        )}
        <span className="grow" />
        <button className="btn btn-outline" onClick={onClose}>
          Bekor qilish
        </button>
        <button className="btn btn-primary" onClick={save} disabled={busy || !f.name}>
          {busy ? "Saqlanmoqda..." : "Saqlash"}
        </button>
      </div>
    </Modal>
  );
}

function RateModal({ open, current, onClose, onSaved }) {
  const toast = useToast();
  const [rate, setRate] = useState("");
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (open) {
      setRate(String(current || ""));
      setResult(null);
    }
  }, [open, current]);
  const save = async () => {
    try {
      const r = await api("/rates", { method: "POST", body: { rate: Number(rate) } });
      setResult(r.data);
      toast("Dollar kursi yangilandi");
      onSaved();
    } catch (e) {
      toast(e.message, "error");
    }
  };
  return (
    <Modal open={open} onClose={onClose} kicker="DOLLAR KURSI" title="Kursni yangilash" width={560}>
      {!result ? (
        <>
          <Field label="1 $ necha so'm?" icon="dollar" suffix="so'm">
            <input type="number" autoFocus value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
          <p className="muted small">Kurs o'zgarsa, dollarda olingan har bir mahsulotning tannarxi avtomatik qayta hisoblanadi.</p>
          <button className="btn btn-primary btn-lg btn-block" onClick={save} disabled={!rate}>
            Saqlash va ta'sirini ko'rish
          </button>
        </>
      ) : (
        <>
          <div className={"rate-result " + (result.change >= 0 ? "up" : "down")}>
            1 $ = <b>{fmt(result.rate)} so'm</b> ({result.change >= 0 ? "+" : ""}
            {fmt(result.change)} so'm, {result.percent}%)
            <div className="small">Ombor qiymati o'zgarishi: {result.totalStockValueChange >= 0 ? "+" : ""}{fmt(result.totalStockValueChange)} so'm</div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mahsulot</th>
                  <th className="right">Eski tannarx</th>
                  <th className="right">Yangi tannarx</th>
                  <th className="right">1 donaga</th>
                  <th className="right">Foyda (1 dona)</th>
                </tr>
              </thead>
              <tbody>
                {result.impact.map((i) => (
                  <tr key={i._id}>
                    <td><b>{i.name}</b> <small className="muted">${i.costUsd}</small></td>
                    <td className="right">{fmt(i.oldCostUzs)}</td>
                    <td className="right">{fmt(i.newCostUzs)}</td>
                    <td className={"right " + (i.changePerUnit > 0 ? "red" : "green")}>{i.changePerUnit > 0 ? "+" : ""}{fmt(i.changePerUnit)}</td>
                    <td className={"right " + (i.marginAfter < 0 ? "red" : "")}>{fmt(i.marginAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary btn-block" onClick={onClose}>
            Tayyor
          </button>
        </>
      )}
    </Modal>
  );
}

function PriceChange({ p }) {
  if (p.costCurrency !== "USD") return <span className="muted">— o'zgarmagan</span>;
  const a = p.priceChange.amount;
  if (!a) return <span className="muted">o'zgarmagan</span>;
  return (
    <span className={a > 0 ? "red" : "green"}>
      <b>
        {a > 0 ? "▲ +" : "▼ "}
        {fmt(a)} so'm
      </b>
      <small className="muted block">
        {a > 0 ? "+" : ""}
        {p.priceChange.percent}% · dollar kursi
      </small>
    </span>
  );
}

export default function Ombor() {
  const { isAdmin } = useAuth();
  const { query } = useRoute();
  const [status, setStatus] = useState(query.status || "");
  const [search, setSearch] = useState(query.q || "");
  const [edit, setEdit] = useState(null); // null | "new" | product
  const [rateOpen, setRateOpen] = useState(false);
  useEffect(() => {
    setStatus(query.status || "");
    setSearch(query.q || "");
  }, [query.status, query.q]);

  const { data, loading, error, reload } = useApi(() => api("/products", { query: { status, search } }), [status, search]);
  const s = data?.summary;
  const rate = data?.rate;
  const list = data?.data || [];
  const rateUp = rate && rate.rate !== rate.previousRate;

  const filters = [
    ["", "Barchasi", s?.total, ""],
    ["kam", "Kam qolgan", s?.low, "orange"],
    ["tugadi", "Tugagan", s?.out, "red"],
    ["oshgan", "Narxi oshgan", s?.priceUp, "red"],
    ...(s?.noPrice ? [["narxsiz", "Narxi yo'q", s.noPrice, "red"]] : []),
  ];
  const lowNames = list.filter((p) => p.status === "kam").map((p) => p.name);

  return (
    <>
      <PageHead kicker="OMBOR" title="Mahsulotlar va qoldiq" sub="Har bir mahsulot qancha qolgani, narxi va dollar kursi o'zgarishi.">
        <button className="btn btn-outline" onClick={() => navigate("/taminotchilar")}>
          <Icon name="download" /> Kirim qilish
        </button>
        <button className="btn btn-primary" onClick={() => setEdit("new")}>
          <Icon name="plus" /> Yangi mahsulot
        </button>
      </PageHead>

      {rate && (
        <div className={"rate-banner " + (rate.rate > rate.previousRate ? "up" : rate.rate < rate.previousRate ? "down" : "same")}>
          <span className="iconbox ib-orange-2">
            <Icon name="dollar" size={18} />
          </span>
          <div className="grow">
            <b>
              {rate.rate > rate.previousRate ? "Dollar kursi oshdi" : rate.rate < rate.previousRate ? "Dollar kursi tushdi" : "Dollar kursi"}: 1 $ = {fmt(rate.rate)} so'm
              {rateUp && (
                <span className="rate-delta">
                  {rate.rate > rate.previousRate ? " +" : " "}
                  {fmt(rate.rate - rate.previousRate)} so'm
                </span>
              )}
            </b>
            <small>
              {rateUp ? `Oldin ${fmt(rate.previousRate)} so'm edi. Dollarda kelgan ${s?.priceUp || 0} ta mahsulotning tannarxi o'zgardi — sotuv narxini tekshiring.` : "Dollarda olingan mahsulotlar tannarxi shu kurs bo'yicha hisoblanadi."}
            </small>
          </div>
          {isAdmin && (
            <button className="btn btn-orange" onClick={() => setRateOpen(true)}>
              <Icon name="trend" /> Kursni yangilash
            </button>
          )}
        </div>
      )}

      {s && (
        <div className="grid-4">
          <Stat label="Jami mahsulotlar" value={s.total} unit="tur" icon="box" note={`${s.categories.length} ta kategoriya`} />
          <Stat label="Ombor qiymati" value={fmtShort(s.stockValue)} unit="so'm" icon="wallet" color="purple" note="tannarx bo'yicha" />
          <Stat label="Kam qolgan" value={s.low} unit="ta" icon="alert" color="orange" badge="Diqqat" badgeColor="orange" note={lowNames.slice(0, 2).join(", ")} valueClass="orange" />
          <Stat label="Tugagan" value={s.out} unit="ta" icon="box" color="red" badge="Buyurtma bering" badgeColor="red" valueClass="red" />
        </div>
      )}

      <section className="card">
        <div className="card-head wrap">
          <div className="chips">
            {filters.map(([v, l, n, c]) => (
              <button key={v} className={status === v ? "active" : ""} onClick={() => setStatus(v)}>
                {l} <small className={c}>{n ?? ""}</small>
              </button>
            ))}
          </div>
          <div className="search-box">
            <Icon name="search" size={16} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        <ErrorBox error={error} onRetry={reload} />
        {loading && !data && <Loader />}

        <div className="table-wrap desktop-only">
          <table className="table">
            <thead>
              <tr>
                <th>Mahsulot</th>
                <th>Kategoriya</th>
                <th>Qoldiq</th>
                <th>Kelish narxi</th>
                <th>Sotuv narxi</th>
                <th>Narx o'zgarishi</th>
                <th>Holat</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p._id} className="clickable" onClick={() => setEdit(p)}>
                  <td>
                    <div className="cell-prod">
                      <Avatar name={p.label || p.name} bg={productColor(p)} fg="#2B3036" size={34} radius={8} />
                      <div>
                        <b>{p.name}</b>
                        <small className="muted block">{p.unit}</small>
                      </div>
                    </div>
                  </td>
                  <td className="muted">{p.category}</td>
                  <td>
                    <b className={STATUS[p.status].cls}>
                      {p.quantity} {p.stockUnit}
                    </b>
                    <div className="progress">
                      <i className={STATUS[p.status].cls} style={{ width: `${Math.min(100, (p.quantity / Math.max(p.minQuantity * 4, 1)) * 100)}%` }} />
                    </div>
                  </td>
                  <td>
                    {p.costCurrency === "USD" ? (
                      <>
                        <b>${p.costPrice}</b>
                        <small className="muted block">{fmt(p.costUzs)} so'm</small>
                      </>
                    ) : (
                      <>
                        <Money value={p.costPrice} />
                        <small className="muted block">so'mda olingan</small>
                      </>
                    )}
                  </td>
                  <td>
                    {p.sellPrice > 0 ? (
                      <>
                        <Money value={p.sellPrice} />
                        <small className={"block " + (p.margin < 0 ? "red" : "muted")}>foyda: {fmt(p.margin)}</small>
                      </>
                    ) : (
                      <b className="red">Kiritilmagan</b>
                    )}
                  </td>
                  <td>
                    <PriceChange p={p} />
                  </td>
                  <td>
                    <Pill color={STATUS[p.status].cls}>{STATUS[p.status].label}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mobile-list mobile-only">
          {list.map((p) => (
            <div key={p._id} className="m-item" onClick={() => setEdit(p)}>
              <Avatar name={p.label || p.name} bg={productColor(p)} fg="#2B3036" size={40} radius={10} />
              <div className="grow">
                <div className="row-between">
                  <b>{p.name}</b>
                  <b className={STATUS[p.status].cls}>
                    {p.quantity} {p.stockUnit}
                  </b>
                </div>
                <div className="row-between">
                  <small className="muted">
                    {p.unit || p.stockUnit} · Sotuv: {p.sellPrice > 0 ? fmt(p.sellPrice) : "kiritilmagan"}
                  </small>
                  <Pill color={STATUS[p.status].cls}>{STATUS[p.status].label}</Pill>
                </div>
                <div className="m-sub row-between">
                  <span>{p.costCurrency === "USD" ? `$${p.costPrice} · ${fmt(p.costUzs)} so'm` : `${fmt(p.costPrice)} so'm`}</span>
                  <PriceChange p={p} />
                </div>
              </div>
            </div>
          ))}
        </div>
        {data && list.length === 0 && <Empty icon="box" title="Mahsulot topilmadi" />}
      </section>

      <ProductModal open={!!edit} product={edit === "new" ? null : edit} categories={s?.categories || []} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); window.dispatchEvent(new Event("stock:changed")); }} />
      <RateModal open={rateOpen} current={rate?.rate} onClose={() => setRateOpen(false)} onSaved={reload} />
    </>
  );
}
