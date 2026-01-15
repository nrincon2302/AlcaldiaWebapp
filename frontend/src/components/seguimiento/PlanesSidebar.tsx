import React, { useMemo, useState } from "react";
import type { Plan } from "./useSeguimientos";
import { BsSortUpAlt, BsSortDown } from "react-icons/bs";

type Props = {
  plans: Plan[];
  activePlanId: number | null;
  onSelect: (id: number) => void;

  count?: number;
  createdOrder: "asc" | "desc";
  toggleCreatedOrder: () => void;
  activeEstado?: string | null;
  activeChildrenCount?: number;
};

// Helper robusto para Safari: parsear fechas sin zona como UTC
function parsePlanDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const s = raw.trim().replace(" ", "T");

  // Con zona explícita
  if (/[zZ]$/.test(s) || /[+\-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // Solo fecha
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Fecha + HH:mm
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
    const d = new Date(`${s}:00Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Fecha + HH:mm:ss(.sss)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    const d = new Date(`${s}Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  // Último recurso: asumir UTC
  const fallback = new Date(`${s}Z`);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// Helper: obtener una fecha "representativa" del plan
function getPlanDate(p: Plan): Date | null {
  return (
    parsePlanDate(p.created_at) ||
    parsePlanDate((p as any).createdAt) ||
    parsePlanDate(p.fecha_inicio) ||
    parsePlanDate(p.fecha_final)
  );
}

export default function PlanesSidebar({
  plans,
  activePlanId,
  onSelect,
  count,
  createdOrder,
  toggleCreatedOrder,
  activeEstado,
  activeChildrenCount,
}: Props) {
  const [q, setQ] = useState("");

  //  Filtros de fecha
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");

  // Filtro por resultado de evaluación 
  const [evaluacionFilter, setEvaluacionFilter] = useState("");

  // Años disponibles a partir de las fechas de los planes
  const yearsAvailable = useMemo(() => {
    const set = new Set<string>();
    for (const p of plans) {
      const d = getPlanDate(p);
      if (!d) continue;
      set.add(d.getFullYear().toString());
    }
    return Array.from(set).sort();
  }, [plans]);

  const filtered = useMemo(() => {
    const hasDateFilter = !!year || !!month;
    const hasEvalFilter = !!evaluacionFilter; 

    return plans.filter((p) => {
      // --- Filtro por texto ---
      const s = q.trim().toLowerCase();
      if (s) {
        const matchesText =
          p.nombre_entidad?.toLowerCase().includes(s) ||
          p.num_plan_mejora?.toLowerCase().includes(s);
        if (!matchesText) return false;
      }

      // --- Filtro por fecha ---
      if (hasDateFilter) {
        const d = getPlanDate(p);
        if (!d) return false; // si hay filtro de fecha y el plan no tiene fecha, se excluye

        const y = d.getFullYear().toString();
        const m = String(d.getMonth() + 1).padStart(2, "0");

        if (year && y !== year) return false;
        if (month && m !== month) return false;
      }

      // Filtro por Resultado Evaluación
      if (hasEvalFilter) {
        const estadoReal = p.aprobado_evaluador || ""; 
        
       
        if (evaluacionFilter === "Sin evaluar") {
            if (estadoReal !== "") return false;
        } else {
            // Filtro por "Aprobado" o "Rechazado"
            if (estadoReal !== evaluacionFilter) return false;
        }
      }

      return true;
    });
  }, [plans, q, year, month, evaluacionFilter]); 

  return (
    <aside className="sticky top-4 h-fit rounded-xl border bg-white p-3 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Acciones de mejora</h3>
        <button
          type="button"
          onClick={toggleCreatedOrder}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium hover:bg-gray-200"
          title={
            createdOrder === "asc"
              ? "Ordenar: desde la última"
              : "Ordenar: desde la primera"
          }
          aria-label="Alternar orden por fecha de creación"
        >
          {createdOrder === "asc" ? (
            <BsSortUpAlt className="text-base" />
          ) : (
            <BsSortDown className="text-base" />
          )}
        </button>
      </div>

      {/* Buscador local */}
      <div className="mb-2">
        <input
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Buscar entidad…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Filtro por fecha */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {/* Año */}
        <select
          className="rounded-md border px-2 py-1 text-sm"
          value={year}
          onChange={(e) => {
            setYear(e.target.value);
          }}
        >
          <option value="">Año</option>
          {yearsAvailable.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {/* Mes*/}
        <select
          className="rounded-md border px-2 py-1 text-sm"
          value={month}
          onChange={(e) => {
            const val = e.target.value;
            setMonth(val);
          }}
        >
          <option value="">Mes</option>

          {[
            { value: "01", label: "Enero" },
            { value: "02", label: "Febrero" },
            { value: "03", label: "Marzo" },
            { value: "04", label: "Abril" },
            { value: "05", label: "Mayo" },
            { value: "06", label: "Junio" },
            { value: "07", label: "Julio" },
            { value: "08", label: "Agosto" },
            { value: "09", label: "Septiembre" },
            { value: "10", label: "Octubre" },
            { value: "11", label: "Noviembre" },
            { value: "12", label: "Diciembre" },
          ].map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Filtro de Estado de Evaluación */}
      <div className="mb-2">
        <select
            className="w-full rounded-md border px-2 py-1 text-sm"
            value={evaluacionFilter}
            onChange={(e) => setEvaluacionFilter(e.target.value)}
        >
            <option value="">-- Estado Evaluación del plan --</option>
            <option value="Aprobado">Aprobado</option>
            <option value="Rechazado">Devuelto</option>
            <option value="Sin evaluar">Sin evaluar</option>
        </select>
      </div>

      <div className="max-h-[70vh] overflow-auto pr-1">
        {filtered.length === 0 && (
          <div className="py-6 text-center text-xs text-gray-500">
            Sin resultados
          </div>
        )}

        <ul className="space-y-1">
          {filtered.map((p) => {
            const active = p.id === activePlanId;
            const estadoPlan =
              active && activeEstado != null
                ? activeEstado
                : p.estado ?? undefined;

            const isDraftSidebar = estadoPlan === "Borrador";

            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onSelect(p.id)}
                  className={[
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition",
                    active
                      ? "bg-yellow-400 text-gray-800"
                      : "hover:bg-gray-100 text-gray-800",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {p.nombre_entidad || "—"}
                      </div>
                      <div className="text-sm opacity-80 italic">
                        {p.indicador ?? ""}
                      </div>
                    </div>

                    {!active && isDraftSidebar && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        {estadoPlan}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}