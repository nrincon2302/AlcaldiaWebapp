import React from "react";
import type { Seguimiento } from "./useSeguimientos";
import { FiUser } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { hasAuditorAccess } from "../../lib/auth";

type Props = {
  items: Seguimiento[];
  activeId?: number | null;
  onSelect: (id: number) => void;
};

function parseISOAssumeUTC(raw: string): Date {
  const s = raw.trim().replace(" ", "T");
  if (/[zZ]$/.test(s) || /[+\-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00Z`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return new Date(`${s}:00Z`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) return new Date(`${s}Z`);
  return new Date(`${s}Z`);
}

function fmtBogota(s?: string | null) {
  if (!s) return "—";
  const d = parseISOAssumeUTC(s);
  if (isNaN(d.getTime())) return s;
  const f = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = f.formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/** Badge de estado (chip) */
function getStatusClasses(statusRaw?: string | null) {
  const status = (statusRaw || "").toLowerCase().trim();

  switch (status) {
    case "pendiente":
      return "bg-amber-50 text-amber-800 border border-amber-200";
    case "en progreso":
      return "bg-blue-50 text-blue-700 border border-blue-200";
    case "finalizado":
      return "bg-emerald-50 text-emerald-700 border border-emerald-200";
    default:
      return "bg-slate-50 text-slate-700 border border-slate-200";
  }
}

/** Punto del timeline (color + número) */
function getDotClasses(statusRaw?: string | null, isActive?: boolean) {
  const status = (statusRaw || "").toLowerCase().trim();

  const base =
    "flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-semibold text-white shadow-sm";

  const color =
    status === "pendiente"
      ? "bg-amber-400"
      : status === "en progreso"
      ? "bg-blue-500"
      : status === "finalizado"
      ? "bg-emerald-500"
      : "bg-slate-400";

  const ring = isActive ? " ring-2 ring-slate-100" : "";

  return `${base} ${color}${ring}`;
}

/** Línea entre nodos (mismo color del estado, desaturado) */
function getLineClasses(statusRaw?: string | null) {
  const status = (statusRaw || "").toLowerCase().trim();

  return status === "pendiente"
    ? "bg-amber-300/50"
    : status === "en progreso"
    ? "bg-blue-400/50"
    : status === "finalizado"
    ? "bg-emerald-400/50"
    : "bg-slate-300/60";
}

/** Solo el borde del card activo, según estado */
function getActiveBorderClasses(statusRaw?: string | null) {
  const status = (statusRaw || "").toLowerCase().trim();

  switch (status) {
    case "pendiente":
      return "border-amber-400";
    case "en progreso":
      return "border-blue-500";
    case "finalizado":
      return "border-emerald-500";
    default:
      return "border-slate-400";
  }
}

const MONTHS = [
  { value: "", label: "Mes" },
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

export default function SeguimientosTimeline({ items, activeId, onSelect }: Props) {
  const { user } = useAuth();
  const role = user?.role;
  const isAuditor = hasAuditorAccess(user as any);

  // ---------- Filtros de fecha ----------
  const [year, setYear] = React.useState<string>("");
  const [month, setMonth] = React.useState<string>("");

  const toSafeDate = React.useCallback((raw?: string | null) => {
    if (!raw) return null;
    const d = parseISOAssumeUTC(raw);
    return isNaN(d.getTime()) ? null : d;
  }, []);

  const getRange = React.useCallback(
    (s: Seguimiento) => {
      const fallback =
        toSafeDate(s.updated_at ?? (s as any).updatedAt ?? s.created_at ?? (s as any).createdAt ?? null) ??
        null;
      const start = toSafeDate(s.fecha_inicio) ?? fallback;
      const end = toSafeDate(s.fecha_final) ?? start ?? fallback;
      return { start, end };
    },
    [toSafeDate]
  );

  // Años disponibles a partir de las fechas de los seguimientos
  const years = React.useMemo(() => {
    const set = new Set<number>();
    for (const s of items) {
      const { start, end } = getRange(s);
      if (!start && !end) continue;
      const yStart = (start ?? end)!.getFullYear();
      const yEnd = (end ?? start)!.getFullYear();
      for (let y = yStart; y <= yEnd; y++) {
        set.add(y);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [items, getRange]);

  const filteredItems = React.useMemo(() => {
    const hasDateFilter = !!year || !!month;
    if (!hasDateFilter) return items;

    return items.filter((s) => {
      const { start, end } = getRange(s);
      if (!start && !end) return true; // sin fecha: no se excluye

      const rangeStart = start ?? end!;
      const rangeEnd = end ?? start!;

      const yNum = year ? Number(year) : null;
      const mNum = month ? Number(month) : null;

      // Año + mes: solapamiento con ese mes concreto
      if (yNum && mNum) {
        const targetStart = new Date(yNum, mNum - 1, 1);
        const targetEnd = new Date(yNum, mNum, 0, 23, 59, 59, 999);
        return rangeStart <= targetEnd && rangeEnd >= targetStart;
      }

      // Solo año
      if (yNum) {
        const targetStart = new Date(yNum, 0, 1);
        const targetEnd = new Date(yNum, 11, 31, 23, 59, 59, 999);
        return rangeStart <= targetEnd && rangeEnd >= targetStart;
      }

      // Solo mes: probar en cada año del rango
      if (mNum) {
        for (let yr = rangeStart.getFullYear(); yr <= rangeEnd.getFullYear(); yr++) {
          const targetStart = new Date(yr, mNum - 1, 1);
          const targetEnd = new Date(yr, mNum, 0, 23, 59, 59, 999);
          if (rangeStart <= targetEnd && rangeEnd >= targetStart) return true;
        }
        return false;
      }

      return true;
    });
  }, [items, year, month, getRange]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-4 text-center text-sm text-slate-500">
        Aún no hay seguimientos en este plan.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* Año */}
        <select
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
            // no tocamos mes/día; el usuario decide
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
        >
          <option value="">Año</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {/* Mes */}
        <select
          value={month}
          onChange={(e) => {
            const v = e.target.value;
            setMonth(v);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
        >
          {MONTHS.map((m) => (
            <option key={m.value || "mes-placeholder"} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Timeline */}
      <div className="space-y-5">
        {filteredItems.map((s, i) => {
          const isActive = s.id === activeId;
          const isLast = i === filteredItems.length - 1;

          const last =
            s.updated_at ??
            (s as any).updatedAt ??
            s.created_at ??
            (s as any).createdAt ??
            null;
          const updatedBy = (s as any).updated_by_entidad ?? "";

          return (
            <div key={s.id ?? `seg-${i}`} className="relative pl-10">
              {/* Línea hacia abajo (no en el último nodo) */}
              {!isLast && (
                <div
                  className={[
                    "absolute left-4 top-7 w-px h-[calc(100%-1.75rem)]",
                    getLineClasses(s.seguimiento),
                  ].join(" ")}
                />
              )}

              {/* Punto del timeline con número */}
              <div className="absolute left-4 top-4 -translate-x-1/2">
                <div className={getDotClasses(s.seguimiento, isActive)}>
                  {i + 1}
                </div>
              </div>

              {/* CARD */}
              <div
                className={[
                  "rounded-xl bg-white p-4 sm:p-5 shadow-sm transition-shadow transition-colors border",
                  isActive
                    ? `${getActiveBorderClasses(s.seguimiento)} shadow-md`
                    : "border-slate-200 hover:border-slate-300 hover:shadow-md",
                ].join(" ")}
              >
                {/* Header */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  {/* Izquierda: título + estado */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900 text-sm sm:text-base tracking-tight whitespace-nowrap">
                      Seguimiento {i + 1}
                    </h3>
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-3 py-1 text-[11px] sm:text-xs font-medium",
                        getStatusClasses(s.seguimiento ?? "Pendiente"),
                      ].join(" ")}
                    >
                      {s.seguimiento ?? "Pendiente"}
                    </span>
                  </div>

                  {/* Derecha: entidad + fecha */}
                  <div className="flex flex-col items-start sm:items-end text-[11px] sm:text-xs text-slate-500">
                    <div className="inline-flex items-center gap-1">
                      <FiUser className="h-3.5 w-3.5 text-slate-600" />
                      <span className="font-medium text-slate-600">
                        {updatedBy || "—"}
                      </span>
                    </div>
                    <span className="mt-0.5">{fmtBogota(last)}</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="mt-3 border-t border-slate-300" />

                {/* Body */}
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between flex-col md:flex-row space-y-1 text-xs sm:text-sm leading-relaxed text-slate-700">
                    <div className="space-y-1 flex flex-col md:max-w-md lg:max-w-lg">
                      {(s.accion_mejora_planteada || s.descripcion_actividades) && (
                        <div>
                          {s.accion_mejora_planteada && (
                            <div className="font-medium text-slate-600">
                              Acción:&nbsp;{s.accion_mejora_planteada}
                            </div>
                          )}
                          {s.descripcion_actividades && (
                            <div className="font-medium text-slate-600">
                              Descripción:&nbsp;{s.descripcion_actividades}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {s.id && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(s.id!);
                          setTimeout(() => {
                            const section = document.getElementById(
                              "seguimiento-section"
                            );
                            if (section) {
                              section.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                            }
                          }, 0);
                        }}
                        className="flex justify-center items-center md:justify-end rounded-lg border border-amber-500/70 bg-yellow-400 px-3 py-1.5 text-[11px] sm:text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-amber-300 hover:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 md:max-h-7"
                      >
                        {isAuditor ? "Hacer observación" : "Ver detalle"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
