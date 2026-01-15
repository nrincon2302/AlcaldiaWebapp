import { jwtDecode } from "jwt-decode";

export type Role = "admin" | "entidad" | "auditor" | "ciudadano";


// extendemos el Decoded para incluir entidad_perm
export type Decoded = {
  sub: string;
  role: Role;
  uid: number;
  exp: number;
  entidad: string;
  entidad_perm?: "captura_reportes" | "reportes_seguimiento" | null;
  entidad_auditor?: boolean;
};

export function setToken(token: string) {
  localStorage.setItem("token", token);
}
export function getToken() { return localStorage.getItem("token"); }
export function logout() { localStorage.removeItem("token"); }

export function getUser(): Decoded | null {
  const t = getToken();
  if (!t) return null;
  try {

    const raw = jwtDecode<any>(t);
    const d: Decoded = {
      sub: raw?.sub ?? "",
      role: raw?.role ?? "ciudadano",
      uid: raw?.uid ?? 0,
      exp: raw?.exp ?? 0,
      entidad: raw?.entidad ?? null,
      entidad_perm: raw?.entidad_perm ?? null, 
      entidad_auditor: Boolean(raw?.entidad_auditor),
    };

    if (typeof d.exp === "number" && d.exp * 1000 <= Date.now()) {
      logout();
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

export function isAdmin() { return getUser()?.role === "admin"; }
export function getRole(): Role { return getUser()?.role || "ciudadano"; }
export function isEntidad() { return getRole() === "entidad"; }
export function isAuditor() { return getRole() === "auditor"; }
export function hasAuditorAccess(user?: Decoded | null) {
  if (!user) return false;
  return user.role === "auditor" || (user.role === "entidad" && Boolean(user.entidad_auditor));
}
export function isCiudadano() { return getRole() === "ciudadano"; }
export function isAuthenticated() { return !!getUser(); }
