const BASE = (((import.meta as any).env?.VITE_API_URL) || "").replace(/\/+$/, "");
export const API_URL: string = BASE;

const TIMEOUT_MS = 8000; // 8s por si hay cold start
const RETRIES = 1;       // 1 reintento rápido
const RUTAS = {
  enviar:          (id: number) => `/seguimiento/${id}/enviar`,
  solicitarCambios:(id: number) => `/seguimiento/${id}/solicitar-cambios`,
  aprobar:         (id: number) => `/seguimiento/${id}/aprobar`,
};
 
// ====== UTIL: construir URL absoluta hacia el backend (uploads, etc.) ======
export function toAbsolute(urlPath: string): string {
  if (!urlPath) return urlPath;
  try {
    // Si urlPath ya es absoluta, URL la respeta; si es relativa, la resuelve contra API_URL
    return new URL(urlPath, API_URL).href;
  } catch {
    return urlPath;
  }
}


// ====== ESTADO GLOBAL DE CONEXIÓN (opcional para banner) ======
export type ApiConnState = "ok" | "reconnecting" | "down" | "auth";
export type UserRole = "admin" | "entidad" | "auditor";
export type EntidadPerm = "captura_reportes" | "reportes_seguimiento";

type Listener = (s: ApiConnState, msg?: string) => void;

let _state: ApiConnState = "ok";
let _message: string | undefined;
const _listeners = new Set<Listener>();

function _emit(next: ApiConnState, msg?: string) {
  _state = next;
  _message = msg;
  _listeners.forEach((fn) => fn(_state, _message));
}

// ====== ADMIN: USERS API ======
export const UsersAPI = {
  list: () => api(`/users`),
  create: (payload: { email: string; password: string; role: UserRole; entidad_perm?: EntidadPerm; entidad_auditor?: boolean; entidad: string;  }) =>
    api(`/users`, { method: "POST", body: JSON.stringify(payload) }),
  setRole: (id: number, role: UserRole) =>
    api(`/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  setPerm: (id: number, entidad_perm: EntidadPerm) =>
    api(`/users/${id}/perm`, { method: "PATCH", body: JSON.stringify({ entidad_perm }) }),
  setEntidadAuditor: (id: number, entidad_auditor: boolean) =>
    api(`/users/${id}/auditor`, { method: "PATCH", body: JSON.stringify({ entidad_auditor }) }),
  resetPassword: (id: number, new_password: string) =>
    api(`/users/${id}/password`, { method: "PATCH", body: JSON.stringify({ new_password }) }),  
  remove: (id: number) =>
    api(`/users/${id}`, { method: "DELETE" }),
};

// ====== REPORTS: obtener entidades para alta de usuarios ======
export const ReportsAPI = {
  list: () => api(`/reports`),
};


export function onApiStateChange(fn: Listener): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); }; 
}

export function getApiState() {
  return { state: _state, message: _message };
}

// ====== HELPERS ======
function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      const e = Object.assign(new Error("API_TIMEOUT"), { code: "API_TIMEOUT" });
      reject(e);
    }, ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

async function doFetch(url: string, init?: RequestInit) {
  return withTimeout(fetch(url, { ...init, credentials: "omit" }));
}

function buildUrl(path: string): string {
  if (!BASE) throw new Error("Falta VITE_API_URL");

  let raw = String(path || "").trim();
  if (!raw.startsWith("/")) raw = "/" + raw;

  // separa path y querystring
  const [pathname0, search = ""] = raw.split("?");
  let pathname = pathname0.replace(/\/{2,}/g, "/"); // colapsa // -> /

  // SOLO para endpoints de seguimiento, forzar slash final (evita redirects que rompen CORS)
  if (pathname.startsWith("/seguimiento") && !pathname.endsWith("/")) {
    pathname += "/";
  }

  return `${BASE}${pathname}${search ? "?" + search : ""}`;
}

// ====== API PRINCIPAL ======
export async function api(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const headers = new Headers(options.headers || {});

  if (token) headers.set("Authorization", `Bearer ${token}`);

  // No pisar Content-Type si body es FormData o URLSearchParams
  const isForm =
    options.body instanceof FormData ||
    options.body instanceof URLSearchParams;

  if (!headers.has("Content-Type") && !isForm) {
    headers.set("Content-Type", "application/json");
  }

  const url = buildUrl(path);
  let lastErr: any;

  for (let i = 0; i <= RETRIES; i++) {
    try {
      const res = await doFetch(url, {
        ...options,
        headers,
        mode: "cors",
        // credentials: "include", // si usas cookies entre dominios
      });

      if (res.status === 401 || res.status === 403) {
        // sesión expirada o sin permisos → marcamos "auth" y redirigimos
        _emit("auth", "Tu sesión ha expirado. Inicia sesión nuevamente.");
        localStorage.removeItem("token");
        // Redirección amigable
        if (window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
        const msg = await res.text().catch(() => res.statusText);
        const err = new Error(msg || `AUTH ${res.status}`);
        (err as any).code = "AUTH_ERROR";
        throw err;
      }

      if (!res.ok) {
        // 5xx suele ser cold start o error temporal del back
        if (res.status >= 500) {
          // primer fallo: marcamos "reconnecting"
           _emit("reconnecting", "Reintentando conexión con el servidor…");
          throw Object.assign(new Error(`HTTP_${res.status}`), { code: "SERVER_ERROR" });
        }
        const msg = await res.text().catch(() => res.statusText);
        throw new Error(msg || `HTTP ${res.status}`);
      }

      // Éxito → limpiamos estado si venía reconectando/caído
      if (_state !== "ok") _emit("ok");
      if (res.status === 204) return null;

      const ct = res.headers.get("content-type") || "";
      return ct.includes("application/json") ? res.json() : res.text();

    } catch (e: any) {
      lastErr = e;
      const isTimeout = e?.code === "API_TIMEOUT";
      const netLike =
        isTimeout || e?.name === "TypeError" || e?.message?.includes("Failed to fetch");
      const serverLike = e?.code === "SERVER_ERROR";

      if (i < RETRIES && (netLike || serverLike)) {
        // damos 1 segundo para que Cloud Run "despierte"
        _emit("reconnecting", "Reintentando conexión con el servidor…");
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      // sin éxito tras el retry → "down"
      if (netLike || serverLike) {
        _emit("down", "No se pudo conectar con el servidor. Intenta nuevamente.");
      }
      throw e;
    }
  }

  throw lastErr;
}
// ====== UPLOAD: Evidencia (imágenes, PDF, Excel, comprimidos) ======
export async function uploadEvidence( file: File
): Promise<{
  href: string;
  publicUrl: string | null;
  url: string | null;
  filename: string;
  content_type: string;
}> {
  if (!file) throw new Error("No hay archivo");
  const allowedTypes = new Set<string>([
    // Imágenes
    "image/jpeg",
    "image/png",
    "image/gif",
    // PDF
    "application/pdf",
    // Excel / CSV
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    // Comprimidos
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
  ]);
  const allowedExts = new Set<string>([
    "jpg",
    "jpeg",
    "png",
    "gif",
    "pdf",
    "xls",
    "xlsx",
    "csv",
    "zip",
    "rar",
    "7z",
  ]);

  const typeOk = file.type ? allowedTypes.has(file.type) : false;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const extOk = allowedExts.has(ext);

  if (!typeOk && !extOk) {
    throw new Error(
      "Formatos permitidos: imágenes (JPG, PNG), PDF, Excel (XLS/XLSX/CSV) y comprimidos (ZIP, RAR, 7Z)"
    );
  }
  const form = new FormData();
  form.append("file", file);

  const res = await api("/files/upload", { method: "POST", body: form });
  
  const json = res; 
  const href =
    (json && json.public_url) ? json.public_url
    : (json && json.url)       ? toAbsolute(json.url)
    : null;
  if (!href) throw new Error("Respuesta inválida del servidor de archivos");
  return {
    href,                        // <- úsalo directamente en el <a href=...>
    publicUrl: json.public_url || null,
    url: json.url || null,       // ruta relativa si estás en modo local
    filename: json.filename,
    content_type: json.content_type,
  };
}

// ---- Añadimos helpers tipo api.post, api.get, api.put, api.delete ----
export namespace api {
  export function post(path: string, payload?: any, init?: RequestInit) {
    const isForm =
      payload instanceof FormData || payload instanceof URLSearchParams;
    const body = payload === undefined ? undefined : isForm ? payload : JSON.stringify(payload);
    const opts: RequestInit = { method: "POST", body, ...(init || {}) };
    return (api as any)(path, opts);
  }

  export function get(path: string, init?: RequestInit) {
    const opts: RequestInit = { method: "GET", ...(init || {}) };
    return (api as any)(path, opts);
  }

  export function put(path: string, payload?: any, init?: RequestInit) {
    const isForm =
      payload instanceof FormData || payload instanceof URLSearchParams;
    const body = payload === undefined ? undefined : isForm ? payload : JSON.stringify(payload);
    const opts: RequestInit = { method: "PUT", body, ...(init || {}) };
    return (api as any)(path, opts);
  }

  export function del(path: string, init?: RequestInit) {
    const opts: RequestInit = { method: "DELETE", ...(init || {}) };
    return (api as any)(path, opts);
  }
}
