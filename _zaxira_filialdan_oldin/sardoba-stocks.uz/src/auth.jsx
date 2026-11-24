import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api.js";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [netError, setNetError] = useState("");

  const loadMe = useCallback(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    setNetError("");
    api("/auth/me")
      .then((r) => setUser(r.user))
      .catch((e) => {
        // 401 bo'lsa api.js tokenni o'zi o'chiradi. Internet/server muammosida esa chiqarib yubormaymiz.
        if (e.status === 0 || e.status >= 500) setNetError(e.message);
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  // Internet qaytganda avtomatik qayta urinamiz
  useEffect(() => {
    const on = () => netError && loadMe();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [netError, loadMe]);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, []);

  const login = useCallback(async (login, password) => {
    const r = await api("/auth/login", { method: "POST", body: { login, password } });
    setToken(r.token);
    setUser(r.user);
    return r.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    window.location.hash = "";
  }, []);

  const can = useCallback((perm) => !!user?.permissions?.includes(perm), [user]);

  return (
    <AuthCtx.Provider value={{ user, ready, login, logout, can, isAdmin: user?.role === "admin", netError, retry: loadMe }}>{children}</AuthCtx.Provider>
  );
}
