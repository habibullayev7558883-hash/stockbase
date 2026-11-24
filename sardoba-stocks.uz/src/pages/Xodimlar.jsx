import { useEffect, useState } from "react";
import Icon from "../components/Icon.jsx";
import { Avatar, Empty, ErrorBox, Field, Loader, Modal, PageHead, Pill, Seg, useToast } from "../components/ui.jsx";
import { api, useApi } from "../api.js";
import { useAuth } from "../auth.jsx";
import { MONTHS_SHORT } from "../format.js";

const EMPTY = { firstName: "", lastName: "", age: "", phone: "", address: "", position: "Sotuvchi", role: "xodim", login: "", password: "", branch: "" };
const POSITIONS = ["Sotuvchi", "Kassir", "Omborchi", "Haydovchi", "Administrator", "Menejer", "Do'kon egasi"];

const fromUser = (u) => {
  const [f, ...rest] = (u.name || "").split(" ");
  return {
    firstName: u.firstName ?? f ?? "",
    lastName: u.lastName ?? rest.join(" "),
    age: u.age ? String(u.age) : "",
    phone: u.phone || "",
    address: u.address || "",
    position: u.position || "",
    role: u.role,
    login: u.login,
    password: "",
    branch: u.branch?._id || u.branch || "",
  };
};

function genPassword() {
  const a = "abcdefghjkmnpqrstuvwxyz", d = "23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
  for (let i = 0; i < 4; i++) s += d[Math.floor(Math.random() * d.length)];
  return s;
}

function UserModal({ open, user, onClose, onSaved }) {
  const toast = useToast();
  const { user: me, branches, branch: curBranch } = useAuth();
  const [f, setF] = useState(EMPTY);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);
  const isEdit = !!user;
  const isSelf = isEdit && user._id === me?._id;

  useEffect(() => {
    if (open) {
      setF(user ? fromUser(user) : { ...EMPTY, branch: curBranch?._id || branches[0]?._id || "" });
      setShow(!user);
      setCreated(null);
    }
  }, [open, user]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...f, age: f.age ? Number(f.age) : "" };
      if (isEdit && !body.password) delete body.password;
      if (isSelf) delete body.role;
      if (isEdit) {
        await api(`/users/${user._id}`, { method: "PUT", body });
        toast("Ma'lumotlar saqlandi");
        onSaved();
      } else {
        const r = await api("/users", { method: "POST", body });
        setCreated({ ...r.data, password: f.password });
        onSaved(true);
      }
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    return (
      <Modal open={open} onClose={onClose} kicker="TAYYOR" title="Xodim qo'shildi" width={440}>
        <div className="success">
          <span className="success-icon">
            <Icon name="check" size={30} stroke={2.6} />
          </span>
          <h2>{created.name}</h2>
          <p className="muted">Quyidagi login va parolni xodimga bering. U shu orqali tizimga kiradi.</p>
          <div className="cred">
            <div>
              <small className="muted">Login</small>
              <b>{created.login}</b>
            </div>
            <div>
              <small className="muted">Parol</small>
              <b>{created.password}</b>
            </div>
            <div>
              <small className="muted">Panel</small>
              <b>{created.role === "admin" ? "Admin" : "Xodim"}</b>
            </div>
          </div>
          <button className="btn btn-primary btn-lg btn-block" onClick={onClose}>
            Tayyor
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} kicker="XODIMLAR" title={isEdit ? "Xodim ma'lumotlari" : "Yangi xodim qo'shish"} width={600}>
      <h4 className="form-sec">Shaxsiy ma'lumotlar</h4>
      <div className="form-grid">
        <Field label="Ismi" icon="user">
          <input autoFocus value={f.firstName} onChange={set("firstName")} />
        </Field>
        <Field label="Familiyasi">
          <input value={f.lastName} onChange={set("lastName")} />
        </Field>
        <Field label="Yoshi">
          <input inputMode="numeric" value={f.age} onChange={(e) => setF({ ...f, age: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
        </Field>
        <Field label="Telefon raqami" icon="phone">
          <input value={f.phone} onChange={set("phone")} />
        </Field>
        <Field label="Uy manzili" icon="store" className="span-2">
          <input value={f.address} onChange={set("address")} />
        </Field>
        <Field label="Qaysi filialda ishlaydi" icon="store">
          <select value={f.branch} onChange={set("branch")}>
            {!f.branch && <option value="">— tanlang —</option>}
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lavozimi">
          <input list="positions" value={f.position} onChange={set("position")} />
          <datalist id="positions">
            {POSITIONS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
      </div>

      <h4 className="form-sec">Panel (qaysi bo'limlarni ko'radi)</h4>
      {isSelf ? (
        <p className="muted small mb14">O'zingizning rolingizni o'zgartira olmaysiz.</p>
      ) : (
        <div className="role-pick">
          <button type="button" className={f.role === "xodim" ? "active" : ""} onClick={() => setF({ ...f, role: "xodim" })}>
            <Icon name="user" size={20} />
            <b>Xodim paneli</b>
            <small>Sotuv, Ombor, Xarajatlar, Qaytarish</small>
          </button>
          <button type="button" className={f.role === "admin" ? "active" : ""} onClick={() => setF({ ...f, role: "admin" })}>
            <Icon name="users" size={20} />
            <b>Admin paneli</b>
            <small>Hamma bo'limlar, hisobotlar va xodimlarni boshqarish</small>
          </button>
        </div>
      )}

      <h4 className="form-sec">Kirish uchun</h4>
      <div className="form-grid">
        <Field label="Login (lotin harflarida, bo'sh joysiz)" icon="user">
          <input value={f.login} onChange={(e) => setF({ ...f, login: e.target.value.toLowerCase().replace(/\s/g, "") })} autoComplete="off" />
        </Field>
        <Field
          label={isEdit ? "Yangi parol (o'zgartirmasangiz bo'sh qoldiring)" : "Parol (kamida 6 ta belgi)"}
          suffix={
            <span className="row gap10">
              <button type="button" className="link small" onClick={() => setShow((v) => !v)}>
                {show ? "Yashirish" : "Ko'rsatish"}
              </button>
              <button
                type="button"
                className="link small"
                onClick={() => {
                  setF({ ...f, password: genPassword() });
                  setShow(true);
                }}
              >
                Yaratish
              </button>
            </span>
          }
        >
          <input type={show ? "text" : "password"} value={f.password} onChange={set("password")} autoComplete="new-password" />
        </Field>
      </div>

      <button className="btn btn-primary btn-lg btn-block" onClick={save} disabled={busy || !f.firstName.trim() || !f.login || (!isEdit && f.password.length < 6)}>
        <Icon name="check" stroke={2.4} /> {busy ? "Saqlanmoqda..." : isEdit ? "Saqlash" : "Xodimni qo'shish"}
      </button>
    </Modal>
  );
}

export default function Xodimlar() {
  const toast = useToast();
  const { user: me } = useAuth();
  const { data, loading, error, reload } = useApi(() => api("/users"), []);
  const [edit, setEdit] = useState(null); // null | "new" | user
  const [filter, setFilter] = useState("faol");
  const all = data?.data || [];
  const list = all.filter((u) => (filter === "faol" ? u.isActive : filter === "bloklangan" ? !u.isActive : true));

  const toggle = async (u) => {
    const block = u.isActive;
    if (block && !confirm(`${u.name} bloklansinmi? U tizimga kira olmaydi (savdo tarixi saqlanib qoladi).`)) return;
    try {
      await api(`/users/${u._id}`, { method: "PUT", body: { isActive: !block } });
      toast(block ? `${u.name} bloklandi` : `${u.name} qayta faollashtirildi`);
      reload();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const joined = (d) => {
    const x = new Date(d);
    return `${x.getDate()} ${MONTHS_SHORT[x.getMonth()]} ${x.getFullYear()}`;
  };

  return (
    <>
      <PageHead kicker="XODIMLAR" title="Xodimlar va adminlar" sub="Faqat adminlar ko'radi. Yangi xodim qo'shing va unga login-parol bering.">
        <button className="btn btn-primary" onClick={() => setEdit("new")}>
          <Icon name="plus" /> Yangi xodim qo'shish
        </button>
      </PageHead>

      <div className="toolbar">
        <Seg
          items={[
            ["faol", `Faol (${all.filter((u) => u.isActive).length})`],
            ["bloklangan", `Bloklangan (${all.filter((u) => !u.isActive).length})`],
            ["hammasi", "Hammasi"],
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      <ErrorBox error={error} onRetry={reload} />
      {loading && !data && <Loader />}
      {data && list.length === 0 && <Empty icon="users" title="Bu ro'yxatda hech kim yo'q" />}

      <div className="staff-grid">
        {list.map((u) => {
          const self = u._id === me?._id;
          return (
            <div key={u._id} className={"card staff" + (u.isActive ? "" : " blocked")}>
              <div className="row gap10">
                <Avatar name={u.name} size={46} />
                <div className="grow">
                  <b className="staff-name">
                    {u.name} {self && <small className="muted">(siz)</small>}
                  </b>
                  <small className="muted block">{u.position || "—"}</small>
                </div>
                <Pill color={u.role === "admin" ? "purple" : "green"}>{u.role === "admin" ? "Admin" : "Xodim"}</Pill>
              </div>
              <div className="staff-info">
                <div>
                  <Icon name="phone" size={14} />
                  <span>{u.phone || "—"}</span>
                </div>
                <div>
                  <Icon name="user" size={14} />
                  <span>{u.age ? `${u.age} yosh` : "—"}</span>
                </div>
                <div className="span-2">
                  <Icon name="store" size={14} />
                  <span>
                    Filial: <b>{u.branch?.name || "—"}</b>
                  </span>
                </div>
                <div className="span-2">
                  <Icon name="user" size={14} />
                  <span>{u.address || "—"}</span>
                </div>
                <div>
                  <Icon name="clipboard" size={14} />
                  <span>
                    Login: <b>{u.login}</b>
                  </span>
                </div>
                <div>
                  <Icon name="calendar" size={14} />
                  <span>{u.createdAt ? joined(u.createdAt) : ""}</span>
                </div>
              </div>
              {!u.isActive && <Pill color="red">Bloklangan — tizimga kira olmaydi</Pill>}
              <div className="row gap10">
                <button className="btn btn-sm btn-outline grow" onClick={() => setEdit(u)}>
                  <Icon name="edit" size={14} /> Tahrirlash
                </button>
                {!self && (
                  <button className={"btn btn-sm grow " + (u.isActive ? "btn-ghost danger" : "btn-outline")} onClick={() => toggle(u)}>
                    <Icon name={u.isActive ? "x" : "check"} size={14} /> {u.isActive ? "Bloklash" : "Faollashtirish"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <UserModal open={!!edit} user={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={(isNew) => { if (!isNew) setEdit(null); reload(); }} />
    </>
  );
}
