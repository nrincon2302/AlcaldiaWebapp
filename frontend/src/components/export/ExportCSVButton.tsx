import React from "react";
import { FaFileCsv } from "react-icons/fa";

type Props = {
  rows: Array<Record<string, any>>;
  filename: string;
};

function sanitize(value: any) {
  if (value == null) return "";
  if (typeof value === "string") return value.replace(/\r?\n|\r/g, " ").trim();
  return String(value);
}

function downloadBlob(filename: string, mime: string, data: BlobPart | BlobPart[]) {
  const blob = new Blob(Array.isArray(data) ? data : [data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ExportCSVButton({ rows, filename }: Props) {
  function handleExport() {
    if (!rows.length) { alert("No hay datos para exportar"); return; }
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map(r =>
        headers.map(h => {
          const val = sanitize((r as any)[h]);
          return /[",\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(",")
      )
    ].join("\n");
    const today = new Date().toISOString().slice(0,10);
    downloadBlob(`${filename}_${today}.csv`, "text/csv;charset=utf-8", "\ufeff" + csv);
  }

  return (
    <button className="btn-outline" onClick={handleExport} title="Exportar a CSV">
      <FaFileCsv /> CSV
    </button>
  );
}
