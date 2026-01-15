import React from "react";
import * as XLSX from "xlsx";
import { UsersAPI, UserRole, ReportsAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Spinner from "../components/Spinner";
import Header from "../components/Header";
import { FiEye, FiEyeOff, FiKey, FiTrash2 } from "react-icons/fi";

type EntPerm = "captura_reportes" | "reportes_seguimiento";
type Row = { id: number; email: string; role: UserRole; entidad_perm?: EntPerm | null; entidad_auditor?: boolean | null; entidad?: string | null };

export default function AdminUsers() {
  const { user } = useAuth();

  // Normaliza el id sin importar si viene de /auth/me (id) o del JWT (uid)
  const currentUserId = React.useMemo<number | undefined>(() => {
    if (!user) return undefined;
    const anyUser = user as any;
    if (typeof anyUser.id === "number") return anyUser.id;
    if (typeof anyUser.uid === "number") return anyUser.uid;
    return undefined;
  }, [user]);

  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [entidadesCatalog, setEntidadesCatalog] = React.useState<string[]>([]);
  const [loadingEntidades, setLoadingEntidades] = React.useState(false);
  const [entidadesError, setEntidadesError] = React.useState<string | null>(null);
  const resetRowRef = React.useRef<HTMLDivElement | null>(null);

  // Form nuevo usuario
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [role, setRole] = React.useState<UserRole>("entidad");
  const [entPerm, setEntPerm] = React.useState<EntPerm>("captura_reportes");
  const [entidadAuditor, setEntidadAuditor] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [entidad, setEntidad] = React.useState("");

  // Reset password
  const [resetId, setResetId] = React.useState<number | null>(null);
  const [resetPass, setResetPass] = React.useState("");
  const [showResetPass, setShowResetPass] = React.useState(false);
  const [submittingReset, setSubmittingReset] = React.useState(false);

  const isAdmin = user?.role === "admin";
  const roleRef = React.useRef(role);
  React.useEffect(() => {
    roleRef.current = role;
  }, [role]);

  // ─────────────────────────────────────────────
  // Toasts
  type Toast = { id: number; msg: string; tone?: "success" | "error" | "info" };
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const pushToast = React.useCallback((msg: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, msg, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);
  const toastError = (m: string) => pushToast(m, "error");
  const toastOk = (m: string) => pushToast(m, "success");
  // ─────────────────────────────────────────────

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await UsersAPI.list();
      setRows((data || []) as Row[]);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const loadEntidades = React.useCallback(async () => {
    if (role !== "entidad") return;

    try {
      setLoadingEntidades(true);
      setEntidadesError(null);

      // Ruta pública (React sirve /public como raíz)
      const fileUrl = "/external/Modelo_tabular.xlsx";

      // 1. Descargar el archivo
      const resp = await fetch(fileUrl);
      if (!resp.ok) throw new Error("No se pudo cargar el archivo Excel.");

      const buffer = await resp.arrayBuffer();

      // 2. Leer workbook
      const workbook = XLSX.read(buffer);

      // 3. Sheet "Entidades"
      const sheet = workbook.Sheets["Entidades"];
      if (!sheet) throw new Error("No existe el sheet 'Entidades'.");

      // 4. Convertir a matriz (header:1 = formato tipo array)
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Columna B → índice 1
      const entidadesExcel = rows
        .map((row) => row[1])
        .filter((x) => x && x !== "entidad") // limpiamos header + vacíos
        .map((x) => String(x).trim());

      // 5. Set para evitar duplicados
      const set = new Set<string>(entidadesExcel);

      const list = Array.from(set).sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" })
      );

      // Verificar condiciones antes de sobrescribir estado
      if (roleRef.current !== "entidad") return;

      setEntidadesCatalog(list);

      if (!entidad && list.length) setEntidad(list[0]);
    } catch (e: any) {
      setEntidadesError(e?.message || "No se pudo cargar entidades desde Excel.");
    } finally {
      setLoadingEntidades(false);
    }
  }, [role, entidad]);

  React.useEffect(() => { if (role === "entidad") loadEntidades(); }, [role, loadEntidades]);

  // Si cambia a rol distinto de entidad, limpiar la entidad para que el campo quede libre
  React.useEffect(() => {
    if (role !== "entidad") {
      setEntidad("");
      setEntidadAuditor(false);
    }
  }, [role]);

  // Guard: solo admin
  if (!isAdmin) {
    return (
      <>
        <Header />
        <div className="mx-auto max-w-4xl p-6">
          <h1 className="mb-2 text-2xl font-bold">Gestión de usuarios</h1>
          <p className="text-red-600">No tienes permisos para acceder a esta página.</p>
        </div>
      </>
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Ingresa email y password.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!entidad.trim()) {
      setError(role === "entidad" ? "Selecciona una entidad." : "Ingresa el nombre de la entidad/usuario.");
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await UsersAPI.create({
        email,
        password,
        role,
        entidad: entidad.trim(),
        ...(role === "entidad" ? { entidad_perm: entPerm, entidad_auditor: entidadAuditor } : {}),
      });
      setEmail("");
      setPassword("");
      setRole("entidad");
      setEntPerm("captura_reportes");
      setEntidadAuditor(false);
      await fetchData();
      toastOk("Usuario creado");
    } catch (e: any) {
      setError(e?.message || "No se pudo crear el usuario");
    } finally {
      setSubmitting(false);
    }
  }

  // Cambiar rol
  async function changeRole(id: number, nextRole: UserRole) {
    try {
      if (currentUserId === id && nextRole !== "admin") {
        toastError("No puedes quitarte tu propio rol de admin.");
        return;
      }
      await UsersAPI.setRole(id, nextRole);
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                role: nextRole,
                entidad_perm:
                  nextRole === "entidad" ? (r.entidad_perm ?? "captura_reportes") : null,
                entidad_auditor: nextRole === "entidad" ? (r.entidad_auditor ?? false) : false,
              }
            : r
        )
      );
      // Si se convirtió a entidad y no tenía perm, inicialízalo en el backend
      if (nextRole === "entidad") {
        const current = rows.find((x) => x.id === id);
        const perm = current?.entidad_perm ?? "captura_reportes";
        await UsersAPI.setPerm(id, perm);
      }
      toastOk("Rol actualizado");
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("Cannot demote the last admin")) {
        toastError("Debe existir al menos un usuario con rol admin.");
      } else {
        toastError(msg || "No se pudo cambiar el rol.");
      }
    }
  }

  // Cambiar permiso de entidad
  async function changeEntPerm(id: number, perm: EntPerm) {
    try {
      await UsersAPI.setPerm(id, perm);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, entidad_perm: perm } : r)));
      toastOk("Permisos de entidad actualizados");
    } catch (e: any) {
      toastError(String(e?.message || "No se pudo actualizar el permiso."));
    }
  }

  async function changeEntidadAuditor(id: number, nextValue: boolean) {
    try {
      await UsersAPI.setEntidadAuditor(id, nextValue);
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, entidad_auditor: nextValue } : r)));
      toastOk("Permisos de evaluador actualizados");
    } catch (e: any) {
      toastError(String(e?.message || "No se pudo actualizar el permiso de evaluador."));
    }
  }

  // Eliminar usuario
  async function handleDelete(id: number, email: string) {
    if (currentUserId === id) {
      toastError("No puedes eliminar tu propia cuenta.");
      return;
    }
    const ok = confirm(`¿Eliminar al usuario "${email}"? Esta acción no se puede deshacer.`);
    if (!ok) return;
    try {
      await UsersAPI.remove(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      toastOk("Usuario eliminado");
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("Cannot delete the last admin")) {
        toastError("No puedes eliminar al último administrador del sistema.");
      } else {
        toastError(msg || "No se pudo eliminar el usuario.");
      }
    }
  }

  // Reset de contraseña
  async function handleDoReset() {
    if (!resetId) return;
    if (resetPass.trim().length < 8) {
      alert("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    try {
      setSubmittingReset(true);
      await UsersAPI.resetPassword(resetId, resetPass.trim());
      setResetId(null);
      setResetPass("");
      setShowResetPass(false);
      toastOk("Contraseña actualizada");
    } catch (e: any) {
      toastError(String(e?.message || "No se pudo actualizar la contraseña."));
    } finally {
      setSubmittingReset(false);
    }
  }

  const RoleBadge = ({ role }: { role: UserRole }) => {
    const cls =
      role === "admin"
        ? "bg-emerald-100 text-emerald-800"
        : role === "auditor"
        ? "bg-indigo-100 text-indigo-800"
        : role === "entidad"
        ? "bg-sky-100 text-sky-800"
        : "bg-gray-100 text-gray-800";
    return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{role}</span>;
  };

  const EntPermSelect = ({
    value,
    onChange,
    disabled,
  }: {
    value: EntPerm | null | undefined;
    onChange: (v: EntPerm) => void;
    disabled?: boolean;
  }) => (
    <select
      value={value ?? "captura_reportes"}
      onChange={(e) => onChange(e.target.value as EntPerm)}
      className="rounded-md border bg-white px-2 py-1 text-xs focus:outline-none focus:ring focus:ring-yellow-300"
      disabled={disabled}
      aria-disabled={disabled}
      title="Permisos del usuario entidad"
    >
      <option value="captura_reportes">Captura + Reportes </option>
      <option value="reportes_seguimiento">Captura + Reportes + Seguimiento</option>
    </select>
  );

  const EntidadAuditorToggle = ({
    checked,
    onChange,
    disabled,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
  }) => (
    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-300"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      Permisos de evaluador
    </label>
  );

  return (
    <>
      <Header />
      <div className="mx-auto max-w-5xl p-4 sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Gestión de usuarios</h1>
          <p className="text-sm text-gray-600">
            Crea usuarios, asigna roles y define permisos de entidad. (Solo Admin)
          </p>
        </div>

        {/* Form crear usuario */}
        <form onSubmit={handleCreate} className="mb-8 rounded-lg border bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-4">

            <div className="sm:col-span-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">Rol</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-yellow-300"
              >
                <option value="entidad">Entidad</option>
                <option value="auditor">Evaluador</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {role === "entidad" ? (
              <div className="sm:col-span-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">Entidad/Usuario</label>
                <div className="flex items-center gap-2">
                  <select
                    value={entidad}
                    onChange={(e) => setEntidad(e.target.value)}
                    className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-yellow-300"
                    required={role === "entidad"}
                    disabled={loadingEntidades || entidadesCatalog.length === 0}
                  >
                    {loadingEntidades && <option value="">Cargando entidades…</option>}
                    {!loadingEntidades && entidadesCatalog.length === 0 && (
                      <option value="">Sin datos de entidades</option>
                    )}
                    {!loadingEntidades &&
                      entidadesCatalog.map((ent) => (
                        <option key={ent} value={ent}>
                          {ent}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={loadEntidades}
                    className="rounded-md border px-2 py-2 text-xs text-gray-700 hover:bg-gray-50"
                    title="Recargar entidades desde reports"
                  >
                    Recargar
                  </button>
                </div>
                {entidadesError && (
                  <p className="mt-1 text-xs text-red-600">{entidadesError}</p>
                )}
              </div>
            ) : (
              <div className="sm:col-span-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">Entidad/Usuario</label>
                <input
                  type="text"
                  value={entidad}
                  onChange={(e) => setEntidad(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-yellow-300"
                  placeholder="Nombre de la entidad/usuario"
                  required
                />
              </div>
            )}
            <div className="sm:col-span-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-yellow-300"
                placeholder="usuario@dominio.com"
                required
              />
            </div>

            <div className="sm:col-span-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 pr-16 text-sm focus:outline-none focus:ring focus:ring-yellow-300"
                  placeholder="Mínimo 8 caracteres"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-2 my-auto rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            {/* Permiso SOLO si rol = entidad */}
            {role === "entidad" && (
              <div className="sm:col-span-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Permisos (entidad)
                </label>
                <EntPermSelect value={entPerm} onChange={setEntPerm} />
                <div className="mt-2">
                  <EntidadAuditorToggle
                    checked={entidadAuditor}
                    onChange={setEntidadAuditor}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-50"
            >
              {submitting ? "Creando..." : "Crear usuario"}
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </form>

        {/* Tabla usuarios */}
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">ID</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Email</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Entidad/Usuario</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700">Rol</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-700 hidden sm:table-cell">
                  Permisos (entidad)
                </th>
                <th className="px-4 py-2 text-right hidden sm:table-cell">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6">
                    <Spinner />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    No hay usuarios.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <React.Fragment key={r.id}>
                    <tr>
                      <td className="px-4 py-2">{r.id}</td>
                      <td className="px-4 py-2">{r.email}</td>
                      <td className="px-4 py-2">{r.entidad || "—"}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <RoleBadge role={r.role} />
                          <select
                            value={r.role}
                            onChange={(e) => changeRole(r.id, e.target.value as UserRole)}
                            className="rounded-md border bg-white px-2 py-1 text-xs focus:outline-none focus:ring focus:ring-yellow-300"
                            disabled={currentUserId === r.id && r.role === "admin"}
                          >
                            <option value="entidad">Entidad</option>
                            <option value="auditor">Evaluador</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </td>

                      {/* Permisos entidad */}
                      <td className="px-4 py-2 hidden sm:table-cell">
                        {r.role === "entidad" ? (
                          <div className="flex flex-col gap-2">
                            <EntPermSelect
                              value={r.entidad_perm ?? "captura_reportes"}
                              onChange={(perm) => changeEntPerm(r.id, perm)}
                            />
                            <EntidadAuditorToggle
                              checked={Boolean(r.entidad_auditor)}
                              onChange={(nextValue) => changeEntidadAuditor(r.id, nextValue)}
                            />
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Acciones (solo desktop) */}
                      <td className="px-4 py-2 text-right hidden sm:table-cell">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => {
                              setResetId(r.id);
                              setResetPass("");
                              setShowResetPass(false);
                              setTimeout(() => resetRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
                            title="Resetear contraseña"
                            aria-label="Resetear contraseña"
                          >
                            <FiKey /> Cambiar contraseña
                          </button>
                          <button
                            onClick={() => handleDelete(r.id, r.email)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                            title="Eliminar usuario"
                            aria-label="Eliminar usuario"
                          >
                            <FiTrash2 /> Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                    {resetId === r.id && (
                      <tr>
                        <td colSpan={6} className="px-4 pb-4">
                          <div
                            ref={resetRowRef}
                            className="mt-2 rounded-lg border border-yellow-200 bg-yellow-50 p-4 shadow-inner"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                              <div className="sm:w-80">
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                  Nueva contraseña
                                </label>
                                <div className="relative">
                                  <input
                                    type={showResetPass ? "text" : "password"}
                                    value={resetPass}
                                    onChange={(e) => setResetPass(e.target.value)}
                                    className="w-full rounded-md border px-3 py-2 pr-16 text-sm focus:outline-none focus:ring focus:ring-yellow-300"
                                    placeholder="Mínimo 8 caracteres"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowResetPass((v) => !v)}
                                    className="absolute inset-y-0 right-2 my-auto rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                                    aria-label={showResetPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                                    title={showResetPass ? "Ocultar" : "Mostrar"}
                                  >
                                    {showResetPass ? <FiEyeOff /> : <FiEye />}
                                  </button>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleDoReset}
                                  disabled={submittingReset}
                                  className="rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-50"
                                >
                                  {submittingReset ? "Guardando..." : "Guardar"}
                                </button>
                                <button
                                  onClick={() => {
                                    setResetId(null);
                                    setResetPass("");
                                    setShowResetPass(false);
                                  }}
                                  className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Acciones móviles */}
                    <tr className="sm:hidden">
                      <td colSpan={6} className="px-4 pb-3">
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex-1 text-xs text-gray-600">
                            <div className="font-semibold">Entidad/Usuario</div>
                            <div>{r.entidad || "—"}</div>
                          </div>
                          {r.role === "entidad" ? (
                            <div className="flex-1">
                              <EntPermSelect
                                value={r.entidad_perm ?? "captura_reportes"}
                                onChange={(perm) => changeEntPerm(r.id, perm)}
                              />
                              <div className="mt-2">
                                <EntidadAuditorToggle
                                  checked={Boolean(r.entidad_auditor)}
                                  onChange={(nextValue) => changeEntidadAuditor(r.id, nextValue)}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 text-right text-gray-400 text-xs">—</div>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setResetId(r.id);
                                setResetPass("");
                                setShowResetPass(false);
                                setTimeout(() => resetRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
                              }}
                              className="rounded-full border p-2 hover:bg-gray-50"
                              title="Resetear contraseña"
                              aria-label="Resetear contraseña"
                            >
                              <FiKey />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id, r.email)}
                              className="rounded-full border border-red-300 p-2 text-red-700 hover:bg-red-50"
                              title="Eliminar usuario"
                              aria-label="Eliminar usuario"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </div>
                        {resetId === r.id && (
                          <div
                            ref={resetRowRef}
                            className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 shadow-inner"
                          >
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                              Nueva contraseña
                            </label>
                            <div className="relative mb-3">
                              <input
                                type={showResetPass ? "text" : "password"}
                                value={resetPass}
                                onChange={(e) => setResetPass(e.target.value)}
                                className="w-full rounded-md border px-3 py-2 pr-16 text-sm focus:outline-none focus:ring focus:ring-yellow-300"
                                placeholder="Mínimo 8 caracteres"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => setShowResetPass((v) => !v)}
                                className="absolute inset-y-0 right-2 my-auto rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                                aria-label={showResetPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                              >
                                {showResetPass ? <FiEyeOff /> : <FiEye />}
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={handleDoReset}
                                disabled={submittingReset}
                                className="flex-1 rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-50"
                              >
                                {submittingReset ? "Guardando..." : "Guardar"}
                              </button>
                              <button
                                onClick={() => {
                                  setResetId(null);
                                  setResetPass("");
                                  setShowResetPass(false);
                                }}
                                className="flex-1 rounded-md border px-4 py-2 text-sm hover:bg-gray-50"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Host de toasts */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "min-w-[220px] max-w-[90vw] rounded-lg px-3 py-2 text-sm shadow-lg ring-1 ring-black/5",
              t.tone === "success"
                ? "bg-emerald-600 text-white"
                : t.tone === "error"
                ? "bg-red-600 text-white"
                : "bg-gray-900 text-white",
            ].join(" ")}
            role="status"
            aria-live="polite"
          >
            {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}
