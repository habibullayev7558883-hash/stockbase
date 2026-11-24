import { useEffect, useState } from "react";

// Brauzer "o'rnatish" taklifini ilova yuklanishi bilanoq ushlab qolamiz
let deferred = null;
const subs = new Set();
const emit = () => subs.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
}

export function registerSW() {
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
        const reg = await navigator.serviceWorker.ready;
        const urls = performance
          .getEntriesByType("resource")
          .map((r) => new URL(r.name))
          .filter((u) => u.origin === location.origin && u.pathname.startsWith("/assets/"))
          .map((u) => u.pathname);
        reg.active?.postMessage({ type: "cache", urls });
      } catch {
        /* service worker ishlamasa ham ilova ishlayveradi */
      }
    });
  }
}

export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** O'rnatish tugmasi uchun: { canInstall, install, installed, ios } */
export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    return () => subs.delete(f);
  }, []);
  return {
    canInstall: !!deferred,
    installed: isStandalone(),
    ios: isIOS(),
    install: async () => {
      if (!deferred) return false;
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      emit();
      return outcome === "accepted";
    },
  };
}
