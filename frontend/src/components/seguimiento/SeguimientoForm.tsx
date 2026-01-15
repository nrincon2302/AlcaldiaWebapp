import React from "react";
import { FiInfo } from "react-icons/fi";

import { useAuth } from "../../context/AuthContext";
import { hasAuditorAccess } from "../../lib/auth";
import { uploadEvidence } from "../../lib/api";

type TipoAccion = "Preventiva" | "Correctiva" | "";
type InsumoMejora =
  | "Índice de Calidad a las Respuestas"
  | "Peticiones Vencidas en el Sistema"
  | "";
type IndicadorApiRow = {
  entidad?: string;
  indicador?: string;
  criterio?: string;
  accion?: string;
  insumo?: string;
};

type UnifiedFormValue = {
  nombre_entidad: string;
  enlace_entidad?: string | null;

  observacion_informe_calidad?: string | null;

  id?: number;
  plan_id?: number;
  insumo_mejora?: InsumoMejora | string | null;
  tipo_accion_mejora?: TipoAccion | string | null;
  accion_mejora_planteada?: string | null;
  descripcion_actividades?: string | null;
  evidencia_cumplimiento?: string | null;
  plan_descripcion_actividades?: string | null;
  plan_evidencia_cumplimiento?: string | null;
  fecha_inicio?: string | null;
  fecha_final?: string | null;
  seguimiento?: "Pendiente" | "En progreso" | "Finalizado" | string | null;

  observacion_calidad?: string | null;
  indicador?: string | null;
  criterio?: string | null;
  fecha_reporte?: string | null;

  estado?: string | null; // "Borrador" | "Pendiente" | ...
  
  aprobado_evaluador?: "Aprobado" | "Rechazado" | "" | null;
};

type Props = {
  value: UnifiedFormValue;
  onChange: <K extends keyof UnifiedFormValue>(key: K, value: UnifiedFormValue[K]) => void;
  readOnlyFields?: Record<string, boolean>;
  missingPlanKeys?: string[];

  topbar?: React.ReactNode;
  header?: React.ReactNode;
  focusRef?: React.RefObject<HTMLInputElement>;
  footer?: React.ReactNode;
  indicadoresApi?: IndicadorApiRow[];
  usedIndicadores?: string[];
  planActions?: React.ReactNode;
  onRequestNewPlanFromAction?: (accion: string) => void;
};

export default function SeguimientoForm({
  value,
  onChange,
  readOnlyFields,
  topbar,
  header,
  focusRef,
  footer,
  indicadoresApi,
  planActions,
  onRequestNewPlanFromAction,
  usedIndicadores,
  missingPlanKeys = [],
}: Props) {
  const ro = readOnlyFields ?? {};
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === "admin";
  const isEntidad = role === "entidad";
  const isAuditor = hasAuditorAccess(user as any);

  const anyUser = user as any;
  const entidadFromUser = (anyUser?.entidad || "").trim();
  const userEmail = (anyUser?.email || anyUser?.sub || "").trim().toLowerCase();

  const MAX_DESC_ACTIVIDADES = 300;
  const MAX_PLAN_EVIDENCIA = 300;
  const MAX_OBS_DDCS_SEG = 500;

  const MAX_UPLOAD_MB = 5;
  const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

  // ===== Reglas de edición a partir de rol y estado =====
  const canEditCamposEntidad = isAdmin || isEntidad;
  const canEditObsCalidad = isAdmin || isAuditor;

  const isSeguimientoBase = Boolean(value.plan_id);
  const estadoPlan = value.estado ?? "Pendiente";
  const isDraftEstado = estadoPlan === "Borrador";
  const isPlanAprobado = value.aprobado_evaluador === "Aprobado";
  const canEditObsCalidadPlan = isAdmin || isAuditor;

  
  const hasPlanPersisted = Boolean(value.plan_id);

  const hasAnySeguimientoPersisted =
    Boolean(value.id) || Boolean(value.fecha_reporte);

  const isPlanDevueltoEvaluador = value.aprobado_evaluador === "Rechazado";

  const entidadPuedeNuevaAccion = (isEntidad || isAdmin) && hasPlanPersisted;

  const evaluadorPuedeNuevaAccion = isAdmin && isPlanDevueltoEvaluador;

  const shouldShowNewActionButton =
    !!onRequestNewPlanFromAction &&
    (entidadPuedeNuevaAccion || evaluadorPuedeNuevaAccion);

  const newActionButtonLabel = isPlanDevueltoEvaluador
    ? "Agregar acción de mejora para ajustar según las observaciones del equipo evaluador"
    : "Nueva acción de mejora asociada a este indicador";

  const isSeguimientoVisible =
    isSeguimientoBase && isPlanAprobado;
  const estadoSeguimiento = (value.seguimiento as string) || "Pendiente";
  const updatedByEmail = ((value as any).updated_by_email || "").toString().trim().toLowerCase();

  const isBloqueadoEntidadSeguimiento =
    isEntidad && isSeguimientoVisible && estadoSeguimiento !== "Pendiente";

  const entidadYaEnvioActividades =
    isEntidad && Boolean((value as any)._saved_by_entidad);

  const isSeguimientoCerradoEntidad =
    isEntidad && (isBloqueadoEntidadSeguimiento || entidadYaEnvioActividades);

  const canEditCamposEntidadSeguimiento =
    (isAdmin || isEntidad) && !isSeguimientoCerradoEntidad;

  const canEditActividadesEntidad =
    canEditCamposEntidadSeguimiento && !entidadYaEnvioActividades;

  const canEditSeguimientoEstado = isAdmin || isAuditor;

  const canEditPlanBlock = canEditCamposEntidad && isDraftEstado;
  const canEditNombreEntidad = false;
  const canEditEnlaceEntidad = canEditCamposEntidad && isDraftEstado;

  const [eviUploading, setEviUploading] = React.useState(false);
  const [eviError, setEviError] = React.useState<string | null>(null);
  const [eviHelpOpen, setEviHelpOpen] = React.useState(false);
  const eviHelpRef = React.useRef<HTMLDivElement | null>(null);
  const hasIndicadoresApi = indicadoresApi && indicadoresApi.length > 0;

  // === Indicadores únicos ===
  const uniqueIndicadores = React.useMemo(() => {
    if (!indicadoresApi) return [];

    const map = new Map<string, IndicadorApiRow>();

    indicadoresApi.forEach((r) => {
      const key = (r.indicador ?? "").trim();
      if (key && !map.has(key)) {
        map.set(key, r);
      }
    });

    return Array.from(map.values());
  }, [indicadoresApi]);

  // === Criterios según el indicador seleccionado ===
  const criteriosForIndicador = React.useMemo(() => {
    if (!indicadoresApi || !value.indicador) return [];

    const rows = indicadoresApi.filter(
      (r) => (r.indicador ?? "").trim() === (value.indicador ?? "").trim()
    );

    return rows.map((r) =>
      r.criterio?.trim() ? r.criterio.trim() : r.indicador!.trim()
    );
  }, [indicadoresApi, value.indicador]);

  const canEditIndicador =
    hasIndicadoresApi &&
    !hasPlanPersisted && 
    canEditPlanBlock &&
    !ro["indicador"];

  const todayStr = React.useMemo(
    () => new Date().toISOString().slice(0, 10),
    []
  );

  const planFieldRefs: Record<string, React.RefObject<any>> = React.useMemo(
    () => ({
      enlace_entidad: React.createRef<HTMLInputElement>(),
      indicador: React.createRef<HTMLSelectElement | HTMLInputElement>(),
      insumo_mejora: React.createRef<HTMLSelectElement>(),
      criterio: React.createRef<HTMLSelectElement>(),
      tipo_accion_mejora: React.createRef<HTMLSelectElement>(),
      observacion_informe_calidad: React.createRef<HTMLTextAreaElement>(),
      accion_mejora_planteada: React.createRef<HTMLInputElement>(),
      plan_descripcion_actividades: React.createRef<HTMLTextAreaElement>(),
      plan_evidencia_cumplimiento: React.createRef<HTMLTextAreaElement>(),
      fecha_inicio: React.createRef<HTMLInputElement>(),
      fecha_final: React.createRef<HTMLInputElement>(),
    }),
    []
  );

  const hasPlanError = (key: string) => missingPlanKeys.includes(key);

  React.useEffect(() => {
    if (!missingPlanKeys.length) return;
    const order = [
      "enlace_entidad",
      "indicador",
      "insumo_mejora",
      "criterio",    
      "tipo_accion_mejora",
      "observacion_informe_calidad",
      "accion_mejora_planteada",
      "plan_descripcion_actividades",
      "plan_evidencia_cumplimiento",
      "fecha_inicio",
      "fecha_final",
    ];
    const next = order.find((k) => missingPlanKeys.includes(k));
    if (next && planFieldRefs[next]?.current) {
      planFieldRefs[next].current.focus?.();
      planFieldRefs[next].current.scrollIntoView?.({ behavior: "smooth", block: "center" });
    }
  }, [missingPlanKeys, planFieldRefs]);

  // nombre_entidad desde el usuario cuando el rol es entidad
  React.useEffect(() => {
    if (!entidadFromUser) return;

    const current = (value.nombre_entidad || "").trim();
    if (!current) {
      onChange("nombre_entidad", entidadFromUser);
    }
  }, [entidadFromUser, value.nombre_entidad, onChange]);

  // Fecha de reporte (solo cuando el bloque seguimiento está visible)
  React.useEffect(() => {
    if (isSeguimientoVisible && !value.fecha_reporte) {
      const created = (value as any).created_at?.slice(0, 10);
      const initial = created || todayStr;
      onChange("fecha_reporte" as any, initial);
    }
  }, [isSeguimientoVisible, value.fecha_reporte, (value as any).created_at, onChange, todayStr]);

  // Aviso inteligente para múltiples acciones
  const multiActionCount = React.useMemo(() => {
    const raw = value.accion_mejora_planteada ?? "";
    const parts = raw
      .split(/[\n;,.]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length;
  }, [value.accion_mejora_planteada]);

  const hasMultipleActions = multiActionCount >= 2 && isDraftEstado;

  const usedIndicadoresSet = React.useMemo(
    () => new Set((usedIndicadores ?? []).filter(Boolean)),
    [usedIndicadores]
  );

  // Cerrar tooltip de ayuda si se hace click fuera
  React.useEffect(() => {
    if (!eviHelpOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (eviHelpRef.current && !eviHelpRef.current.contains(event.target as Node)) {
        setEviHelpOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [eviHelpOpen]);

    // Auto-seleccionar el primer indicador disponible (no usado) en nuevos planes
    React.useEffect(() => {
      if (!hasIndicadoresApi || !indicadoresApi || indicadoresApi.length === 0) return;

      if (value.plan_id) return;

      const currentIndicador = (value.indicador || "").trim();

      if (currentIndicador && !usedIndicadoresSet.has(currentIndicador)) {
        return;
      }

      const nextRow = indicadoresApi.find((row) => {
        const val = (row.indicador || "").trim();
        if (!val) return false;
        return !usedIndicadoresSet.has(val);
      });

      if (!nextRow || !nextRow.indicador) return;

      const indicadorValue = nextRow.indicador.trim();

      onChange("indicador", indicadorValue);
      onChange("criterio", "");
      onChange("observacion_informe_calidad", "");
      if (!isEntidad && nextRow.entidad && !value.nombre_entidad) {
        onChange("nombre_entidad", nextRow.entidad);
      }
    }, [
      hasIndicadoresApi,
      indicadoresApi,
      usedIndicadoresSet,
      value.plan_id,
      value.indicador,
      value.criterio,
      value.observacion_informe_calidad,
      value.nombre_entidad,
      isEntidad,
      onChange,
    ]);



  return (
    <form className="space-y-3">
      {/* ===== Toolbar superior (ej. Borrar plan) ===== */}
      {topbar && (
        <div className="mb-3 flex items-center justify-end gap-2">
          {topbar}
        </div>
      )}

      {/* Nombre Entidad */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-center">
        <label className="text-sm font-medium text-gray-700 md:text-right md:pr-3">
          Nombre Entidad
        </label>
        <div className="md:col-span-2">
          <input
            ref={focusRef}
            className="w-full bg-gray-50 text-gray-700 cursor-not-allowed"
            value={value.nombre_entidad || ""}
            onChange={() => {}}
            required
            disabled
            readOnly
            aria-disabled
          />
        </div>
      </div>

      {/* Enlace de la entidad */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-center">
        <label className="text-sm font-medium text-gray-700 md:text-right md:pr-3">
          Enlace de la entidad (funcionario responsable)
        </label>
        <div className="md:col-span-2">
          <input
            value={value.enlace_entidad ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              const limpio = raw.replace(/[^a-zA-ZÁÉÍÓÚáéíóúÑñ\s]/g, "");
              onChange("enlace_entidad", limpio);
            }}
            disabled={!canEditEnlaceEntidad || !!ro["enlace_entidad"]}
            aria-disabled={!canEditEnlaceEntidad || !!ro["enlace_entidad"]}
            required={canEditEnlaceEntidad}
            ref={planFieldRefs.enlace_entidad}
            aria-invalid={hasPlanError("enlace_entidad")}
            className={`w-full ${hasPlanError("enlace_entidad") ? "border border-red-500 bg-red-50" : ""}`}
          />
        </div>
      </div>

      {/* ===== Plan de mejoramiento ===== */}
      <fieldset className="space-y-3 rounded-md border border-gray-300 p-3">
        <legend className="px-2 text-sm font-semibold text-gray-700">
          Plan de mejoramiento
          {isDraftEstado && (
            <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {estadoPlan}
            </span>
          )}
        </legend>
        
        {/* Indicador */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="self-center text-sm font-medium text-gray-700 md:text-right md:pr-3">
            Indicador
          </label>

          <div className="md:col-span-2">
            <select
              className={`w-full ${hasPlanError("indicador") ? "border border-red-500 bg-red-50" : ""}`}
              value={value.indicador ?? ""}
              onChange={(e) => {
                const indicadorValue = e.target.value.trim();

                // Actualizar indicador y limpiar campos dependientes
                onChange("indicador", indicadorValue);
                onChange("criterio", "");
                onChange("observacion_informe_calidad", "");
              }}
              disabled={!canEditIndicador}
              aria-disabled={!canEditIndicador}
              required={canEditPlanBlock}
              ref={planFieldRefs.indicador as any}
              aria-invalid={hasPlanError("indicador")}
            >
              {uniqueIndicadores.map((row, idx) => {
                const val = row.indicador ?? "";

                const isUsedAny = !!val && usedIndicadoresSet.has(val);
                const label = row.indicador ?? "(sin indicador)";
                const suffix = isUsedAny ? " (Ya en plan)" : "";

                return (
                  <option
                    key={idx}
                    value={val}
                    disabled={isUsedAny && !hasPlanPersisted}
                  >
                    {label}
                    {suffix}
                  </option>
                );
              })}
            </select>

            <p className="mt-1 text-xs text-gray-500">
              {hasPlanPersisted
                ? "El indicador de este plan ya está definido y no puede modificarse."
                : "Los indicadores que ya tienen un plan asociado aparecen deshabilitados para nuevos planes."}
            </p>
          </div>
        </div>

        {/* Criterio */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-center">
          <label className="text-sm font-medium text-gray-700 md:text-right md:pr-3">
            Criterio
          </label>

          <div className="md:col-span-2">
            <select
              className="w-full"
              value={value.criterio ?? ""}
              onChange={(e) => {
                const criterio = e.target.value.trim();
                onChange("criterio", criterio);

                // Buscar la acción exacta de este indicador+criterio
                const row = indicadoresApi?.find((r) => {
                  const crit = r.criterio?.trim() || r.indicador?.trim();
                  return (
                    (r.indicador ?? "").trim() === (value.indicador ?? "").trim() &&
                    crit === criterio
                  );
                });

                if (row?.accion) {
                  onChange("observacion_informe_calidad", row.accion);
                }
              }}
              disabled={!canEditPlanBlock}
              required={canEditPlanBlock}
            >
              <option value="">-- Selecciona --</option>
              {criteriosForIndicador.map((c, i) => (
                <option key={i} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tipo de acción de mejora */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-center">
          <label className="text-sm font-medium text-gray-700 md:text-right md:pr-3">
            Tipo de acción de mejora
          </label>
          <div className="md:col-span-2">
            <select
              className={`w-full ${hasPlanError("tipo_accion_mejora") ? "border border-red-500 bg-red-50" : ""}`}
              value={value.tipo_accion_mejora ?? ""}
              onChange={(e) => onChange("tipo_accion_mejora", e.target.value as TipoAccion)}
              disabled={!canEditPlanBlock || !!ro["tipo_accion_mejora"]}
              aria-disabled={!canEditPlanBlock || !!ro["tipo_accion_mejora"]}
              required={canEditPlanBlock}
              ref={planFieldRefs.tipo_accion_mejora as any}
              aria-invalid={hasPlanError("tipo_accion_mejora")}
            >
              <option value="">-- Selecciona --</option>
              <option>Preventiva</option>
              <option>Correctiva</option>
            </select>
          </div>
        </div>

        {/* Acción recomendada */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="self-center text-sm font-medium text-gray-700 md:text-right md:pr-3">
            Acción recomendada
          </label>
          <div className="md:col-span-2">
            <textarea
              className={`w-full min-h-24 ${hasPlanError("observacion_informe_calidad") ? "border border-red-500 bg-red-50" : ""}`}
              value={value.observacion_informe_calidad ?? ""}
              onChange={(e) =>
                onChange("observacion_informe_calidad", e.target.value)
              }
              disabled={!canEditPlanBlock || !!ro["observacion_informe_calidad"]}
              aria-disabled={
                !canEditPlanBlock || !!ro["observacion_informe_calidad"]
              }
              required={canEditPlanBlock}
              ref={planFieldRefs.observacion_informe_calidad as any}
              aria-invalid={hasPlanError("observacion_informe_calidad")}
            />
          </div>
        </div>

        {/* Acción de mejora planteada (PLAN) */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="self-center text-sm font-medium text-gray-700 md:text-right md:pr-3">
            Acción de mejora planteada
          </label>

          <div className="md:col-span-2 space-y-2">
            <input
              className={`w-full ${hasPlanError("accion_mejora_planteada") ? "border border-red-500 bg-red-50" : ""}`}
              placeholder="Escribe la(s) acción(es) de mejora, separadas por ',' ';' '.'"
              value={value.accion_mejora_planteada ?? ""}
              onChange={(e) => onChange("accion_mejora_planteada", e.target.value)}
              disabled={!canEditPlanBlock || !!ro["accion_mejora_planteada"]}
              aria-disabled={!canEditPlanBlock || !!ro["accion_mejora_planteada"]}
              required={canEditPlanBlock}
              ref={planFieldRefs.accion_mejora_planteada}
              aria-invalid={hasPlanError("accion_mejora_planteada")}
            />

            {hasMultipleActions && (
              <div className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <p className="font-semibold">Hemos detectado más de una posible acción.</p>
                <p>
                  Considera registrar cada acción como un plan separado antes de enviar.
                </p>
              </div>
            )}

          </div>
        </div>

        {/* Descripción de las actividades (PLAN) */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="self-center text-sm font-medium text-gray-700 md:text-right md:pr-3">
            Descripción de las actividades
          </label>
          <div className="md:col-span-2">
            <textarea
              className={`w-full min-h-28 ${hasPlanError("plan_descripcion_actividades") ? "border border-red-500 bg-red-50" : ""}`}
              value={value.plan_descripcion_actividades ?? ""}
              onChange={(e) =>
                onChange("plan_descripcion_actividades", e.target.value)
              }
              disabled={!canEditPlanBlock || !!ro["plan_descripcion_actividades"]}
              aria-disabled={!canEditPlanBlock || !!ro["plan_descripcion_actividades"]}
              maxLength={MAX_DESC_ACTIVIDADES}
              required={canEditPlanBlock}
              ref={planFieldRefs.plan_descripcion_actividades as any}
              aria-invalid={hasPlanError("plan_descripcion_actividades")}
            />
            <p className="mt-1 text-xs text-gray-500 text-right">
              {(value.plan_descripcion_actividades?.length ?? 0)}/{MAX_DESC_ACTIVIDADES} caracteres
            </p>
          </div>
        </div>

        {/* Descripción de la evidencia de cumplimiento de la acción (PLAN) */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="self-center text-sm font-medium text-gray-700 md:text-right md:pr-3">
            Descripción de la evidencia de cumplimiento de la acción
          </label>
          <div className="md:col-span-2">
            <textarea
              className={`w-full min-h-28 ${hasPlanError("plan_evidencia_cumplimiento") ? "border border-red-500 bg-red-50" : ""}`}
              value={value.plan_evidencia_cumplimiento ?? ""}
              onChange={(e) =>
                onChange("plan_evidencia_cumplimiento", e.target.value)
              }
              disabled={!canEditPlanBlock || !!ro["plan_evidencia_cumplimiento"]}
              aria-disabled={!canEditPlanBlock || !!ro["plan_evidencia_cumplimiento"]}
              maxLength={MAX_PLAN_EVIDENCIA}
              required={canEditPlanBlock}
              ref={planFieldRefs.plan_evidencia_cumplimiento as any}
              aria-invalid={hasPlanError("plan_evidencia_cumplimiento")}
            />
            <div className="mt-1 flex justify-between text-xs text-gray-500">
              <span>
                Describe brevemente las evidencias de cumplimiento previstas para esta acción.
              </span>
              <span>
                {(value.plan_evidencia_cumplimiento?.length ?? 0)}/{MAX_PLAN_EVIDENCIA} caracteres
              </span>
            </div>
          </div>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-center">
          <label className="text-sm font-medium text-gray-700 md:text-right md:pr-3">
            Fecha Inicio
          </label>
          <div className="md:col-span-2">
            <input
              type="date"
              className={`w-full ${hasPlanError("fecha_inicio") ? "border border-red-500 bg-red-50" : ""}`}
              required
              value={value.fecha_inicio ?? ""}
              onChange={(e) => {
                const nuevaInicio = e.target.value;
                onChange("fecha_inicio", nuevaInicio);
                if (value.fecha_final && value.fecha_final < nuevaInicio) {
                  onChange("fecha_final", nuevaInicio);
                }
              }}
              disabled={!canEditPlanBlock || !!ro["fecha_inicio"]}
              aria-disabled={!canEditPlanBlock || !!ro["fecha_inicio"]}
              ref={planFieldRefs.fecha_inicio}
              aria-invalid={hasPlanError("fecha_inicio")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-center">
          <label className="text-sm font-medium text-gray-700 md:text-right md:pr-3">
            Fecha Final
          </label>
          <div className="md:col-span-2">
            <input
              type="date"
              className={`w-full ${hasPlanError("fecha_final") ? "border border-red-500 bg-red-50" : ""}`}
              required={canEditPlanBlock}
              value={value.fecha_final ?? ""}
              onChange={(e) => onChange("fecha_final", e.target.value)}
              min={value.fecha_inicio || undefined}
              disabled={!canEditPlanBlock || !!ro["fecha_final"]}
              aria-disabled={!canEditPlanBlock || !!ro["fecha_final"]}
              ref={planFieldRefs.fecha_final}
              aria-invalid={hasPlanError("fecha_final")}
            />
          </div>
        </div>
        
        {/* Resultado evaluación (solo evaluador) */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-center">
          <label className="text-sm font-medium text-gray-700 md:text-right md:pr-3">
            Resultado de la evaluación
            </label>
            <div className="md:col-span-2">
              <select
              className="w-full"
              value={value.aprobado_evaluador ?? ""}
              onChange={(e) =>
                onChange("aprobado_evaluador", e.target.value as any)
              }
              disabled={!canEditObsCalidadPlan || !!ro["aprobado_evaluador"]}
              aria-disabled={!canEditObsCalidadPlan}
              >
                <option value="">-- Selecciona --</option>
                <option value="Aprobado">Plan habilitado para seguimiento</option>
                <option value="Rechazado">Plan devuleto para ajustes</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Solo el equipo evaluador puede modificar este campo.
                  Si está <strong>Aprobado</strong>, se habilita el seguimiento de la acción.
                  </p>
                  </div>
                  </div>

        {/* Observación del equipo de la DDCS (PLAN) */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="self-center text-sm font-medium text-gray-700 md:text-right md:pr-3">
            Observación del equipo de la DDCS
          </label>
          <div className="md:col-span-2">
            <textarea
              className={`w-full min-h-24 ${
                !canEditObsCalidadPlan || !!ro["plan_observacion_calidad"]
                  ? "bg-gray-50 opacity-60"
                  : ""
              }`}
              value={(value as any).plan_observacion_calidad ?? ""}
              onChange={(e) => onChange("plan_observacion_calidad" as any, e.target.value)}
              disabled={!canEditObsCalidadPlan || !!ro["plan_observacion_calidad"]}
              aria-disabled={!canEditObsCalidadPlan || !!ro["observacion_calidad"]}
            />
            <p className="mt-1 text-xs text-gray-500">
              Esta observación la registra el equipo de la DDCS después de enviar el registro.
            </p>
          </div>
        </div>
      </fieldset>
      
      {shouldShowNewActionButton && (
        <div className="mt-4 flex justify-start">
          <button
            type="button"
            onClick={() =>
              onRequestNewPlanFromAction?.(
                (value.accion_mejora_planteada ?? "").trim()
              )
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-800"
          >
            <span className="text-base leading-none">＋</span>
            <span>{newActionButtonLabel}</span>
          </button>
        </div>
      )}       

      {planActions && (
        <div className="mt-4 flex justify-end gap-2">
          {planActions}
        </div>
      )}

      {/* ===== Seguimiento a las acciones del Plan de mejoramiento ===== */}
      {isSeguimientoVisible && (
        <fieldset
          id="seguimiento-section"
          className="mt-4 space-y-3 rounded-md border border-gray-300 p-3"
        >
          {/* Tabs de seguimientos */}
        <div className="mb-4">{header}</div>

          <legend className="px-2 text-sm font-semibold text-gray-700">
            Seguimiento a las acciones del Plan de mejoramiento
          </legend>

          {/* Fecha de reporte */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-center">
            <label className="text-sm font-medium text-gray-700 md:text-right md:pr-3">
              Fecha de reporte
            </label>
            <div className="md:col-span-2">
              <input
                type="date"
                className="w-full"
                value={value.fecha_reporte ?? ""}
                min={(value as any).created_at?.slice(0, 10) ?? todayStr}
                max={todayStr}
                onChange={(e) => {
                  const v = e.target.value;
                  const min = (value as any).created_at?.slice(0, 10) ?? todayStr;
                  if (v && (v < min || v > todayStr)) return;
                  onChange("fecha_reporte" as any, v);
                }}
                disabled={!canEditCamposEntidadSeguimiento || !!ro["fecha_reporte"]}
                aria-disabled={!canEditCamposEntidadSeguimiento || !!ro["fecha_reporte"]}
              />
            </div>
          </div>

          {/* Nombre Entidad (solo lectura) */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-center">
            <label className="text-sm font-medium text-gray-700 md:text-right md:pr-3">
              Nombre Entidad
            </label>
            <div className="md:col-span-2">
              <input
                className="w-full bg-gray-50"
                value={value.nombre_entidad || ""}
                readOnly
                disabled
                aria-disabled
              />
            </div>
          </div>

          {/* Enlace entidad (solo lectura) */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-center">
            <label className="text-sm font-medium text-gray-700 md:text-right md:pr-3">
              Enlace entidad (funcionario responsable)
            </label>
            <div className="md:col-span-2">
              <input
                className="w-full bg-gray-50"
                value={value.enlace_entidad ?? ""}
                readOnly
                disabled
                aria-disabled
              />
            </div>
          </div>

          {/* Acción de mejora planteada (como referencia, solo lectura) */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="self-center text-sm font-medium text-gray-700 md:text-right md:pr-3">
              Acción de mejora planteada (Plan)
            </label>
            <div className="md:col-span-2">
              <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-800">
                {value.accion_mejora_planteada || "Sin información"}
              </p>
            </div>
          </div>

          {/* Actividades realizadas en el periodo */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="self-center text-sm font-medium text-gray-700 md:text-right md:pr-3">
              Actividades realizadas en el periodo
            </label>
            <div className="md:col-span-2">
              <textarea
                className="w-full min-h-28"
                value={value.descripcion_actividades ?? ""}
                onChange={(e) => onChange("descripcion_actividades", e.target.value)}
                disabled={!canEditActividadesEntidad || !!ro["descripcion_actividades"]}
                aria-disabled={!canEditActividadesEntidad || !!ro["descripcion_actividades"]}
                maxLength={MAX_DESC_ACTIVIDADES}
              />
              <p className="mt-1 text-xs text-gray-500 text-right">
                {(value.descripcion_actividades?.length ?? 0)}/{MAX_DESC_ACTIVIDADES} caracteres
              </p>
            </div>
          </div>

          {/* Evidencias de cumplimiento de la acción (archivo) */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-start">
            <label className="text-sm font-medium text-gray-700 md:text-right md:pr-3">
              <span className="flex items-center gap-2">
                Evidencias de cumplimiento de la acción
              </span>
            </label>
            <div className="md:col-span-2 space-y-2">
              {(() => {
                const raw = value.evidencia_cumplimiento ?? "";
                const isUrl =
                  typeof raw === "string" &&
                  (raw.startsWith("http://") || raw.startsWith("https://"));

                if (!isUrl) {
                  return (
                    <>
                      <div ref={eviHelpRef} className="relative flex items-center gap-2">
                        <input
                          type="file"
                          accept={[
                            // Imágenes
                            ".jpg",
                            ".jpeg",
                            ".png",
                            ".gif",
                            "image/*",
                            // Documentos
                            ".pdf",
                            "application/pdf",
                            // Excel / CSV
                            ".xls",
                            ".xlsx",
                            ".csv",
                            "application/vnd.ms-excel",
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            "text/csv",
                            // Comprimidos
                            ".zip",
                            ".rar",
                            ".7z",
                            "application/zip",
                            "application/x-zip-compressed",
                            "application/x-rar-compressed",
                            "application/x-7z-compressed",
                          ].join(",")}
                          disabled={
                            !canEditCamposEntidadSeguimiento ||
                            !!ro["evidencia_cumplimiento"] ||
                            eviUploading
                          }
                          aria-disabled={
                            !canEditCamposEntidadSeguimiento ||
                            !!ro["evidencia_cumplimiento"] ||
                            eviUploading
                          }
                          aria-describedby="evidencia-help"
                          onChange={async (e) => {
                            const inputEl = e.currentTarget;
                            const file = inputEl.files?.[0];
                            if (!file) return;

                            if (file.size > MAX_UPLOAD_BYTES) {
                              setEviError(
                                `El archivo supera ${MAX_UPLOAD_MB} MB. Reduce el tamaño y vuelve a intentar.`
                              );
                              inputEl.value = "";
                              return;
                            }
                            try {
                              setEviError(null);
                              setEviUploading(true);
                              const { href } = await uploadEvidence(file);
                              onChange("evidencia_cumplimiento", href as any);
                            } catch (err: any) {
                              setEviError(err?.message || "Error subiendo evidencia");
                            } finally {
                              setEviUploading(false);
                              try {
                                if (inputEl) inputEl.value = "";
                              } catch {}
                            }
                          }}
                          className="block w-full text-sm text-gray-900 file:mr-4 file:rounded-xl file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold hover:file:bg-gray-200 disabled:opacity-60"
                        />
                        <button
                          type="button"
                          className="rounded-full border-0 bg-transparent p-1 text-gray-500 transition hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          title={`Formatos: imágenes (JPG, PNG), PDF, Excel (XLS/XLSX/CSV) y comprimidos (ZIP, RAR, 7Z). Máximo ${MAX_UPLOAD_MB} MB. Para múltiples archivos, súbelos comprimidos.`}
                          aria-label={`Formatos permitidos y tamaño máximo de evidencia. Máximo ${MAX_UPLOAD_MB} MB.`}
                          onClick={() => setEviHelpOpen((v) => !v)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setEviHelpOpen((v) => !v);
                            }
                          }}
                        >
                          <FiInfo className="h-4 w-4" />
                        </button>
                        {eviHelpOpen && (
                          <div className="absolute right-0 top-full z-10 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-lg">
                            <p className="mt-1">
                             <b>Formatos:</b> imágenes (JPG, PNG), PDF, Excel (XLS/XLSX/CSV) y comprimidos (ZIP, RAR, 7Z).
                            </p>
                            <p className="mt-1">
                              <b>Tamaño máximo: {MAX_UPLOAD_MB} MB.</b> Si tienes múltiples archivos, súbelos en un comprimido.
                            </p>
                          </div>
                        )}
                      </div>
                      <span id="evidencia-help" className="sr-only">
                        Formatos permitidos: imágenes JPG, PNG; PDF; Excel XLS, XLSX, CSV; y comprimidos ZIP, RAR, 7Z. Tamaño máximo {MAX_UPLOAD_MB} megabytes. Para múltiples evidencias, súbelas en un archivo comprimido.
                      </span>
                      {eviUploading && (
                        <p className="text-xs text-gray-500">Subiendo evidencia…</p>
                      )}
                      {eviError && (
                        <p className="text-xs text-red-600">{eviError}</p>
                      )}
                    </>
                  );
                }

                return (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <a
                      href={raw}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm font-medium underline"
                    >
                      Ver evidencia
                    </a>
                    {(isAdmin || isEntidad) &&
                      canEditCamposEntidadSeguimiento &&
                      !ro["evidencia_cumplimiento"] && (
                        <button
                          type="button"
                          onClick={() => onChange("evidencia_cumplimiento", "")}
                          className="rounded-xl bg-red-50 px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-100"
                        >
                          Quitar
                        </button>
                      )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Estado de seguimiento */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-center">
            <label className="text-sm font-medium text-gray-700 md:text-right md:pr-3">
              Seguimiento
            </label>
            <div className="md:col-span-2">
              <select
                className="w-full"
                value={value.seguimiento ?? "Pendiente"}
                onChange={(e) => onChange("seguimiento", e.target.value as any)}
                disabled={!canEditSeguimientoEstado || !!ro["seguimiento"]}
                aria-disabled={!canEditSeguimientoEstado || !!ro["seguimiento"]}
              >
                <option>Pendiente</option>
                <option>En progreso</option>
                <option>Finalizado</option>
              </select>
            </div>
          </div>

          {/* Observación del equipo de la DDCS (editable por auditor/admin) */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="self-center text-sm font-medium text-gray-700 md:text-right md:pr-3">
              Observación del equipo de la DDCS
            </label>
            <div className="md:col-span-2">
              <textarea
                name="observacion_calidad"
                value={value.observacion_calidad ?? ""}
                onChange={(e) => onChange("observacion_calidad", e.target.value)}
                disabled={!canEditObsCalidad || !!ro["observacion_calidad"]}
                aria-disabled={!canEditObsCalidad || !!ro["observacion_calidad"]}
                className={`w-full min-h-24 ${
                  (!canEditObsCalidad || !!ro["observacion_calidad"])
                    ? "opacity-60"
                    : ""
                }`}
                maxLength={MAX_OBS_DDCS_SEG}
              />
              <p className="mt-1 text-xs text-gray-500 text-right">
                {(value.observacion_calidad?.length ?? 0)}/{MAX_OBS_DDCS_SEG} caracteres
              </p>
            </div>
          </div>
        </fieldset>
      )}

      {footer && (
        <div className="mt-4 border-t border-gray-200 pt-4">
          {footer}
        </div>
      )}
    </form>
  );
}
