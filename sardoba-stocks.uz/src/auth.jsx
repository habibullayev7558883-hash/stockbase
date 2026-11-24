import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getBranchId, getToken, setBranchId, setToken } from "./api.js";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [netError, setNetError] = useState("");
  const [branches, setBranches] = useState(null); // null = hali yuklanmagan
  const [branchId, setBranchState] = useState(getBranchId());

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

  // Filiallar ro'yxati va joriy filial
  const loadBranches = useCallback(async () => {
    const r = await api("/branches");
    setBranches(r.data);
    return r.data;
  }, []);

  useEffect(() => {
    if (!user) {
      setBranches(null);
      return;
    }
    api("/branches")
      .then(({ data: list }) => {
        const isAdmin = user.role === "admin";
        const ownId = user.branch?._id || user.branch;
        let id = getBranchId();
        if (!isAdmin) id = list.some((b) => b._id === ownId) ? ownId : list[0]?._id || "";
        else if (id !== "all" && !list.some((b) => b._id === id)) id = list[0]?._id || "";
        // Avval tanlovni saqlaymiz, keyin sahifalarni ochamiz — birinchi so'rovlar to'g'ri filial bilan ketadi
        setBranchId(id);
        setBranchState(id);
        setBranches(list);
      })
      .catch(() => setBranches([]));
  }, [user]);

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

  /** Filialni almashtirish (faqat admin). Sahifa yangilanadi — hamma ma'lumot yangi filial bo'yicha yuklanadi. */
  const switchBranch = useCallback((id) => {
    setBranchId(id);
    window.location.reload();
  }, []);

  const can = useCallback((perm) => !!user?.permissions?.includes(perm), [user]);
  const branch = branchId === "all" ? null : branches?.find((b) => b._id === branchId) || null;

  return (
    <AuthCtx.Provider
      value={{
        user, ready, login, logout, can, isAdmin: user?.role === "admin", netError, retry: loadMe,
        branches: branches || [], branchesReady: branches !== null, branch, allBranches: branchId === "all",
        switchBranch, reloadBranches: loadBranches,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
