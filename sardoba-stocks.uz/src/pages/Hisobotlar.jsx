import { useState } from "react";
import Icon from "../components/Icon.jsx";
import { Avatar, Bars, Card, ErrorBox, Loader, Money, PageHead, Pill, Seg, Stat } from "../components/ui.jsx";
import { api, useApi } from "../api.js";
import { useAuth } from "../auth.jsx";
import { CATEGORY_COLORS, MONTHS, MONTHS_SHORT, PAY_LABEL, fmt, fmtShort, monthStr, todayStr } from "../format.js";

const PAY_COLORS = { naqd: "green", karta: "purple", nasiya: "orange" };

function Workers({ rows, total, receipts }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Xodim</th>
            <th>Cheklar</th>
            <th>O'rtacha chek</th>
            <th>Ulushi</th>
            <th className="right">Savdo summasi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((w) => (
            <tr key={w.user}>
              <td>
                <div className="cell-prod">
                  <Avatar name={w.name} size={32} />
                  <div>
                    <b>{w.name}</b> {w.best && <Pill color="orange">Eng yaxshi</Pill>}
                    <small className="muted block">{w.position}</small>
                  </div>
                </div>
              </td>
              <td>{w.count} ta</td>
              <td>
                <Money value={w.avgReceipt} />
              </td>
              <td>
                <div className="share">
                  <div className="progress">
                    <i className="green" style={{ width: `${w.share}%` }} />
                  </div>
                  <span>{w.share}%</span>
                </div>
              </td>
              <td className="right">
                <b>
                  <Money value={w.total} />
                </b>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>
              <b>
                Jami: {rows.length} xodim · {receipts} ta chek
              </b>
            </td>
            <td className="right">
              <Money value={total} className="total-big" />
            </td>
          </tr>
        </tfoot>
      </table>
      {rows.length === 0 && <p className="muted center small">Bu davrda savdo yo'q</p>}
    </div>
  );
}

/** "Barcha filiallar" tanlanganda: har bir filial qancha savdo qildi */
function Branches({ rows }) {
  const { allBranches } = useAuth();
  if (!allBranches || !rows?.length) return null;
  return (
    <Card title="Filiallar bo'yicha" sub="Har bir do'kon qancha savdo qildi">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Filial</th>
              <th>Cheklar</th>
              <th>Ulushi</th>
              <th className="right">Savdo summasi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.branch || "none"}>
                <td>
                  <b>{b.name || "—"}</b>
                </td>
                <td>{b.count} ta</td>
                <td>
                  <div className="share">
                    <div className="progress">
                      <i className="green" style={{ width: `${b.share}%` }} />
                    </div>
                    <span>{b.share}%</span>
                  </div>
                </td>
                <td className="right">
                  <b>
                    <Money value={b.total} />
                  </b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Payments({ rows, total }) {
  return (
    <>
      <div className="stack-bar tall">
        {rows.map((p) => (
          <i key={p.type} className={"bg-" + PAY_COLORS[p.type]} style={{ width: `${total ? (p.total / total) * 100 : 0}%` }} />
        ))}
      </div>
      <div className="pay-list">
        {rows.map((p) => (
          <div key={p.type}>
            <i className={"bg-" + PAY_COLORS[p.type]} />
            <b>{PAY_LABEL[p.type]}</b>
            <span className="muted">{p.share}%</span>
            <span className="muted small">{p.count} chek</span>
            <Money value={p.total} />
          </div>
        ))}
      </div>
    </>
  );
}

function Daily({ date }) {
  const { data, loading, error, reload } = useApi(() => api("/reports/daily", { query: { date } }), [date]);
  const d = data?.data;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading && !d) return <Loader />;
  if (!d) return null;
  const t = d.totals;
  return (
    <>
      <div className="grid-4">
        <Stat label="Kunlik savdo" value={t.sales} icon="dollar" badge={`${t.salesChange >= 0 ? "+" : ""}${t.salesChange}%`} badgeColor={t.salesChange >= 0 ? "green" : "red"} note="kechagiga nisbatan" />
        <Stat label="Cheklar soni" value={t.receipts} unit="ta" icon="receipt" color="purple" badge={`${t.receiptsChange >= 0 ? "+" : ""}${t.receiptsChange} ta`} badgeColor={t.receiptsChange >= 0 ? "green" : "red"} note="kechagiga nisbatan" />
        <Stat label="O'rtacha chek" value={t.avgReceipt} icon="card" color="orange" note={t.returned ? `qaytarildi: ${fmt(t.returned)}` : "bitta xaridor o'rtacha"} />
        <Stat label="Sof foyda" value={t.netProfit} icon="trend" badge={`${t.netMargin}%`} badgeColor={t.netProfit >= 0 ? "green" : "red"} note={`xarajat: ${fmtShort(t.expenses)}`} valueClass={t.netProfit < 0 ? "red" : ""} />
      </div>
      <div className="grid-main">
        <Card title="Soatlar bo'yicha savdo" sub={d.peakHour ? `Eng faol soat: ${d.peakHour.hour}` : "06:00 – 24:00"}>
          <Bars format={fmtShort} labelEvery={2} data={d.byHour.map((h) => ({ label: h.hour.slice(0, 2), value: h.total }))} />
        </Card>
        <Card title="To'lov turlari" sub="Savdo qanday to'langan">
          <Payments rows={d.byPayment} total={t.sales} />
          {d.expensesByCategory.length > 0 && (
            <>
              <h4 className="mt16">Kunlik xarajatlar</h4>
              <div className="legend">
                {d.expensesByCategory.map((c) => (
                  <div key={c.category}>
                    <i className={"bg-" + (CATEGORY_COLORS[c.category] || "gray")} />
                    <span>{c.category}</span>
                    <b>{fmt(c.total)}</b>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
      <Branches rows={d.byBranch} />
      <Card title="Xodimlar savdosi" sub="Kim bir kunda nechta chek va qancha pulga savdo qildi">
        <Workers rows={d.byWorker} total={t.sales} receipts={t.receipts} />
      </Card>
    </>
  );
}

function Monthly({ month }) {
  const { data, loading, error, reload } = useApi(() => api("/reports/monthly", { query: { month } }), [month]);
  const d = data?.data;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading && !d) return <Loader />;
  if (!d) return null;
  const t = d.totals;
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const byDay = Array.from({ length: days }, (_, i) => {
    const key = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { label: String(i + 1), value: d.byDay.find((x) => x.date === key)?.total || 0 };
  });
  return (
    <>
      <div className="grid-4">
        <Stat label={`${MONTHS[m - 1]} savdosi`} value={t.sales} icon="dollar" note={`${t.receipts} ta chek`} />
        <Stat label="O'rtacha chek" value={t.avgReceipt} icon="card" color="purple" />
        <Stat label="Xarajatlar" value={t.expenses} icon="wallet" color="red" valueClass="red" />
        <Stat label="Sof foyda" value={t.netProfit} icon="trend" valueClass={t.netProfit < 0 ? "red" : "green"} note={`yalpi foyda: ${fmtShort(t.grossProfit)}`} />
      </div>
      <div className="grid-main">
        <Card title="Kunlar bo'yicha savdo" sub={`${MONTHS[m - 1]} ${y}`}>
          <Bars format={fmtShort} labelEvery={5} data={byDay} />
        </Card>
        <Card title="Oxirgi 6 oy" sub="Oylik savdo">
          <Bars
            format={fmtShort}
            highlightLast
            height={130}
            data={d.last6Months.map((x) => ({ label: MONTHS_SHORT[Number(x.month.slice(5)) - 1], value: x.total }))}
          />
          <h4 className="mt16">To'lov turlari</h4>
          <Payments rows={d.byPayment} total={t.sales} />
        </Card>
      </div>
      <Branches rows={d.byBranch} />
      <Card title="Xodimlar savdosi" sub={`${MONTHS[m - 1]} oyi bo'yicha`}>
        <Workers rows={d.byWorker} total={t.sales} receipts={t.receipts} />
      </Card>
    </>
  );
}

export default function Hisobotlar() {
  const [mode, setMode] = useState("daily");
  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(monthStr());
  const shiftDay = (n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    setDate(d.toLocaleDateString("sv"));
  };
  return (
    <>
      <PageHead kicker="HISOBOTLAR" title="Savdo hisobotlari" sub="Kunlik va oylik natijalar, xodimlar qancha savdo qilgani.">
        <Seg items={[["daily", "Kunlik"], ["monthly", "Oylik"]]} value={mode} onChange={setMode} />
        {mode === "daily" ? (
          <div className="date-nav">
            <button className="icon-btn" onClick={() => shiftDay(-1)}>
              <Icon name="chevLeft" size={16} />
            </button>
            <input type="date" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
            <button className="icon-btn" onClick={() => shiftDay(1)} disabled={date >= todayStr()}>
              <Icon name="chevRight" size={16} />
            </button>
          </div>
        ) : (
          <div className="date-nav">
            <input type="month" value={month} max={monthStr()} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </div>
        )}
      </PageHead>
      {mode === "daily" ? <Daily date={date} /> : <Monthly month={month} />}
    </>
  );
}
