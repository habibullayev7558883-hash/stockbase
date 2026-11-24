import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import { avatarColors, fmt, initials } from "../format.js";

export function Money({ value, unit = "so'm", className = "" }) {
  return (
    <span className={"money " + className}>
      {fmt(value)}
      {unit && <small> {unit}</small>}
    </span>
  );
}

export function Pill({ children, color = "green", className = "" }) {
  return <span className={`pill pill-${color} ${className}`}>{children}</span>;
}

export function Avatar({ name, size = 34, colorKey, bg, fg, radius }) {
  const [b, f] = bg ? [bg, fg] : avatarColors(colorKey || name);
  return (
    <span className="avatar" style={{ width: size, height: size, background: b, color: f, borderRadius: radius ?? size * 0.28, fontSize: size * 0.3 }}>
      {initials(name)}
    </span>
  );
}

export function IconBox({ icon, color = "green", size = 34 }) {
  return (
    <span className={`iconbox ib-${color}`} style={{ width: size, height: size }}>
      <Icon name={icon} size={size * 0.52} />
    </span>
  );
}

export function Stat({ label, value, unit = "so'm", icon, color = "green", badge, badgeColor = "green", note, valueClass = "" }) {
  return (
    <div className="card stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <IconBox icon={icon} color={color} />
      </div>
      <div className={"stat-value " + valueClass}>
        {typeof value === "number" ? fmt(value) : value}
        {unit && <small> {unit}</small>}
      </div>
      <div className="stat-foot">
        {badge !== undefined && badge !== null && <Pill color={badgeColor}>{badge}</Pill>}
        {note && <span className="muted">{note}</span>}
      </div>
    </div>
  );
}

export function PageHead({ kicker, title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <div className="kicker">{kicker}</div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function Card({ title, sub, action, children, className = "" }) {
  return (
    <section className={"card " + className}>
      {(title || action) && (
        <div className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {sub && <p className="muted small">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Seg({ items, value, onChange }) {
  return (
    <div className="seg">
      {items.map(([v, label]) => (
        <button key={v} type="button" className={v === value ? "active" : ""} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Loader({ text = "Yuklanmoqda..." }) {
  return (
    <div className="loader">
      <span className="spinner" /> {text}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="error-box">
      <Icon name="alert" size={18} />
      <span>{error}</span>
      {onRetry && (
        <button className="btn btn-sm btn-outline" onClick={onRetry}>
          Qayta urinish
        </button>
      )}
    </div>
  );
}

export function Empty({ icon = "search", title, text }) {
  return (
    <div className="empty">
      <Icon name={icon} size={34} stroke={1.5} />
      <b>{title}</b>
      {text && <span className="muted">{text}</span>}
    </div>
  );
}

export function Modal({ open, onClose, title, kicker, children, width = 440, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={{ maxWidth: width }}>
        {(title || kicker) && (
          <div className="modal-head">
            <div>
              {kicker && <div className="kicker">{kicker}</div>}
              {title && <h2>{title}</h2>}
            </div>
            {onClose && (
              <button className="icon-btn" onClick={onClose} aria-label="Yopish">
                <Icon name="x" size={20} />
              </button>
            )}
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, icon, suffix, children, className = "" }) {
  return (
    <label className={"field " + className}>
      {label && <span className="field-label">{label}</span>}
      <span className={"input-wrap" + (icon ? " has-icon" : "")}>
        {icon && <Icon name={icon} size={16} className="input-icon" />}
        {children}
        {suffix && <span className="input-suffix">{suffix}</span>}
      </span>
    </label>
  );
}

/** Oddiy ustunli grafik */
export function Bars({ data, height = 160, highlightLast = false, highlightMax = true, labelEvery = 1, format = fmt }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const maxIdx = data.findIndex((d) => d.value === max);
  return (
    <div className="bars" style={{ height: height + 28 }}>
      <div className="bars-plot" style={{ height }}>
        {data.map((d, i) => {
          const hi = (highlightLast && i === data.length - 1) || (highlightMax && !highlightLast && i === maxIdx && d.value > 0);
          return (
            <div className="bar-col" key={i} title={`${d.label}: ${format(d.value)}`}>
              {hi && d.value > 0 && <span className="bar-tip">{format(d.value)}</span>}
              <div className={"bar" + (hi ? " hi" : "")} style={{ height: `${(d.value / max) * 100}%` }} />
            </div>
          );
        })}
      </div>
      <div className="bars-labels">
        {data.map((d, i) => (
          <span key={i}>{i % labelEvery === 0 ? d.label : ""}</span>
        ))}
      </div>
    </div>
  );
}

// ---------- Toast ----------
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((text, type = "success") => {
    const id = Math.random();
    setItems((s) => [...s, { id, text, type }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), type === "warn" ? 10000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={"toast toast-" + t.type}>
            <Icon name={t.type === "error" ? "alert" : t.type === "warn" ? "bell" : "checkCircle"} size={18} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
