import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { hasAuditorAccess } from "../lib/auth";

const disableAuth = import.meta.env.VITE_DISABLE_AUTH === "true";

export default function PrivateRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  const location = useLocation();

  if (disableAuth) return children;

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  const role = user.role;
  const isAuditorAccess = hasAuditorAccess(user as any);
  const perm = (user as any)?.entidad_perm as
    | "captura_reportes"
    | "reportes_seguimiento"
    | null
    | undefined;

  const path = location.pathname;

  if (role === "entidad" && !isAuditorAccess) {
    if (perm === "captura_reportes" && path.startsWith("/seguimiento")) {
      return <Navigate to="/reportes" replace />;
    }
  }

  return children;
}
