import Icon from "../components/Icon.jsx";
import { Avatar, PageHead } from "../components/ui.jsx";
import { useAuth } from "../auth.jsx";
import { SECTIONS } from "../router.js";
import { useInstall } from "../pwa.js";

export default function Menyu() {
  const { user, can, logout } = useAuth();
  const app = useInstall();
  return (
    <>
      <PageHead kicker="MENYU" title="Barcha bo'limlar" />
      {!app.installed && (app.canInstall || app.ios) && (
        <div className="card install-card">
          <img src="/icon-192.png" alt="" width={48} height={48} />
          <div className="grow">
            <b>ULGURJI ilovasini o'rnating</b>
            {app.canInstall ? (
              <small className="muted block">Telefon bosh ekranida belgi paydo bo'ladi va to'liq ekranda ochiladi.</small>
            ) : (
              <small className="muted block">
                Safari pastidagi <b>Ulashish</b> (□↑) tugmasini bosing → <b>"Bosh ekranga qo'shish"</b> (На экран «Домой»).
              </small>
            )}
          </div>
          {app.canInstall && (
            <button className="btn btn-primary btn-sm" onClick={app.install}>
              O'rnatish
            </button>
          )}
        </div>
      )}
      <div className="card profile">
        <Avatar name={user?.name} bg="#F3D5BC" fg="#8A4B1F" size={44} />
        <div className="grow">
          <b>{user?.name}</b>
          <small className="muted block">
            {user?.role === "admin" ? "Administrator" : user?.position} · {user?.branch?.name || "Chorsu markaziy"}
          </small>
        </div>
      </div>
      <div className="card menu-list">
        {SECTIONS.filter((s) => can(s.key)).map((s) => (
          <a key={s.key} href={"#" + s.path}>
            <span className="iconbox ib-green" style={{ width: 38, height: 38 }}>
              <Icon name={s.icon} size={19} />
            </span>
            <div className="grow">
              <b>{s.label}</b>
              <small className="muted block">{s.sub}</small>
            </div>
            <Icon name="chevRight" size={16} />
          </a>
        ))}
      </div>
      <button className="btn btn-outline btn-block danger" onClick={logout}>
        <Icon name="logout" /> Tizimdan chiqish
      </button>
    </>
  );
}
