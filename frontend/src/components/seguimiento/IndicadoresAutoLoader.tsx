import { useEffect } from "react";
import { api } from "../../lib/api";

export type IndicadorApiRow = {
  entidad: string | undefined;
  indicador: string | undefined;
  criterio: string | undefined;
  accion: string | undefined;
  insumo: string | undefined;
};

type Props = {
  onImport: (data: { entidad?: string; indicador?: string; criterio?: string; accion?: string; insumo?: string}) => void;
  onOptionsFromApi?: (rows: IndicadorApiRow[]) => void;
  nombreEntidad?: string | null;
};

export default function IndicadoresAutoLoader({
  onImport,
  onOptionsFromApi,
  nombreEntidad,
}: Props) {
  useEffect(() => {
    let mounted = true;

    const fetchReport = async () => {
      try {
        if (!nombreEntidad) return;

        let res: any = null;
        if (nombreEntidad !== "Administrador" && nombreEntidad !== "Alcaldía Demo") {
          res = await api(`/reports/${encodeURIComponent(nombreEntidad)}`);
        }
        if (!mounted || !res) return;

        const toRowsFromObj = (obj: any): IndicadorApiRow[] => {
          if (!obj || typeof obj !== "object") return [];

          // Caso actual del backend: { entidad, indicadores: [{ indicador, criterio, accion, insumo }, ...] }
          if (Array.isArray(obj.indicadores)) {
            const entidad =
              obj.entidad || obj.nombre_entidad || obj.nombre || undefined;

            return obj.indicadores.map((item: any) => ({
              entidad: entidad ? String(entidad) : undefined,
              indicador: item?.indicador != null ? String(item.indicador) : undefined,
              criterio: item?.criterio != null ? String(item.criterio) : undefined,
              accion: item?.accion != null ? String(item.accion) : undefined,
              insumo: item?.insumo != null ? String(item.insumo) : undefined,
            }));
          }

          // Fallback: intentar extraer campos sueltos
          const lowerObj: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(obj)) {
            lowerObj[k.toLowerCase()] = v;
          }

          const findKey = (candidates: string[]) => {
            for (const c of candidates) {
              if (c in lowerObj) return lowerObj[c];
            }
            return undefined;
          };

          const entidad = findKey(["entidad", "nombre_entidad", "nombre"]);
          const indicador = findKey([
            "indicador",
            "indicador_nombre",
            "nombre_indicador",
          ]);
          const criterio = findKey([
            "criterio",
          ])
          const accion = findKey([
            "accion",
            "accion_mejora_planteada",
            "accion_planteada",
          ]);
          const insumo = findKey([
            "insumo",
            "insumo_mejora",
          ]);

          if (!entidad && !indicador && !accion && !insumo) return [];

          return [
            {
              entidad: entidad != null ? String(entidad) : undefined,
              indicador: indicador != null ? String(indicador) : undefined,
              criterio: criterio != null ? String(criterio) : undefined,
              accion: accion != null ? String(accion) : undefined,
              insumo: insumo != null ? String(insumo) : undefined,
            },
          ];
        };

        const arrayObjs = Array.isArray(res) ? res : [res];

        const normalized: IndicadorApiRow[] = arrayObjs
          .flatMap((obj: any) => toRowsFromObj(obj))
          .filter((x): x is IndicadorApiRow => !!x);

        // Si no encontró nada, no hacer nada
        if (!normalized.length) {
          return;
        }

        // Opciones para el <select> de Indicador
        if (onOptionsFromApi && mounted) {
          onOptionsFromApi(normalized);
        }

        // Autorrellenar el form con la primera fila
        const first = normalized[0];
        if (first && (first.entidad || first.indicador || first.accion || first.insumo)) {
          onImport({
            entidad: first.entidad,
            indicador: first.indicador,
            criterio: first.criterio === "" ? first.indicador : first.criterio,
            accion: first.accion,
            insumo: first.insumo,
          });
        }
      } catch (e) {
        // Sin fallback: dejar campos deshabilitados si hay error
      }
    };

    fetchReport();

    return () => {
      mounted = false;
    };
  }, [nombreEntidad, onOptionsFromApi]);

  
  return null;
}
