import { useState } from "react";
import Icon from "../components/Icon.jsx";
import { useAuth } from "../auth.jsx";

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ login: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const u = await login(form.login, form.password);
      window.location.hash = u.permissions.includes("dashboard") ? "/" : "/sotuv";
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="logo">
          <span className="logo-mark">
            <Icon name="cube" size={22} stroke={2} />
          </span>
          <div>
            <b>ULGURJI</b>
            <small>savdo boshqaruvi</small>
          </div>
        </div>
        <h1>Tizimga kirish</h1>
        <p className="muted">Login va parolingizni kiriting</p>

        <label className="field">
          <span className="field-label">Login</span>
          <span className="input-wrap has-icon">
            <Icon name="user" size={16} className="input-icon" />
            <input autoFocus value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} autoComplete="username" />
          </span>
        </label>
        <label className="field">
          <span className="field-label">Parol</span>
          <span className="input-wrap has-icon">
            <Icon name="clipboard" size={16} className="input-icon" />
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="current-password" />
          </span>
        </label>

        {err && <div className="error-box">{err}</div>}

        <button className="btn btn-primary btn-lg btn-block" disabled={busy || !form.login || !form.password}>
          {busy ? "Kirilmoqda..." : "Kirish"}
        </button>
      </form>
    </div>
  );
}
