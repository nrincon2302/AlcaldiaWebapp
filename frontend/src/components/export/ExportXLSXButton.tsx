import React from "react";
import { FaFileExcel } from "react-icons/fa";

type Props = {
  rows: Array<Record<string, any>>;
  filename: string;
};

export default function ExportXLSXButton({ rows, filename }: Props) {
  async function handleExport() {
    if (!rows.length) { alert("No hay datos para exportar"); return; }
    const xlsx = await import("xlsx");
    const ws = xlsx.utils.json_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Datos");
    const today = new Date().toISOString().slice(0,10);
    xlsx.writeFile(wb, `${filename}_${today}.xlsx`);
  }

  return (
    <button className="btn-outline" onClick={handleExport} title="Exportar a Excel">
      <FaFileExcel /> Excel
    </button>
  );
}
