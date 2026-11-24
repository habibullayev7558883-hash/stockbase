import Icon from "../components/Icon.jsx";
import { Avatar, Bars, Card, ErrorBox, Loader, Money, PageHead, Pill, Stat } from "../components/ui.jsx";
import { api, useApi } from "../api.js";
import { useAuth } from "../auth.jsx";
import { MONTHS_SHORT, PAY_LABEL, SALE_STATUS, STATUS, fmtShort, greeting, longDate, productColor, time } from "../format.js";
import { navigate } from "../router.js";

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(() => api("/dashboard"), []);
  const d = data?.data;
  const first = (user?.name || "").split(" ")[0];

  return (
    <>
      <PageHead kicker={longDate().toUpperCase()} title={`${greeting()}, ${first}`} sub="Do'koningizdagi bugungi holat bilan tanishing.">
        <button className="btn btn-primary" onClick={() => navigate("/sotuv")}>
          <Icon name="cart" /> Yangi sotuv
        </button>
      </PageHead>

      <ErrorBox error={error} onRetry={reload} />
      {loading && !d && <Loader />}

      {d && (
        <>
          <div className="grid-4">
            <Stat label="Bugungi savdo" value={d.todaySales.total} icon="dollar" badge={`${d.todaySales.change >= 0 ? "+" : ""}${d.todaySales.change}%`} badgeColor={d.todaySales.change >= 0 ? "green" : "red"} note="kechagiga nisbatan" />
            <Stat label="Haftalik savdo" value={d.weekSales.total} icon="chart" color="purple" badge={`${d.weekSales.change >= 0 ? "+" : ""}${d.weekSales.change}%`} badgeColor={d.weekSales.change >= 0 ? "green" : "red"} note="o'tgan haftaga" />
            <Stat label="Kassadagi sof pul" value={d.cash.total} icon="wallet" color="orange" badge="Naqd" badgeColor="orange" note={`xarajat: ${fmtShort(d.cash.expenses)}`} />
            <Stat label="Umumiy qarzdorlik" value={d.customersDebt.total} icon="card" color="red" badge={`${d.customersDebt.customers} mijoz`} badgeColor="red" note={d.customersDebt.overdue ? `${d.customersDebt.overdue} ta muddati o'tgan` : "muddati o'tgan yo'q"} />
          </div>

          <div className="grid-main">
            <Card title="Savdo dinamikasi" sub="Oxirgi 30 kunlik tushum">
              <div className="big-number">
                <Money value={d.chart30.total} />
              </div>
              <Bars
                highlightLast
                labelEvery={7}
                format={fmtShort}
                data={d.chart30.series.map((s) => {
                  const [, m, day] = s.date.split("-").map(Number);
                  return { label: `${day} ${MONTHS_SHORT[m - 1]}`, value: s.total };
                })}
              />
            </Card>

            <Card
              title="Ombor holati"
              sub="Diqqat talab qiladiganlar"
              action={
                <a className="link" href="#/ombor?status=kam">
                  Barchasi <Icon name="chevRight" size={14} />
                </a>
              }
            >
              <div className="mini-stats">
                <div>
                  <span className="iconbox ib-solid-orange">
                    <Icon name="box" size={18} />
                  </span>
                  <b>{d.stock.low}</b>
                  <small>Kam qolgan</small>
                </div>
                <div>
                  <span className="iconbox ib-solid-red">
                    <Icon name="box" size={18} />
                  </span>
                  <b>{d.stock.out}</b>
                  <small>Tugagan</small>
                </div>
              </div>
              {d.stock.items.length === 0 && <p className="muted small center">Hammasi yetarli ✓</p>}
              <div className="list">
                {d.stock.items.map((p) => (
                  <div className="list-row" key={p._id}>
                    <Avatar name={p.name} bg={productColor(p)} fg="#2B3036" size={34} radius={8} />
                    <div className="grow">
                      <b>{p.name}</b>
                      <small>{p.unit}</small>
                    </div>
                    <Pill color={STATUS[p.status].cls}>{p.status === "tugadi" ? "Tugadi" : `${p.quantity} qoldi`}</Pill>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card
            title="So'nggi savdolar"
            sub="Oxirgi operatsiyalar"
            action={
              <a className="link" href="#/hisobotlar">
                Hisobotlar <Icon name="chevRight" size={14} />
              </a>
            }
          >
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Chek raqami</th>
                    <th>Mijoz</th>
                    <th>Kassir</th>
                    <th>Vaqt</th>
                    <th>To'lov</th>
                    <th className="right">Summa</th>
                    <th>Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentSales.map((s) => (
                    <tr key={s._id}>
                      <td><b>#{s.receiptNo}</b></td>
                      <td>{s.customerName}</td>
                      <td>{s.cashier}</td>
                      <td>{time(s.createdAt)}</td>
                      <td>{PAY_LABEL[s.paymentType]}</td>
                      <td className="right"><Money value={s.total} /></td>
                      <td><Pill color={SALE_STATUS[s.status].cls}>{SALE_STATUS[s.status].label}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {d.recentSales.length === 0 && <p className="muted center small">Hali savdo yo'q</p>}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
