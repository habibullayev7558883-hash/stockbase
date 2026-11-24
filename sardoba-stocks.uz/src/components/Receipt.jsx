import { createPortal } from "react-dom";
import { code128 } from "../code128.js";
import { fmt, PAY_LABEL } from "../format.js";

/** Chek shtrix-kodi: "00" + 6 xonali chek raqami, masalan 00010065 */
export const receiptCode = (no) => "00" + String(no).padStart(6, "0");

export function Barcode({ value, height = 46, module = 1.6 }) {
  const bits = code128(value);
  const quiet = 10;
  const width = (bits.length + quiet * 2) * module;
  const rects = [];
  let i = 0;
  while (i < bits.length) {
    if (bits[i] === "1") {
      let j = i;
      while (j < bits.length && bits[j] === "1") j++;
      rects.push(<rect key={i} x={(i + quiet) * module} y={0} width={(j - i) * module} height={height} />);
      i = j;
    } else i++;
  }
  return (
    <svg className="barcode" viewBox={`0 0 ${width} ${height}`} width={width} height={height} fill="#000" shapeRendering="crispEdges">
      {rects}
    </svg>
  );
}

const pad = (n) => String(n).padStart(2, "0");
const dt = (d) => {
  const x = new Date(d);
  return `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.${x.getFullYear()}  ${pad(x.getHours())}:${pad(x.getMinutes())}`;
};

/** Chop etiladigan chek (faqat printerda ko'rinadi) */
export function PrintReceipt({ sale, branch }) {
  if (!sale) return null;
  const code = receiptCode(sale.receiptNo);
  return createPortal(
    <div className="print-only">
      <div className="rcpt">
        <div className="rcpt-head">
          <b className="rcpt-shop">ULGURJI</b>
          <span>savdo boshqaruvi</span>
          <span>{branch || "Sardoba"}</span>
        </div>
        <div className="rcpt-line" />
        <div className="rcpt-row"><span>Chek</span><b>#{sale.receiptNo}</b></div>
        <div className="rcpt-row"><span>Sana / vaqt</span><b>{dt(sale.createdAt)}</b></div>
        <div className="rcpt-row"><span>Kassir</span><b>{sale.cashier?.name || "—"}</b></div>
        <div className="rcpt-row"><span>Mijoz</span><b>{sale.customerName || "Naqd savdo"}</b></div>
        <div className="rcpt-line" />
        {sale.items.map((i, k) => (
          <div className="rcpt-item" key={k}>
            <div className="rcpt-name">{k + 1}. {i.name}</div>
            {i.barcode && <div className="rcpt-code">Shtrix-kod: {i.barcode}</div>}
            <div className="rcpt-row">
              <span>{i.quantity} {i.unit || "dona"} × {fmt(i.price)}</span>
              <b>{fmt(i.total)}</b>
            </div>
          </div>
        ))}
        <div className="rcpt-line" />
        {sale.discount > 0 && (
          <>
            <div className="rcpt-row"><span>Oraliq summa</span><span>{fmt(sale.subtotal)}</span></div>
            <div className="rcpt-row"><span>Chegirma</span><span>−{fmt(sale.discount)}</span></div>
          </>
        )}
        <div className="rcpt-row rcpt-total"><span>JAMI</span><b>{fmt(sale.total)} so'm</b></div>
        <div className="rcpt-row"><span>To'lov turi</span><b>{PAY_LABEL[sale.paymentType]}</b></div>
        {sale.returnedAmount > 0 && <div className="rcpt-row"><span>Qaytarilgan</span><b>−{fmt(sale.returnedAmount)}</b></div>}
        <div className="rcpt-line" />
        <div className="rcpt-barcode">
          <Barcode value={code} />
          <span>{code}</span>
        </div>
        <div className="rcpt-foot">
          Xaridingiz uchun rahmat!
          <br />
          Qaytarishda shu chekni ko'rsating.
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Chekni chop etish: komponent chizilgach printer oynasini ochadi */
export function printNow() {
  setTimeout(() => window.print(), 80);
}

/** Kirim nakladnoyi (ta'minotchidan olingan tovarlar) — chop etish uchun */
export function PrintInvoice({ inv, branch }) {
  if (!inv) return null;
  const cur = inv.currency === "USD" ? "$" : "so'm";
  const money = (v) => (inv.currency === "USD" ? Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 }) : fmt(v));
  return createPortal(
    <div className="print-only">
      <div className="rcpt">
        <div className="rcpt-head">
          <b className="rcpt-shop">ULGURJI</b>
          <span>{branch || "Sardoba"}</span>
          <b style={{ marginTop: 6, fontSize: 13 }}>KIRIM NAKLADNOYI №{inv.invoiceNo}</b>
        </div>
        <div className="rcpt-line" />
        <div className="rcpt-row"><span>Sana / vaqt</span><b>{dt(inv.createdAt)}</b></div>
        <div className="rcpt-row"><span>Ta'minotchi</span><b>{inv.supplier?.name || inv.supplierName}</b></div>
        {inv.supplier?.phone && <div className="rcpt-row"><span>Telefon</span><span>{inv.supplier.phone}</span></div>}
        <div className="rcpt-row"><span>Qabul qildi</span><b>{inv.createdBy?.name || "—"}</b></div>
        <div className="rcpt-line" />
        {inv.items.map((i, k) => (
          <div className="rcpt-item" key={k}>
            <div className="rcpt-name">{k + 1}. {i.name}</div>
            <div className="rcpt-row">
              <span>{i.quantity} {i.unit} × {money(i.unitPrice)}</span>
              <b>{money(i.total)}</b>
            </div>
          </div>
        ))}
        <div className="rcpt-line" />
        <div className="rcpt-row"><span>Tovarlar soni</span><b>{inv.items.length} xil</b></div>
        <div className="rcpt-row rcpt-total"><span>JAMI</span><b>{money(inv.totalCurrency)} {cur}</b></div>
        {inv.currency === "USD" && <div className="rcpt-row"><span>So'mda (1$ = {fmt(inv.rate)})</span><b>{fmt(inv.total)} so'm</b></div>}
        <div className="rcpt-row"><span>To'landi</span><b>{fmt(inv.paid)} so'm</b></div>
        <div className="rcpt-row"><span>Qarzga qoldi</span><b>{fmt(inv.debt)} so'm</b></div>
        <div className="rcpt-line" />
        <div className="rcpt-sign"><span>Topshirdi:</span><i /></div>
        <div className="rcpt-sign"><span>Qabul qildi:</span><i /></div>
      </div>
    </div>,
    document.body,
  );
}
