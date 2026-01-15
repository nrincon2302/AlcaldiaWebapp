import React from "react";
import type { Seguimiento } from "./useSeguimientos";

type Row = Seguimiento & {
  updated_at?: string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};

type Props = {
  items: Row[];
  onViewEdit: (id: number) => void;
};

function parseISOAssumeUTC(raw: string): Date {
  const s = raw.trim().replace(" ", "T");

  // Si ya trae zona (Z u offset), úsala tal cual
  if (/[zZ]$/.test(s) || /[+\-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s);
  }

  // Sin zona: asumimos UTC y agregamos 'Z'
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    // solo fecha
    return new Date(`${s}T00:00:00Z`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) {
    return new Date(`${s}:00Z`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
    return new Date(`${s}Z`);
  }

  // último recurso: intenta como UTC
  return new Date(`${s}Z`);
}

function fmtBogota(s?: string | null) {
  if (!s) return "—";
  const d = parseISOAssumeUTC(s);
  if (isNaN(d.getTime())) return s; // si no es fecha válida, muéstrala cruda

  // Formato final: YYYY-MM-DD HH:mm en zona Colombia
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

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");

  return `${year}-${month}-${day} ${hour}:${minute}`;
}


export default function FormulariosGuardadosTable({ items, onViewEdit }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-600">
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Insumo / Acción / Descripción</th>
            <th className="px-4 py-3">Fechas</th>
            <th className="px-4 py-3">Última actualización</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((s, idx) => {
            const last =
              s.updated_at ?? s.updatedAt ?? s.created_at ?? s.createdAt ?? null;

            return (
              <tr key={s.id ?? `row-${idx}`} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">{idx + 1}</td>

                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">
                    {s.insumo_mejora || "—"}
                  </div>
                  <div className="text-gray-700">
                    {s.accion_mejora_planteada || "—"}
                  </div>
                  <div className="text-gray-500">
                    {s.descripcion_actividades || "—"}
                  </div>
                </td>

                <td className="px-4 py-3 text-gray-700">
                  <div>
                    <span className="text-xs text-gray-500">Inicio: </span>
                    {s.fecha_inicio || "—"}
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">Final: </span>
                    {s.fecha_final || "—"}
                  </div>
                </td>

                <td className="px-4 py-3">
                  {fmtBogota(last)}
                </td>

                <td className="px-4 py-3">
                  {s.id && (
                    <button
                      type="button"
                      onClick={() => onViewEdit(s.id!)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Ver / Editar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}

          {items.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                No hay seguimientos registrados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
