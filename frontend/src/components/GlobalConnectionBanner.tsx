import React from "react";
import { onApiStateChange, getApiState } from "../lib/api";
import { useLocation } from "react-router-dom";

export default function GlobalConnectionBanner() {
  const [s, setS] = React.useState(getApiState());
  const { pathname } = useLocation();
  const redirectingRef = React.useRef(false);

  // Suscripción al estado global del cliente API
  React.useEffect(() => {
    const off = onApiStateChange((state, message) => setS({ state, message }));
    return off;
  }, []);

  // Redirección controlada (una sola vez por cambio de estado)
  React.useEffect(() => {
    if (s.state === "ok" || redirectingRef.current) return;

    // auth => /login ; reconnecting/down => /
    const isAuth = s.state === "auth";
    const target = isAuth ? "/login" : "/";

    // Si ya estamos en el destino, no redirigimos (evita loop).
    if (pathname === target) return;

    redirectingRef.current = true;

    const t = setTimeout(() => {
      try {
        if (isAuth) localStorage.removeItem("token");
      } catch {}
      // recarga dura para resetear cualquier estado en memoria
      window.location.assign(target);
    }, 900); // pequeño delay para que se vea el banner

    return () => clearTimeout(t);
  }, [s.state, pathname]);

  if (s.state === "ok") return null;

  const isAuth = s.state === "auth";
  const isReconnOrDown = s.state === "reconnecting" || s.state === "down";

  return (
    <>
      {/* Overlay blanco semitransparente bajo el banner cuando NO hay conexión */}
      {isReconnOrDown && (
        <div
          className="fixed inset-0 z-40 bg-white/60 backdrop-blur-[1px]"
          aria-hidden
        />
      )}

      {/* Banner superior */}
      <div
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-2 text-sm shadow-md"
        style={{
          backgroundColor: isAuth ? "#FEF3C7" : "#DBEAFE",
          color: isAuth ? "#92400E" : "#1E3A8A",
        }}
      >
        <div className="flex items-center gap-2">
          {!isAuth && (
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full"
              style={{ backgroundColor: "#2563EB" }}
              aria-hidden
            />
          )}
        <strong>
          {isAuth ? "Sesión expirada" : isReconnOrDown ? "Sesión expirada, Inicie sesion nueavamente…" : "Sin conexión"}
        </strong>
        <span>
          {" "}
          ·{" "}
          {s.message ||
            (isAuth
              ? "Inicia sesión nuevamente."
              : "Redirigiendo al inicio…")}
        </span>
        </div>
      </div>
    </>
  );
}
