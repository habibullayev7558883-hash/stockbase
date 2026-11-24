import { useCallback, useEffect, useState } from "react";

// Backend manzili. Vite proxy orqali /api -> http://localhost:5000/api
const BASE = import.meta.env.VITE_API_URL || "/api";

let token = localStorage.getItem("token");

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem("token", t);
  else localStorage.removeItem("token");
}

export function getToken() {
  return token;
}

export async function api(path, { method = "GET", body, query } = {}) {
  const qs = query
    ? "?" + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")).toString()
    : "";
  let res;
  try {
    res = await fetch(BASE + path + qs, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    const err = new Error(offline ? "Internet aloqasi yo'q. Internetni tekshirib, qayta urinib ko'ring." : "Server bilan aloqa yo'q. Backend ishga tushganini tekshiring.");
    err.status = 0;
    throw err;
  }
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* bo'sh javob */
  }
  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event("auth:logout"));
  }
  if ([502, 503, 504].includes(res.status) && !data.message) {
    const err = new Error("Server ishlamayapti. Biroz kutib, qayta urinib ko'ring.");
    err.status = res.status;
    throw err;
  }
  if (!res.ok || data.success === false) {
    const err = new Error(data.message || `Xato: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Ma'lumot yuklash uchun hook: const { data, loading, error, reload } = useApi(() => api("/products"), [deps]) */
export function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);
  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await load();
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, [load]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { ...state, reload };
}
