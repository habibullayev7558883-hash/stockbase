import { useEffect, useRef, useState } from "react";
import Icon from "./Icon.jsx";
import { Avatar, useToast } from "./ui.jsx";
import { useAuth } from "../auth.jsx";
import { SECTIONS, navigate } from "../router.js";
import { dateTime } from "../format.js";
import { useInstall } from "../pwa.js";
import { api } from "../api.js";
import BranchModal from "./BranchModal.jsx";

function useAlerts() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api("/products/alerts")
        .then((r) => alive && setN(r.summary.low + r.summary.out))
        .catch(() => {});
    load();
    const t = setInterval(load, 60000);
    window.addEventListener("stock:changed", load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("stock:changed", load);
    };
  }, []);
  return n;
}


/** Adminlar uchun bildirishnomalar (tovar qaytarilganda va h.k.) */
function useNotifications(enabled) {
  const toast = useToast();
  const [state, setState] = useState({ unread: 0, data: [] });
  const seen = useRef(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () =>
      api("/notifications")
        .then((r) => {
          if (!alive) return;
          // Yangi kelgan o'qilmagan xabarlarni ekran tepasida ko'rsatamiz
          if (seen.current) {
            r.data.filter((n) => !n.read && !seen.current.has(n._id)).forEach((n) => toast(`${n.title}: ${n.message}`, "warn"));
          }
          seen.current = new Set(r.data.map((n) => n._id));
          setState({ unread: r.unread, data: r.data });
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    window.addEventListener("notify:changed", load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("notify:changed", load);
    };
  }, [enabled, toast]);
  const readAll = async () => {
    await api("/notifications/read", { method: "POST" }).catch(() => {});
    setState((s) => ({ unread: 0, data: s.data.map((n) => ({ ...n, read: true })) }));
  };
  return { ...state, readAll };
}

function Bell({ alerts }) {
  const { isAdmin } = useAuth();
  const n = useNotifications(isAdmin);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!isAdmin) {
    return (
      <button className="icon-btn bell" onClick={() => navigate("/ombor?status=kam")} title="Kam qolgan mahsulotlar">
        <Icon name="bell" size={20} stroke={1.7} />
        {alerts > 0 && <span className="dot" />}
      </button>
    );
  }
  const toggle = () => {
    setOpen((o) => !o);
    if (!open && n.unread) setTimeout(n.readAll, 1500);
  };
  return (
    <div className="bell-wrap" ref={ref}>
      <button className="icon-btn bell" onClick={toggle} title="Bildirishnomalar">
        <Icon name="bell" size={20} stroke={1.7} />
        {n.unread > 0 ? <span className="bell-count">{n.unread > 9 ? "9+" : n.unread}</span> : alerts > 0 && <span className="dot" />}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <b>Bildirishnomalar</b>
            {n.unread > 0 && <span className="pill pill-red">{n.unread} yangi</span>}
          </div>
          {alerts > 0 && (
            <button className="notif-item stock" onClick={() => { setOpen(false); navigate("/ombor?status=kam"); }}>
              <span className="iconbox ib-orange" style={{ width: 32, height: 32 }}>
                <Icon name="alert" size={16} />
              </span>
              <div>
                <b>Omborda {alerts} ta tovar kam qolgan yoki tugagan</b>
                <small className="muted">Ko'rish uchun bosing</small>
              </div>
            </button>
          )}
          {n.data.length === 0 && <p className="muted small center notif-empty">Hozircha xabar yo'q</p>}
          <div className="notif-list">
            {n.data.map((x) => (
              <button key={x._id} className={"notif-item" + (x.read ? "" : " unread")} onClick={() => { setOpen(false); x.link && navigate(x.link); }}>
                <span className="iconbox ib-red" style={{ width: 32, height: 32 }}>
                  <Icon name={x.type === "return" ? "undo" : "bell"} size={16} />
                </span>
                <div>
                  <b>{x.title}</b>
                  <span className="notif-msg">{x.message}</span>
                  <small className="muted">{dateTime(x.createdAt)}</small>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Joriy filial nomi: "Sardoba" yoki "Barcha filiallar" */
export function useBranchName() {
  const { branch, allBranches } = useAuth();
  return allBranches ? "Barcha filiallar" : branch?.name || "Sardoba";
}

function Sidebar({ sections, active, alerts, onBranch }) {
  const { user, logout, isAdmin } = useAuth();
  const branchName = useBranchName();
  const [menu, setMenu] = useState(false);
  const app = useInstall();
  return (
    <aside className="sidebar">
      <div className="logo">
        <span className="logo-mark">
          <Icon name="cube" size={20} stroke={2} />
        </span>
        <div>
          <b>ULGURJI</b>
          <small>savdo boshqaruvi</small>
        </div>
      </div>

      <button className="branch" onClick={onBranch} title={isAdmin ? "Filialni almashtirish" : "Filial"}>
        <span className="iconbox ib-green" style={{ width: 32, height: 32 }}>
          <Icon name="store" size={17} />
        </span>
        <div className="grow">
          <small>Filial</small>
          <b>{branchName}</b>
        </div>
        {isAdmin && <Icon name="chevDown" size={16} />}
      </button>

      <div className="nav-title">ASOSIY MENYU</div>
      <nav className="nav">
        {sections.map((s) => (
          <a key={s.key} href={"#" + s.path} className={"nav-item" + (active === s.key ? " active" : "")}>
            <Icon name={s.icon} size={18} stroke={1.7} />
            <span>{s.label}</span>
            {s.key === "ombor" && alerts > 0 && <span className="nav-badge">{alerts}</span>}
          </a>
        ))}
      </nav>

      <div className="help">
        <span className="iconbox ib-green-2" style={{ width: 32, height: 32 }}>
          <Icon name="clipboard" size={17} />
        </span>
        <b>Yordam kerakmi?</b>
        <small>Qo'llab-quvvatlash markazi</small>
        {app.canInstall && !app.installed ? (
          <button className="link" onClick={app.install}>
            Ilova sifatida o'rnatish
          </button>
        ) : (
          <a href="tel:+998000000000">Bog'lanish</a>
        )}
      </div>

      <div className="me-wrap">
        {menu && (
          <div className="me-menu">
            <button onClick={logout}>
              <Icon name="logout" size={16} /> Tizimdan chiqish
            </button>
          </div>
        )}
        <button className="me" onClick={() => setMenu((m) => !m)}>
          <Avatar name={user?.name} bg="#F3D5BC" fg="#8A4B1F" size={36} />
          <div>
            <b>{user?.name}</b>
            <small>{user?.position}</small>
          </div>
          <Icon name="chevRight" size={16} />
        </button>
      </div>
    </aside>
  );
}

function Header({ alerts, onBranch }) {
  const { user } = useAuth();
  const branchName = useBranchName();
  const [q, setQ] = useState("");
  return (
    <header className="topbar">
      <button className="mobile-logo" onClick={onBranch} title="Filial">
        <span className="logo-mark">
          <Icon name="cube" size={18} stroke={2} />
        </span>
        <div>
          <b>ULGURJI</b>
          <small>
            {branchName} <Icon name="chevDown" size={11} />
          </small>
        </div>
      </button>
      <form
        className="top-search"
        onSubmit={(e) => {
          e.preventDefault();
          navigate("/ombor?q=" + encodeURIComponent(q));
        }}
      >
        <Icon name="search" size={17} />
        <input value={q} onChange={(e) => setQ(e.target.value)} />
        <kbd>↵</kbd>
      </form>
      <div className="top-right">
        <Bell alerts={alerts} />
        <div className="role-switch" title="Sizning rolingiz">
          <span className={user?.role === "admin" ? "active" : ""}>Admin</span>
          <span className={user?.role === "xodim" ? "active" : ""}>Xodim</span>
        </div>
        <Avatar name={user?.name} bg="#F3D5BC" fg="#8A4B1F" size={36} />
      </div>
    </header>
  );
}

function BottomNav({ sections, active }) {
  const order = ["dashboard", "sotuv", "ombor", "qaytarish", "xarajatlar", "hisobotlar", "taminotchilar", "xodimlar"];
  const tabs = order.map((k) => sections.find((s) => s.key === k)).filter(Boolean).slice(0, 4);
  return (
    <nav className="bottom-nav">
      {tabs.map((s) => (
        <a key={s.key} href={"#" + s.path} className={active === s.key ? "active" : ""}>
          <span>
            <Icon name={s.icon} size={21} />
          </span>
          {s.label}
        </a>
      ))}
      <a href="#/menyu" className={active === "menyu" ? "active" : ""}>
        <span>
          <Icon name="menu" size={21} />
        </span>
        Menyu
      </a>
    </nav>
  );
}

// "Barcha filiallar" rejimida bu bo'limlarda yangi yozuv kiritib bo'lmaydi
const WRITE_SECTIONS = ["sotuv", "xarajatlar", "taminotchilar", "qaytarish"];

export default function Layout({ active, children }) {
  const { can, allBranches } = useAuth();
  const sections = SECTIONS.filter((s) => can(s.key));
  const alerts = useAlerts();
  const [branchOpen, setBranchOpen] = useState(false);
  const openBranch = () => setBranchOpen(true);
  return (
    <div className="app">
      <Sidebar sections={sections} active={active} alerts={alerts} onBranch={openBranch} />
      <div className="main">
        <Header alerts={alerts} onBranch={openBranch} />
        <main className="content">
          {allBranches && WRITE_SECTIONS.includes(active) && (
            <div className="branch-notice">
              <Icon name="store" size={18} />
              <span className="grow">
                Hozir <b>«Barcha filiallar»</b> tanlangan — bu yerda faqat ko'rish mumkin. Sotuv, xarajat yoki kirim kiritish uchun filialni tanlang.
              </span>
              <button className="btn btn-sm btn-primary" onClick={openBranch}>
                Filialni tanlash
              </button>
            </div>
          )}
          {children}
        </main>
      </div>
      <BottomNav sections={sections} active={active} />
      <BranchModal open={branchOpen} onClose={() => setBranchOpen(false)} />
    </div>
  );
}
