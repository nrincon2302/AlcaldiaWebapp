import React from "react";
import Header from "../components/Header";
import PageBg from "../components/PageBackground";
import { FaEraser } from "react-icons/fa";
import SeguimientoForm from "../components/seguimiento/SeguimientoForm";
import { useSeguimientos, type Plan, type Seguimiento } from "../components/seguimiento/useSeguimientos";
import { useAuth } from "../context/AuthContext";
import { FiSend, FiAlertCircle } from "react-icons/fi";
import { hasAuditorAccess } from "../lib/auth";

import SeguimientoTabs from "../components/seguimiento/SeguimientoTabs";
import PlanesSidebar from "../components/seguimiento/PlanesSidebar";
import SeguimientosTimeline from "../components/seguimiento/SeguimientosTimeline";
import IndicadoresAutoLoader from "../components/seguimiento/IndicadoresAutoLoader";

import {
  exportAllSeguimientosCSV,
  exportAllSeguimientosXLSX,
  exportAllSeguimientosPDF,
} from "../components/seguimiento/exporters";

// ─────────────────────────────────────────────────────────────
// Botonera de exportación
// ─────────────────────────────────────────────────────────────
function ExportPlanButtons({
  hasData,
  loadAllSeguimientos,
  currentPlanData,
}: {
  hasData: boolean;
  loadAllSeguimientos: () => Promise<{ plan: Plan; seguimientos: Seguimiento[] }[]>;
  currentPlanData: { plan: Plan; seguimientos: Seguimiento[] } | null;
}) {
  const [loadingAll, setLoadingAll] = React.useState(false);
  const [loadingCurrent, setLoadingCurrent] = React.useState(false);

  async function handleExportAll(kind: "csv" | "xlsx" | "pdf") {
    try {
      setLoadingAll(true);
      const groups = await loadAllSeguimientos();
      if (!groups.length) {
        alert("No hay registros para exportar.");
        return;
      }
      if (kind === "csv") exportAllSeguimientosCSV(groups);
      else if (kind === "xlsx") await exportAllSeguimientosXLSX(groups);
      else await exportAllSeguimientosPDF(groups);
    } catch (e: any) {
      console.error("Exportación fallida", e);
      alert(e?.message ?? "Error exportando.");
    } finally {
      setLoadingAll(false);
    }
  }

  async function handleExportCurrent(kind: "csv" | "xlsx" | "pdf") {
    if (!currentPlanData) return;
    try {
      setLoadingCurrent(true);
      const groups = [currentPlanData]; 
      if (kind === "csv") exportAllSeguimientosCSV(groups);
      else if (kind === "xlsx") await exportAllSeguimientosXLSX(groups);
      else await exportAllSeguimientosPDF(groups);
    } catch (e: any) {
      console.error("Exportación actual fallida", e);
      alert("Error exportando plan actual.");
    } finally {
      setLoadingCurrent(false);
    }
  }

  const disabledAll = loadingAll || !hasData;
  const disabledCurrent = loadingCurrent || !currentPlanData;

  return (
    <div className="flex flex-col items-end gap-1 ml-4">
      {currentPlanData && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase font-bold text-blue-700 mr-1">Esta acción:</span>
          <div className="flex rounded-md shadow-sm" role="group">
            <button type="button" onClick={() => handleExportCurrent("csv")} disabled={disabledCurrent} className="px-2 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-l-lg hover:bg-blue-50">CSV</button>
            <button type="button" onClick={() => handleExportCurrent("xlsx")} disabled={disabledCurrent} className="px-2 py-1 text-xs font-medium text-blue-700 bg-white border-t border-b border-blue-200 hover:bg-blue-50">XLSX</button>
            <button type="button" onClick={() => handleExportCurrent("pdf")} disabled={disabledCurrent} className="px-2 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-r-lg hover:bg-blue-50">PDF</button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase font-bold text-gray-500 mr-1">Todos:</span>
        <div className="flex rounded-md shadow-sm" role="group">
          <button type="button" onClick={() => handleExportAll("csv")} disabled={disabledAll} className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-l-lg hover:bg-gray-50">{loadingAll ? "..." : "CSV"}</button>
          <button type="button" onClick={() => handleExportAll("xlsx")} disabled={disabledAll} className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border-t border-b border-gray-200 hover:bg-gray-50">{loadingAll ? "..." : "XLSX"}</button>
          <button type="button" onClick={() => handleExportAll("pdf")} disabled={disabledAll} className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-r-lg hover:bg-gray-50">{loadingAll ? "..." : "PDF"}</button>
        </div>
      </div>
    </div>
  );
}

export default function SeguimientoPage() {
  const {
    plans, activePlanId, setActive, children,
    current, updateLocal, resetCurrent, startNew, saveCurrent,
    removeById, addChildImmediate, removePlan,
    isDuplicableCurrent, pagerIndex, setActiveChild,
    createdOrder, toggleCreatedOrder,
    importSeguimientoFields, createPlanFromAction, 
    usedIndicadores, loadSeguimientosForExport, planMissingKeys,
  } = useSeguimientos();
  
  type IndicadorApiRow = { entidad: string | undefined; indicador: string | undefined; accion: string | undefined; };
  const [indicadoresApi, setIndicadoresApi] = React.useState<IndicadorApiRow[]>([]);

  const { user } = useAuth();
  const role = user?.role;
  const isEntidad = role === "entidad";
  const canAudit = hasAuditorAccess(user as any);
  const isAuditorRole = role === "auditor";
  const isAdmin   = role === "admin";

  const currentAny = current as any;
  const isSeguimientoActual = Boolean(currentAny?.plan_id);
  const estadoSeguimientoActual = (currentAny?.seguimiento as string) || "Pendiente";
  const currentSeguimientoId = isSeguimientoActual ? currentAny?.id : undefined;
  const estadoPlanActual: string | null = (currentAny?.estado as string) ?? null; 
  
  const activePlan = React.useMemo(() => plans.find(p => p.id === activePlanId) ?? null, [plans, activePlanId]);

  const isPlanEnBorrador = !activePlan?.estado || activePlan?.estado === "Borrador";
  const aprobadoEvaluador = (currentAny?.aprobado_evaluador as string) || "";
  const isPlanDevuelto = aprobadoEvaluador === "Rechazado" || estadoPlanActual === "Plan devuelto para ajustes";
  const hasSeguimientoActual = Boolean(currentAny?.id) || Boolean(currentAny?.fecha_reporte);
  const isDraftPlan = estadoPlanActual === "Borrador" && !hasSeguimientoActual;
  
  const isPlanHabilitado = (estadoPlanActual || "").toLowerCase() === "plan habilitado para seguimiento";
  const isPlanAprobado = (currentAny?.aprobado_evaluador as string) === "Aprobado" || isPlanHabilitado; 
  const isSeguimientoVisible = Boolean(currentAny?.plan_id) && isPlanAprobado;

  // Lógica de bloqueo global por "Finalizado"
  const existeSeguimientoFinalizado = React.useMemo(() => {
    return children.some(child => child.seguimiento === "Finalizado");
  }, [children]);

  const bloqueoGlobalPorFinalizado = existeSeguimientoFinalizado && !isAdmin;

  // <--- 1. MODIFICACIÓN: Bloqueo si hay observación (aplica a Entidad Y Evaluador) --->
  const existeObservacionCalidad = !!(currentAny?.observacion_calidad || "").trim();
  
  // Bloqueo estricto para la entidad (no puede editar nada)
  const bloqueoTotalEntidad = isEntidad && existeObservacionCalidad;

  // Bloqueo del selector de estado (aplica a ambos si ya se devolvió)
  const bloqueoSelectorEstado = existeObservacionCalidad;

  const entidadNoPuedeEnviar =
    (isEntidad && isSeguimientoActual && estadoSeguimientoActual !== "Pendiente") ||
    bloqueoGlobalPorFinalizado ||
    bloqueoTotalEntidad; 

  const activeChild = children[pagerIndex] ?? null;
  const activeChildId = activeChild?.id;
  
  const puedeAjustarSeguimiento =
    !bloqueoGlobalPorFinalizado &&
    isEntidad && !!activeChildId && !!(activeChild?.observacion_calidad || "").trim();

  const canDeleteChild = !!currentSeguimientoId && isAdmin;
  const canDeletePlan = !!activePlanId && (isAdmin || (isEntidad && isPlanEnBorrador));
  const canResetForm = isAdmin || isEntidad;
  
  const canAddChild =
    !bloqueoGlobalPorFinalizado &&
    (isAdmin || isEntidad) &&
    Boolean(activePlanId || (current as any)?.nombre_entidad?.trim());

  const auditorYaEvaluoPlan = 
    canAudit && 
    (activePlan?.aprobado_evaluador === "Aprobado" || activePlan?.aprobado_evaluador === "Rechazado");

  const childOriginal = children.find(c => c.id === activeChildId);
  const auditorYaEvaluoSeguimiento = 
    canAudit && 
    !!childOriginal?.observacion_calidad && 
    childOriginal.observacion_calidad.trim().length > 0;

  const [sending, setSending] = React.useState(false);
  async function handleEnviar() {
    try {
      setSending(true);
      const currentAny = current as any;
      const isDraftPlan = currentAny?.estado === "Borrador";

      if (isEntidad || isAdmin) {
        const overrides: any = {};
        if (isDraftPlan) overrides.estado = "Pendiente";

        const saved = await saveCurrent(overrides);
        if (!saved) return;

        if (isDraftPlan) {
          alert("Acción de mejora enviada con éxito.");
        } else {
          alert("Seguimiento enviado con éxito.");
        }
      } else {
        const saved = await saveCurrent({} as any);
        if (!saved) return;
        alert("Seguimiento guardado.");
      }
    } finally {
      setSending(false);
    }
  }

  const [mobileTab, setMobileTab] = React.useState<"form" | "history">(() => (children.length ? "history" : "form"));
  const formFocusRef = React.useRef<HTMLInputElement>(null);
  
  function focusForm() {
    setMobileTab("form");
    requestAnimationFrame(() => {
      const section = document.getElementById("seguimiento-section");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "center" });
        const firstInput = section.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select");
        firstInput?.focus();
      }
    });
  }

  const handleNewPlanFromAction = async (_accionRaw: string) => {
    const curr = current as any;
    const indicadorBase = (curr?.indicador || "").trim();
    const criterioBase = ""; 

    const tienePlan = Boolean(curr?.plan_id);
    const puedeComoEntidad = (isEntidad || isAdmin) && tienePlan;
    const aprobadoEvaluador = (curr?.aprobado_evaluador as string) || "";
    const isPlanDevuelto = aprobadoEvaluador === "Rechazado" || (curr?.estado as string) === "Plan devuelto para ajustes";
    const puedeComoEvaluador = canAudit && isPlanDevuelto;

    if (!puedeComoEntidad && !puedeComoEvaluador) {
      alert("Solo se puede crear una nueva acción de mejora asociada a este indicador después de enviar el plan...");
      return;
    }
    if (!indicadorBase) {
      alert("Primero diligencia el campo Indicador.");
      return;
    }
    try {
      await createPlanFromAction("", indicadorBase, criterioBase); 
      requestAnimationFrame(() => {
        const main = document.querySelector("main");
        main?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e: any) {
      alert(e?.message ?? "No se pudo crear.");
    }
  };
  
  React.useEffect(() => {
    setMobileTab(children.length ? "history" : "form");
  }, [activePlanId, children.length]);

  return (
    <PageBg>
      <Header />
      <main className="mx-auto max-w-6xl p-4">
        {/* Toolbar superior */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold">Seguimiento</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`rounded-lg px-3 py-1.5 text-sm font-medium text-gray-800  ${!isAuditorRole ? "bg-white hover:bg-gray-100" : "bg-gray-400 text-white cursor-not-allowed"}`}
              onClick={() => startNew()}
              disabled={isAuditorRole}
            >
              Nuevo registro
            </button>
            <button
              className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white ${canDeletePlan ? "bg-rose-700 hover:bg-rose-800" : "bg-rose-300 cursor-not-allowed"}`}
              type="button"
              disabled={!canDeletePlan}
              onClick={() => {
                if (!canDeletePlan) return;
                if (confirm("Se eliminará esta acción de mejora")) removePlan(activePlanId);
              }}
            >
              Borrar registro
            </button>
            <ExportPlanButtons
              hasData={plans.length > 0}
              loadAllSeguimientos={loadSeguimientosForExport}
              currentPlanData={activePlan ? { plan: activePlan, seguimientos: children } : null}
            />
          </div>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <PlanesSidebar
              plans={plans}
              activePlanId={activePlanId}
              onSelect={(id) => setActive(id)}
              count={plans.length}
              createdOrder={createdOrder}
              toggleCreatedOrder={toggleCreatedOrder}
              activeEstado={estadoPlanActual}
              activeChildrenCount={children.length}
            />
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 lg:hidden">
              <button onClick={() => setMobileTab("form")} className={`rounded-lg px-3 py-2 text-sm font-medium ${mobileTab === "form" ? "bg-white shadow text-gray-900" : "text-gray-600"}`}>Formulario</button>
              <button onClick={() => setMobileTab("history")} className={`rounded-lg px-3 py-2 text-sm font-medium ${mobileTab === "history" ? "bg-white shadow text-gray-900" : "text-gray-600"}`}>Historial ({children.length})</button>
            </div>

            {bloqueoGlobalPorFinalizado && (
              <div className="mb-2 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0"><FiAlertCircle className="h-5 w-5 text-blue-400" /></div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">Acción de mejora finalizada</h3>
                    <div className="mt-2 text-sm text-blue-700"><p>Ya existe un seguimiento marcado como <strong>Finalizado</strong>. La acción de mejora se considera cerrada.</p></div>
                  </div>
                </div>
              </div>
            )}

            <section className={`card ${mobileTab === "form" ? "block" : "hidden lg:block"}`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Acción de Mejora</h2>
                {canResetForm && (
                  <button type="button" className="btn-outline" onClick={resetCurrent} title="Limpiar formulario actual"><FaEraser /> <span className="hidden sm:inline">Limpiar</span></button>
                )}
              </div>
              <IndicadoresAutoLoader onImport={importSeguimientoFields} onOptionsFromApi={setIndicadoresApi} nombreEntidad={(current as any)?.nombre_entidad || user?.entidad} />

              <SeguimientoForm
                value={current as any}
                onChange={updateLocal as any}
                // <--- 2. APLICACIÓN DE LOS BLOQUEOS --->
                readOnlyFields={{
                  observacion_calidad: isEntidad || auditorYaEvaluoSeguimiento || bloqueoGlobalPorFinalizado,
                  aprobado_evaluador: auditorYaEvaluoPlan || bloqueoGlobalPorFinalizado,
                  plan_observacion_calidad: auditorYaEvaluoPlan || bloqueoGlobalPorFinalizado,
                  
                  // La entidad no puede editar contenido si fue devuelto
                  descripcion_actividades: bloqueoGlobalPorFinalizado || bloqueoTotalEntidad,
                  evidencia_cumplimiento: bloqueoGlobalPorFinalizado || bloqueoTotalEntidad,
                  fecha_reporte: bloqueoGlobalPorFinalizado || bloqueoTotalEntidad,
                  
                  // NADIE puede cambiar el estado si ya tiene observación (se considera devuelto/histórico)
                  seguimiento: bloqueoGlobalPorFinalizado || bloqueoSelectorEstado,
                }}
                focusRef={formFocusRef}
                indicadoresApi={indicadoresApi}   
                onRequestNewPlanFromAction={handleNewPlanFromAction}
                usedIndicadores={usedIndicadores}  
                missingPlanKeys={planMissingKeys}
                header={
                  isPlanAprobado ? (
                    <SeguimientoTabs
                      items={children}
                      activeId={activeChildId}
                      onSelect={(id) => { const idx = children.findIndex((c) => c.id === id); if (idx >= 0) setActiveChild(idx); focusForm(); }}
                      onAdd={async () => {
                        if (bloqueoGlobalPorFinalizado) return; 
                        const parentId = puedeAjustarSeguimiento ? activeChildId : undefined;
                        try { await addChildImmediate(parentId); focusForm(); } catch (e: any) { alert(e?.message ?? "Error."); }
                      }}
                      onDelete={() => { if (currentSeguimientoId && confirm("¿Eliminar?")) removeById(currentSeguimientoId); }}
                      canAdd={canAddChild && !bloqueoGlobalPorFinalizado}
                      canDelete={canDeleteChild}
                    />
                  ) : null
                }
                planActions={
                  !isAuditorRole && isSeguimientoVisible ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const parentId = puedeAjustarSeguimiento ? activeChildId : undefined;
                            await addChildImmediate(parentId);
                            focusForm();
                          } catch (e: any) { alert(e?.message ?? "Error."); }
                        }}
                        disabled={!canAddChild || bloqueoGlobalPorFinalizado}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white ${ (canAddChild && !bloqueoGlobalPorFinalizado) ? "bg-emerald-600 hover:bg-emerald-700" : "bg-emerald-300 cursor-not-allowed" }`}
                      >
                        {puedeAjustarSeguimiento ? "Agregar seguimiento de ajuste..." : "Agregar seguimiento"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (!isAdmin) return; if (currentSeguimientoId && confirm("¿Eliminar?")) removeById(currentSeguimientoId); }}
                        disabled={!canDeleteChild || !currentSeguimientoId}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white ${ canDeleteChild && currentSeguimientoId ? "bg-amber-600 hover:bg-amber-700" : "bg-amber-300 cursor-not-allowed" }`}
                      >
                        Borrar seguimiento
                      </button>
                    </div>
                  ) : null
                }
                footer={
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleEnviar}
                      disabled={!isDuplicableCurrent || sending || entidadNoPuedeEnviar}
                      className="inline-flex items-center gap-2 rounded-md bg-yellow-400 px-3 py-1.5 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-60 w-full sm:w-auto"
                      title={entidadNoPuedeEnviar ? "No se puede modificar." : "Guardar y enviar"}
                    >
                      <FiSend /> {sending ? "Enviando..." : "Enviar"}
                    </button>
                  </div>
                }
              />
              {canAudit && <p className="mt-2 text-xs text-gray-500">Como auditor puedes editar la observación de calidad.</p>}
              {!canAudit && isEntidad && <p className="mt-2 text-xs text-gray-500">Nota: Si el seguimiento tiene observaciones, debes crear uno nuevo de ajuste.</p>}
            </section>

            {isPlanAprobado && (
              <section className={`${mobileTab === "history" ? "block" : "hidden lg:block"}`}>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">Historial de seguimientos</h3>
                <SeguimientosTimeline items={children} activeId={activeChildId} onSelect={(id) => { const idx = children.findIndex((c) => c.id === id); if (idx >= 0) setActiveChild(idx); focusForm(); }} />
              </section>
            )}
          </div>
        </div>
      </main>
    </PageBg>
  );
}