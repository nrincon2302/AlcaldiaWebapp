import React from "react";
import { FaFilePdf } from "react-icons/fa";

type Props = {
  rows: Array<Record<string, any>>;
  filename: string;
};

export default function ExportPDFButton({ rows, filename }: Props) {
  async function handleExport() {
    if (!rows.length) { alert("No hay datos para exportar"); return; }
    const [{ default: jsPDF }, auto] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable")
    ]);
    const doc = new jsPDF({ orientation: "landscape" });
    const headers = Object.keys(rows[0]);
    const body = rows.map(r => headers.map(h => (r as any)[h] ?? ""));

    (auto as any).default(doc, {
      head: [headers],
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] }
    });

    const today = new Date().toISOString().slice(0,10);
    doc.save(`${filename}_${today}.pdf`);
  }

  return (
    <button className="btn-outline" onClick={handleExport} title="Exportar a PDF">
      <FaFilePdf /> PDF
    </button>
  );
}
