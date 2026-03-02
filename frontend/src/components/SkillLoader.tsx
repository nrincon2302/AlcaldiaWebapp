import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { api } from "../lib/api";

type Props = { onProcessed?: () => void };

const expectedCols = [
  "Año", "Mes", "Id_Entidad", "Entidad",
  "Pct_Tecnicas", "Cap_Tecnicas",
  "Pct_Socioemocionales", "Cap_Socioemocionales",
];

export default function Dim6Uploader({ onProcessed }: Props) {
  const [fileInfo, setFileInfo] = useState<any[] | null>(null);
  const [validFile, setValidFile] = useState(false);
  const [emptyDatabase, setEmptyDatabase] = useState(false);

  // nuevo estado para mostrar banner de confirmación
  const [showConfirmEmpty, setShowConfirmEmpty] = useState(false);

  const [validRows, setValidRows] = useState<any[]>([]);
  const [invalidRows, setInvalidRows] = useState<any[]>([]);
  const [hasValidationIssues, setHasValidationIssues] = useState(false);

  const [entidades, setEntidades] = useState<{ id_entidad: number; entidad: string }[]>([]);
  const [anioDelete, setAnioDelete] = useState<number | "">("");
  const [mesDelete, setMesDelete] = useState<number | "">("");
  const [entidadDelete, setEntidadDelete] = useState<number | "">("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const meses = [
    { value: 1, label: "Enero" },
    { value: 2, label: "Febrero" },
    { value: 3, label: "Marzo" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Mayo" },
    { value: 6, label: "Junio" },
    { value: 7, label: "Julio" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Septiembre" },
    { value: 10, label: "Octubre" },
    { value: 11, label: "Noviembre" },
    { value: 12, label: "Diciembre" },
  ];

  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9_]/g, "");

  useEffect(() => {
    const loadEntidades = async () => {
      try {
        const res = await fetch("/external/Modelo_tabular.xlsx");
        const buffer = await res.arrayBuffer();
        const wb = XLSX.read(buffer);

        const sheet = wb.Sheets["Entidades"];
        if (!sheet) {
          console.error("No existe hoja 'Entidades'");
          return;
        }

        const data: any[] = XLSX.utils.sheet_to_json(sheet);

        const clean = (s: string) =>
          s?.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");

        const parsed = data.map((row) => {
          const normalized: any = {};

          Object.keys(row).forEach((key) => {
            normalized[clean(key)] = row[key];
          });

          return {
            id_entidad: Number(normalized["identidad"]),
            entidad: normalized["entidad"],
          };
        });

        const filtered = parsed.filter(
          (e) => !isNaN(e.id_entidad) && e.entidad
        );

        setEntidades(filtered);

      } catch (err) {
        console.error("Error cargando entidades:", err);
      }
    };

    loadEntidades();
  }, []);

  // -----------------------------
  // LECTURA
  // -----------------------------
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let data: any[] = [];

      if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer);
        data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      } else if (ext === "csv") {
        const text = await file.text();
        data = XLSX.utils.sheet_to_json(
          XLSX.read(text, { type: "string" }).Sheets.Sheet1
        );
      } else {
        alert("Formato no soportado");
        resetInput();
        return;
      }

      // columnas obligatorias
      const cleaned = Object.keys(data[0] || {}).map(clean);
      const expected = expectedCols.map(clean);

      if (!expected.every((x) => cleaned.includes(x))) {
        alert("Estructura incorrecta. Verifica columnas.");
        resetInput();
        return;
      }

      validarFilas(data);

      setFileInfo(data);
      setValidFile(true);

    } catch (err: any) {
      alert("Error: " + err.message);
      resetInput();
    }
  };

  // -----------------------------
  // VALIDACIÓN
  // -----------------------------
  const validarFilas = (rows: any[]) => {
    const val: any[] = [];
    const inval: any[] = [];

    rows.forEach((r, i) => {
      const pctT = r["Pct_Tecnicas"];
      const capT = r["Cap_Tecnicas"];
      const pctS = r["Pct_Socioemocionales"];
      const capS = r["Cap_Socioemocionales"];

      const missing = pctT === undefined || capT === undefined || pctS === undefined || capS === undefined;

      const notNumeric =
        isNaN(Number(pctT)) ||
        isNaN(Number(capT)) ||
        isNaN(Number(pctS)) ||
        isNaN(Number(capS));

      if (missing || notNumeric) {
        inval.push({ fila: i + 1, ...r });
      } else {
        val.push(r);
      }
    });

    setValidRows(val);
    setInvalidRows(inval);
    setHasValidationIssues(inval.length > 0);
  };

  const resetInput = () => {
    setFileInfo(null);
    setValidFile(false);
    setValidRows([]);
    setInvalidRows([]);
    setHasValidationIssues(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  // -----------------------------
  // PROCESAR SOLO FILAS VÁLIDAS
  // -----------------------------
  const procesar = async () => {
    if (!validRows.length) {
      alert("No hay filas válidas para procesar.");
      return;
    }

    const renamed = validRows.map((row) => ({
      anio: row["Año"],
      mes: row["Mes"],
      id_entidad: row["Id_Entidad"],
      entidad: row["Entidad"],
      pct_habilidades_tecnicas: Number(row["Pct_Tecnicas"]),
      num_capacitados_tecnicas: Number(row["Cap_Tecnicas"]),
      pct_habilidades_socioemocionales: Number(row["Pct_Socioemocionales"]),
      num_capacitados_socioemocionales: Number(row["Cap_Socioemocionales"]),
    }));

    const payload = { habilidades: renamed };

    try {
      const res = await api.post("/habilidades", payload);

      if (!res?.insertados) {
        alert("Error al procesar habilidades.");
        return;
      }

      alert("Habilidades actualizadas.");
      onProcessed?.();
      resetInput();

    } catch (err: any) {
      alert("Error D6: " + err.message);
    }
  };

  // al hacer click en el botón, mostramos el banner de confirmación
  const requestVaciarBaseDatos = () => {
    setShowConfirmEmpty(true);
  };

  // esta función realiza la eliminación real (se ejecuta al confirmar)
  const eliminarPorCondicion = async () => {
    try {
      const params = new URLSearchParams();

      if (anioDelete) params.append("anio", String(anioDelete));
      if (mesDelete) params.append("mes", String(mesDelete));
      if (entidadDelete) params.append("id_entidad", String(entidadDelete));

      if (![anioDelete, mesDelete, entidadDelete].some(Boolean)) {
        alert("Debe seleccionar al menos un filtro.");
        return;
      }

      await api.del(`/habilidades/condicion?${params.toString()}`);

      alert("Registros eliminados correctamente.");
      setShowDeleteConfirm(false);
      setAnioDelete("");
      setMesDelete("");
      setEntidadDelete("");

    } catch (err: any) {
      alert("Error eliminando: " + err.message);
    }
  };

  const cancelarVaciar = () => {
    setShowConfirmEmpty(false);
  };

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div
      style={{
        marginTop: 20,
        padding: 15,
        border: "1px solid #ddd",
        borderRadius: 5,
        backgroundColor: "rgba(211, 45, 55, 0.08)",
        width: "50%",
        minWidth: 300,
      }}
    >
      <h4 style={{ marginTop: 0, fontWeight: "bold" }}>
        Carga de reporte de Habilidades (Excel o CSV)
      </h4>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFile}
        style={{ marginBottom: 10 }}
      />

      {fileInfo && (
        <div
          style={{
            padding: 10,
            backgroundColor: "#eee",
            borderRadius: 3,
            marginBottom: 10,
          }}
        >
          <strong>Resumen del archivo:</strong>
          <ul>
            <li>Total filas: {fileInfo.length}</li>
            <li>Filas válidas: {validRows.length}</li>
            <li style={{ color: "#D32D37" }}>
              Filas con errores: {invalidRows.length}
            </li>
          </ul>

          {hasValidationIssues && (
            <div style={{ marginTop: 10, color: "#D32D37" }}>
              ⚠️ El archivo tiene filas vacías o no numéricas.
              <br />
              Solo se procesarán las filas válidas si decide continuar.
            </div>
          )}
        </div>
      )}

      {/* Si NO hay errores → botón normal */}
      {validFile && !hasValidationIssues && (
        <button
          onClick={procesar}
          style={{
            width: "100%",
            padding: "10px",
            background: "#D32D37",
            color: "white",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Procesar archivo
        </button>
      )}

      {/* Si SÍ hay errores → 2 botones, el principal es Cargar otro */}
      {validFile && hasValidationIssues && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={resetInput}
            style={{
              width: "100%",
              padding: "10px",
              background: "#D32D37", // botón principal
              color: "white",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Cargar otro archivo
          </button>

          <button
            onClick={procesar}
            style={{
              width: "100%",
              padding: "10px",
              background: "#666",
              color: "white",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Actualizar sólo filas válidas
          </button>
        </div>
      )}

      <div style={{ marginTop: 15, fontSize: 14 }}>
        <strong>Nota:</strong> El archivo cargado complementará los datos
        existentes en la base de datos para las habilidades reportadas.
        <br />
        También puede eliminar registros a continuación:
      </div>

<div
  style={{
    marginTop: 25,
    padding: 20,
    borderRadius: 8,
    background: "#fafafa",
    border: "1px solid #e0e0e0",
  }}
>
  <h4 style={{ marginBottom: 15 }}>
    Eliminar registros
  </h4>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginBottom: 12,
    }}
  >
    <input
      type="number"
      placeholder="Año"
      value={anioDelete}
      onChange={(e) =>
        setAnioDelete(e.target.value ? Number(e.target.value) : "")
      }
      style={{ padding: 6 }}
    />

    <select
      value={mesDelete}
      onChange={(e) =>
        setMesDelete(e.target.value ? Number(e.target.value) : "")
      }
      style={{ padding: 6 }}
    >
      <option value="">Mes</option>
      {meses.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  </div>

  <select
    value={entidadDelete}
    onChange={(e) =>
      setEntidadDelete(e.target.value ? Number(e.target.value) : "")
    }
    style={{
      width: "100%",
      padding: 6,
      marginBottom: 15,
    }}
  >
    <option value="">Seleccionar entidad (opcional)</option>
    {entidades.map((e) => (
      <option key={e.id_entidad} value={e.id_entidad}>
        {e.entidad}
      </option>
    ))}
  </select>

  <button
    disabled={
      !anioDelete && !mesDelete && !entidadDelete
    }
    onClick={() => setShowDeleteConfirm(true)}
    style={{
      width: "100%",
      padding: 8,
      background:
        !anioDelete && !mesDelete && !entidadDelete
          ? "#ccc"
          : "#D32D37",
      color: "white",
      borderRadius: 6,
      border: "none",
      cursor:
        !anioDelete && !mesDelete && !entidadDelete
          ? "not-allowed"
          : "pointer",
      fontSize: 14,
    }}
  >
    Eliminar según filtros
  </button>

  {showDeleteConfirm && (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        background: "#fff4f4",
        border: "1px solid #f5c2c2",
        borderRadius: 6,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        ¿Confirmar eliminación con los filtros seleccionados?
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={eliminarPorCondicion}
          style={{
            flex: 1,
            padding: 8,
            background: "#D32D37",
            color: "white",
            borderRadius: 6,
            border: "none",
          }}
        >
          Confirmar
        </button>

        <button
          onClick={() => setShowDeleteConfirm(false)}
          style={{
            flex: 1,
            padding: 8,
            background: "#eee",
            borderRadius: 6,
            border: "1px solid #ccc",
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )}
</div>
    </div>
  );
}
