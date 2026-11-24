import { useState } from "react";
import Icon from "../components/Icon.jsx";
import { Avatar, Card, Empty, ErrorBox, Field, Loader, Modal, Money, PageHead, Pill, Seg, Stat, useToast } from "../components/ui.jsx";
import { api, useApi } from "../api.js";
import { useAuth } from "../auth.jsx";
import { CATEGORY_COLORS, dateTime, fmt, time } from "../format.js";

function AddExpense({ open, onClose, onSaved, users, categories, isAdmin, me }) {
  const toast = useToast();
  const [f, setF] = useState({ note: "", amount: "", category: "Transport", user: "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api("/expenses", { method: "POST", body: { ...f, amount: Number(String(f.amount).replace(/\s/g, "")), user: f.user || undefined } });
      toast("Xarajat qo'shildi");
      setF({ note: "", amount: "", category: f.category, user: f.user });
      onSaved();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} kicker="XARAJAT" title="Xarajat qo'shish">
      <div className="form-col">
        {isAdmin ? (
          <Field label="Kim sarfladi" icon="user">
            <select value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })}>
              <option value="">{me.name} (men)</option>
              {users.filter((u) => u._id !== me._id && u.isActive).map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name} — {u.position}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="who">
            <Avatar name={me.name} size={32} /> <b>{me.name}</b> <small className="muted">nomidan yoziladi</small>
          </div>
        )}
        <Field label="Turi">
          <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Nimaga sarflandi">
          <input autoFocus value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
        <Field label="Summa" icon="wallet" suffix="so'm">
          <input inputMode="numeric" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value.replace(/[^\d]/g, "") })} />
        </Field>
        <button className="btn btn-primary btn-lg btn-block" onClick={save} disabled={busy || !f.note || !f.amount}>
          <Icon name="check" stroke={2.4} /> Saqlash
        </button>
      </div>
    </Modal>
  );
}

export default function Xarajatlar() {
  const { isAdmin, user } = useAuth();
  const toast = useToast();
  const [period, setPeriod] = useState("today");
  const [who, setWho] = useState("");
  const [open, setOpen] = useState(false);
  const { data, loading, error, reload } = useApi(() => api("/expenses", { query: { period, user: who } }), [period, who]);
  const users = useApi(() => (isAdmin ? api("/users") : Promise.resolve({ data: [] })), [isAdmin]);
  const cats = useApi(() => api("/expenses/categories"), []);

  const s = data?.summary;
  const list = data?.data || [];
  const top = s?.byUser?.[0];
  const maxU = Math.max(1, ...(s?.byUser || []).map((u) => u.total));
  const periodLabel = { today: "Bugun", week: "Oxirgi 7 kun", month: "Shu oy" }[period];

  const del = async (e) => {
    if (!confirm(`"${e.note}" xarajati o'chirilsinmi?`)) return;
    try {
      await api(`/expenses/${e._id}`, { method: "DELETE" });
      toast("O'chirildi");
      reload();
    } catch (er) {
      toast(er.message, "error");
    }
  };

  return (
    <>
      <PageHead kicker="XARAJATLAR" title="Xarajatlar" sub={isAdmin ? "Xodimlar nimaga qancha sarflagani va jami xarajat." : "Siz kiritgan xarajatlar va jami summa."}>
        <button className="btn btn-primary" onClick={() => setOpen(true)}>
          <Icon name="plus" /> Xarajat qo'shish
        </button>
      </PageHead>

      <div className="toolbar">
        <Seg items={[["today", "Bugun"], ["week", "Hafta"], ["month", "Oy"]]} value={period} onChange={setPeriod} />
        {isAdmin && (
          <label className="select-pill">
            <Icon name="users" size={15} />
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">Barcha xodimlar</option>
              {(users.data?.data || []).map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <ErrorBox error={error} onRetry={reload} />
      {loading && !data && <Loader />}

      {s && (
        <div className="grid-4">
          <Stat label={`${periodLabel} jami xarajat`} value={s.total} icon="wallet" color="red" badge={`${s.count} ta yozuv`} badgeColor="red" />
          <Stat label="Eng ko'p sarflagan" value={top ? top.total : 0} icon="users" color="orange" badge={top?.name || "—"} badgeColor="orange" note={top?.position} />
          <Stat label="Eng katta tur" value={s.byCategory[0]?.total || 0} icon="chart" color="purple" badge={s.byCategory[0]?.category || "—"} badgeColor="purple" />
          <Stat label="O'rtacha xarajat" value={s.count ? Math.round(s.total / s.count) : 0} icon="coin" note="bitta yozuvga" />
        </div>
      )}

      {data && (
        <div className="grid-main">
          <Card title="Xarajatlar ro'yxati" sub={periodLabel}>
            {list.length === 0 && <Empty icon="wallet" title="Xarajat yo'q" text="Yangi xarajat qo'shish uchun yuqoridagi tugmani bosing" />}
            <div className="exp-list">
              {list.map((e) => (
                <div className="exp-row" key={e._id}>
                  <span className="exp-time">{period === "today" ? time(e.spentAt) : dateTime(e.spentAt)}</span>
                  <Avatar name={e.user?.name} size={36} />
                  <div className="grow">
                    <b>{e.user?.name}</b>
                    <small className="muted block">{e.user?.position}</small>
                  </div>
                  <Pill color={CATEGORY_COLORS[e.category] || "gray"}>{e.category}</Pill>
                  <span className="exp-note">{e.note}</span>
                  <Money value={e.amount} className="exp-amount" />
                  {isAdmin && (
                    <button className="icon-btn sm" onClick={() => del(e)} title="O'chirish">
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {list.length > 0 && (
              <div className="total-row">
                <div>
                  <b>Jami xarajat</b>
                  <small className="muted block">
                    {s.count} ta yozuv · {s.byUser.length} xodim
                  </small>
                </div>
                <Money value={s.total} className="total-big" />
              </div>
            )}
          </Card>

          <Card title="Kim qancha sarfladi" sub={periodLabel}>
            {s.byUser.length === 0 && <p className="muted small">Ma'lumot yo'q</p>}
            <div className="list">
              {s.byUser.map((u) => (
                <div className="who-row" key={u.user}>
                  <Avatar name={u.name} size={34} />
                  <div className="grow">
                    <div className="row-between">
                      <b>{u.name}</b>
                      <Money value={u.total} />
                    </div>
                    <small className="muted">
                      {u.position} · {u.count} ta xarajat
                    </small>
                    <div className="progress">
                      <i className="green" style={{ width: `${(u.total / maxU) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {s.byCategory.length > 0 && (
              <>
                <h4 className="mt16">Turlari bo'yicha</h4>
                <div className="stack-bar">
                  {s.byCategory.map((c) => (
                    <i key={c.category} className={"bg-" + (CATEGORY_COLORS[c.category] || "gray")} style={{ width: `${(c.total / s.total) * 100}%` }} title={c.category} />
                  ))}
                </div>
                <div className="legend">
                  {s.byCategory.map((c) => (
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
      )}

      <AddExpense
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          reload();
        }}
        users={users.data?.data || []}
        categories={cats.data?.data || ["Boshqa"]}
        isAdmin={isAdmin}
        me={user}
      />
    </>
  );
}
