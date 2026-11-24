import { useEffect } from "react";
import { AuthProvider, useAuth } from "./auth.jsx";
import { ToastProvider, Loader } from "./components/ui.jsx";
import Icon from "./components/Icon.jsx";
import Layout from "./components/Layout.jsx";
import { SECTIONS, navigate, useRoute } from "./router.js";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Sotuv from "./pages/Sotuv.jsx";
import Ombor from "./pages/Ombor.jsx";
import Xarajatlar from "./pages/Xarajatlar.jsx";
import Hisobotlar from "./pages/Hisobotlar.jsx";
import Taminotchilar from "./pages/Taminotchilar.jsx";
import Qaytarish from "./pages/Qaytarish.jsx";
import Menyu from "./pages/Menyu.jsx";
import Xodimlar from "./pages/Xodimlar.jsx";

const PAGES = {
  dashboard: Dashboard,
  sotuv: Sotuv,
  ombor: Ombor,
  xarajatlar: Xarajatlar,
  hisobotlar: Hisobotlar,
  taminotchilar: Taminotchilar,
  qaytarish: Qaytarish,
  menyu: Menyu,
  xodimlar: Xodimlar,
};

function Routes() {
  const { user, ready, can, netError, retry, branchesReady } = useAuth();
  const { path } = useRoute();

  const section = path === "/menyu" ? { key: "menyu" } : SECTIONS.find((s) => s.path === path);
  const allowed = section && (section.key === "menyu" || can(section.key));
  const fallback = SECTIONS.find((s) => can(s.key));

  // Ruxsat yo'q bo'limga kirsa — birinchi ruxsat berilgan bo'limga yo'naltiramiz
  useEffect(() => {
    if (user && !allowed && fallback) navigate(fallback.path);
  }, [user, allowed, fallback]);

  if (!ready) return <Loader text="Yuklanmoqda..." />;
  if (!user && netError) {
    return (
      <div className="login-page">
        <div className="login-card offline-card">
          <span className="offline-icon">
            <Icon name="alert" size={30} />
          </span>
          <h1>Aloqa yo'q</h1>
          <p className="muted">{netError}</p>
          <button className="btn btn-primary btn-lg btn-block" onClick={retry}>
            <Icon name="refresh" /> Qayta urinish
          </button>
          <p className="hint">Internet qaytganda o'zi qayta ulanadi.</p>
        </div>
      </div>
    );
  }
  if (!user) return <Login />;
  if (!allowed) return null;
  if (!branchesReady) return <Loader text="Filial yuklanmoqda..." />;

  const Page = PAGES[section.key];
  return (
    <Layout active={section.key}>
      <Page key={section.key} />
    </Layout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </ToastProvider>
  );
}
