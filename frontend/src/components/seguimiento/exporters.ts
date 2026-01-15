import type { Plan, Seguimiento } from "./useSeguimientos";

export type SeguimientoExportGroup = {
  plan: Plan | null;
  seguimientos: Seguimiento[];
};

type ColKey =
  | keyof Seguimiento
  | "updated_by_email"
  | "nombre_entidad"
  | "enlace_entidad"
  | "estado"
  | "aprobado_evaluador"
  | "plan_descripcion_actividades"
  | "plan_evidencia_cumplimiento";

type Col = { key: ColKey; title: string };

const COLS: Col[] = [
  { key: "nombre_entidad",           title: "Nombre entidad" },
  { key: "enlace_entidad",           title: "Enlace entidad" },
  { key: "estado",                   title: "Estado plan" },
  { key: "indicador",                title: "Indicador" },
  { key: "criterio",                 title: "Criterio" },
  { key: "tipo_accion_mejora",       title: "Tipo de acción" },
  { key: "observacion_informe_calidad", title: "Acción recomendada (Informe calidad)" },
  { key: "accion_mejora_planteada",  title: "Acción de mejora planteada" },
  { key: "plan_descripcion_actividades", title: "Descripción de actividades (Plan)" },
  { key: "plan_evidencia_cumplimiento",  title: "Evidencia plan (texto)" },
  { key: "fecha_inicio",             title: "F. Inicio plan" },
  { key: "fecha_final",              title: "F. Final plan" },
  { key: "aprobado_evaluador",       title: "Resultado de la evaluación" },
  { key: "fecha_reporte",            title: "F. reporte seguimiento" },
  { key: "seguimiento",              title: "Estado seguimiento" },
  { key: "descripcion_actividades",  title: "Actividades realizadas" },
  { key: "evidencia_cumplimiento",   title: "Evidencia (archivo/url)" },
  { key: "observacion_calidad",      title: "Obs. DDCS" },
  { key: "updated_by_email",         title: "Actualizado por" },
  { key: "created_at",               title: "Creado en" },
  { key: "updated_at",               title: "Actualizado en" },
];

function buildRowsForPlan(plan: Plan | null, items: Seguimiento[]) {
  const source = items.length ? items : [{ plan_id: plan?.id ?? null } as Seguimiento];

  return source.map((s) => ({
    nombre_entidad: plan?.nombre_entidad ?? "",
    enlace_entidad: plan?.enlace_entidad ?? "",
    estado: plan?.estado ?? "",
    indicador: plan?.indicador ?? s.indicador ?? "",
    criterio: plan?.criterio ?? s.criterio ?? "",
    tipo_accion_mejora: plan?.tipo_accion_mejora ?? s.tipo_accion_mejora ?? "",
    observacion_informe_calidad: s.observacion_informe_calidad ?? "",
    accion_mejora_planteada: plan?.accion_mejora_planteada ?? s.accion_mejora_planteada ?? "",
    plan_descripcion_actividades: plan?.descripcion_actividades ?? (s as any).plan_descripcion_actividades ?? "",
    plan_evidencia_cumplimiento: plan?.evidencia_cumplimiento ?? (s as any).plan_evidencia_cumplimiento ?? "",
    fecha_inicio: plan?.fecha_inicio ?? s.fecha_inicio ?? "",
    fecha_final: plan?.fecha_final ?? s.fecha_final ?? "",
    aprobado_evaluador: plan?.aprobado_evaluador ?? (s as any).aprobado_evaluador ?? "",
    fecha_reporte: s.fecha_reporte ?? "",
    seguimiento: s.seguimiento ?? plan?.seguimiento ?? "",
    descripcion_actividades: s.descripcion_actividades ?? "",
    evidencia_cumplimiento: s.evidencia_cumplimiento ?? "",
    observacion_calidad: s.observacion_calidad ?? plan?.observacion_calidad ?? "",
    updated_by_email: (s as any).updated_by_email ?? "",
    created_at: s.created_at ?? "",
    updated_at: s.updated_at ?? "",
  }));
}

function buildDatasetForGroups(groups: SeguimientoExportGroup[]) {
  const rows = groups.flatMap((g) => buildRowsForPlan(g.plan, g.seguimientos || []));
  const title =
    groups.length === 1 && groups[0]?.plan
      ? `Plan ${groups[0].plan.id} — ${groups[0].plan.nombre_entidad}`
      : "Seguimientos";
  return { cols: COLS, rows, title };
}

export function buildSeguimientoDataset(plan: Plan | null, items: Seguimiento[]) {
  return buildDatasetForGroups([{ plan, seguimientos: items }]);
}

export function exportSeguimientosCSV(plan: Plan | null, items: Seguimiento[]) {
  exportAllSeguimientosCSV([{ plan, seguimientos: items }]);
}

export function exportAllSeguimientosCSV(groups: SeguimientoExportGroup[]) {
  const { cols, rows, title } = buildDatasetForGroups(groups);
  if (!rows.length) { alert("No hay datos para exportar."); return; }

  const headers = cols.map(c => c.title);
  const esc = (val: any) => {
    const v = (val ?? "").toString().replace(/\r?\n|\r/g, " ").trim();
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const csv = [
    headers.join(","),
    ...rows.map(r => headers.map((_, i) => {
      const key = cols[i].key as any;
      return esc((r as any)[key]);
    }).join(",")),
  ].join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  a.href = url; a.download = `${title.replace(/\s+/g, "_")}_${today}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export async function exportSeguimientosXLSX(plan: Plan | null, items: Seguimiento[]) {
  await exportAllSeguimientosXLSX([{ plan, seguimientos: items }]);
}

export async function exportAllSeguimientosXLSX(groups: SeguimientoExportGroup[]) {
  const { cols, rows, title } = buildDatasetForGroups(groups);
  if (!rows.length) { alert("No hay datos para exportar."); return; }

  const xlsx = await import("xlsx");
  const head = [cols.map(c => c.title)];
  const body = rows.map(r => cols.map(c => (r as any)[c.key] ?? ""));

  const ws = xlsx.utils.aoa_to_sheet([...head, ...body]);
  // anchos un poco más amplios para columnas largas
  ws["!cols"] = cols.map((c, idx) => {
    const base = Math.max(14, c.title.length + 2);
    // dar más ancho a algunas columnas clave
    const widthMap: Record<number, number> = {
      0: 36,  // Nombre entidad
      1: 42,  // Enlace entidad
      2: 24,  // Estado plan
      3: 28,  // Indicador
      4: 28,  // Criterio
      5: 24,  // Tipo acción
      6: 32,  // Acción recomendada
      7: 32,  // Acción de mejora
      8: 42,  // Desc actividades plan
      9: 42,  // Evidencia plan
      12: 28, // Resultado evaluación
      13: 38, // Actividades seg
      14: 32, // Evidencia seg
      15: 32, // Obs DDCS
      16: 28, // Actualizado por
    };
    return { wch: widthMap[idx] ?? base };
  });

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Seguimientos");

  const today = new Date().toISOString().slice(0, 10);
  xlsx.writeFile(wb, `${title.replace(/\s+/g, "_")}_${today}.xlsx`);
}

export async function exportSeguimientosPDF(plan: Plan | null, items: Seguimiento[]) {
  await exportAllSeguimientosPDF([{ plan, seguimientos: items }]);
}

export async function exportAllSeguimientosPDF(groups: SeguimientoExportGroup[]) {
  const { cols, rows, title } = buildDatasetForGroups(groups);
  if (!rows.length) { alert("No hay datos para exportar."); return; }

  const [{ default: jsPDF }, auto] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  // A3 para mayor ancho; haremos bloques de columnas apilados verticalmente
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });

  const margin = 28; // un poco más de ancho útil
  const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight() - margin * 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(title, margin, margin);

  const head = [cols.map(c => c.title)];
  const body = rows.map(r => cols.map(c => (r as any)[c.key] ?? ""));
  // Definir anchos estimados por columna para calcular bloques
  const widthMap: Record<number, number> = {
    0: 120, // Nombre entidad
    1: 130, // Enlace entidad
    2: 80,  // Estado plan
    3: 90,  // Indicador
    4: 90,  // Criterio
    5: 90,  // Tipo acción
    6: 130, // Acción recomendada
    7: 130, // Acción de mejora
    8: 140, // Desc actividades plan
    9: 140, // Evidencia plan
    10: 90,  // F inicio
    11: 90,  // F final
    12: 120, // Resultado eval
    13: 110, // F reporte
    14: 100, // Estado seguimiento
    15: 150, // Actividades
    16: 130, // Evidencia seg
    17: 110, // Obs DDCS
    18: 110, // Actualizado por
    19: 110, // Creado en
    20: 110, // Actualizado en
  };

  // Dividir columnas en bloques que quepan en el ancho disponible
  const blocks: number[][] = [];
  let current: number[] = [];
  let currentWidth = 0;
  cols.forEach((_, idx) => {
    const w = widthMap[idx] ?? 100;
    if (current.length > 0 && currentWidth + w > pageWidth) {
      blocks.push(current);
      current = [];
      currentWidth = 0;
    }
    current.push(idx);
    currentWidth += w;
  });
  if (current.length) blocks.push(current);

  let startY = margin + 12;

  blocks.forEach((block) => {
    const headChunk = [block.map((i) => head[0][i])];
    const bodyChunk = body.map((row) => block.map((i) => row[i]));

    const columnStyles: Record<number, any> = {};
    block.forEach((colIdx, i) => {
      columnStyles[i] = { cellWidth: widthMap[colIdx] ?? 100 };
    });

    // saltar a nueva página si no cabe verticalmente
    if (startY > pageHeight) {
      doc.addPage();
      doc.text(title, margin, margin);
      startY = margin + 12;
    }

    (auto as any).default(doc, {
      startY,
      margin: { left: margin, right: margin, top: margin, bottom: margin },
      head: headChunk,
      body: bodyChunk,
      theme: "grid",
      tableWidth: "wrap",
      horizontalPageBreak: false,
      rowPageBreak: "auto",
      columnStyles,
      styles: {
        font: "helvetica",
        fontSize: 6,
        cellPadding: 3,
        overflow: "linebreak",
        cellWidth: "wrap",
        valign: "top",
        halign: "left",
        textColor: [30, 30, 30],
      },
      headStyles: {
        fillColor: [10, 47, 90],
        textColor: 255,
        fontStyle: "bold",
      },
      didDrawPage: () => {
        doc.setFontSize(12);
        doc.text(title, margin, margin);
      },
    });

    const lastY = (doc as any).lastAutoTable.finalY || startY;
    startY = lastY + 14; // espacio antes del siguiente bloque
  });

  const today = new Date().toISOString().slice(0, 10);
  doc.save(`${title.replace(/\s+/g, "_")}_${today}.pdf`);
}
