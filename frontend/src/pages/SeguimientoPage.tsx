import React from "react";
import Header from "../components/Header";
import PageBg from "../components/PageBackground";
import { FaEraser } from "react-icons/fa";
import SeguimientoForm from "../components/seguimiento/SeguimientoForm";
import { useSeguimientos, type Plan, type Seguimiento } from "../components/seguimiento/useSeguimientos";
import { useAuth } from "../context/AuthContext";
import { FiSend } from "react-icons/fi";
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
// Botonera de exportación (todos los planes/seguimientos)
// ─────────────────────────────────────────────────────────────
function ExportPlanButtons({
  hasData,
  loadAllSeguimientos,
}: {
  hasData: boolean;
  loadAllSeguimientos: () => Promise<{ plan: Plan; seguimientos: Seguimiento[] }[]>;
}) {
  const [loading, setLoading] = React.useState(false);

  async function handle(kind: "csv" | "xlsx" | "pdf") {
    try {
      setLoading(true);
      const groups = await loadAllSeguimientos();
      if (!groups.length) {
        alert("No hay registros para exportar.");
        return;
      }
      if (kind === "csv") {
        exportAllSeguimientosCSV(groups);
      } else if (kind === "xlsx") {
        await exportAllSeguimientosXLSX(groups);
      } else {
        await exportAllSeguimientosPDF(groups);
      }
    } catch (e: any) {
      console.error("Exportación fallida", e);
      alert(e?.message ?? "No se pudo exportar los seguimientos.");
    } finally {
      setLoading(false);
    }
  }

  const disabled = loading || !hasData;

  return (
    <div className="ml-2 flex items-center gap-2">
      <span className="text-xs font-medium text-gray-600">Exportar todos:</span>
      <button
        type="button"
        onClick={() => handle("csv")}
        className="btn-outline"
        disabled={disabled}
        title={disabled ? "No hay registros para exportar" : "Exportar todos los seguimientos en CSV"}
      >
        {loading ? "Exportando..." : "CSV"}
      </button>
      <button
        type="button"
        onClick={() => handle("xlsx")}
        className="btn-outline"
        disabled={disabled}
        title={disabled ? "No hay registros para exportar" : "Exportar todos los seguimientos en XLSX"}
      >
        {loading ? "Exportando..." : "XLSX"}
      </button>
      <button
        type="button"
        onClick={() => handle("pdf")}
        className="btn-outline"
        disabled={disabled}
        title={disabled ? "No hay registros para exportar" : "Exportar todos los seguimientos en PDF"}
      >
        {loading ? "Exportando..." : "PDF"}
      </button>
    </div>
  );
}

export default function SeguimientoPage() {
  const {
    plans,                    // planes padre
    activePlanId, setActive,  // id plan activo
    children,                 // seguimientos del plan activo
    current, updateLocal, resetCurrent, startNew, saveCurrent,
    removeById, addChildImmediate, removePlan,
    isDuplicableCurrent, pagerIndex, setActiveChild,
    createdOrder,
    toggleCreatedOrder,
    importSeguimientoFields,  
    createPlanFromAction, 
    usedIndicadores,
    loadSeguimientosForExport,
    planMissingKeys,
  } = useSeguimientos();
  
  type IndicadorApiRow = {
    entidad: string | undefined;
    indicador: string | undefined;
    accion: string | undefined;
  };

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
  const estadoPlanActual: string | null =
    (currentAny?.estado as string) ?? null; 
  
   // plan activo (objeto)
  const activePlan = React.useMemo(
    () => plans.find(p => p.id === activePlanId) ?? null,
    [plans, activePlanId]
  );

  const isPlanEnBorrador = !activePlan?.estado || activePlan?.estado === "Borrador";

  const aprobadoEvaluador = (currentAny?.aprobado_evaluador as string) || "";
  const isPlanDevuelto =
  aprobadoEvaluador === "Rechazado" || estadoPlanActual === "Plan devuelto para ajustes";

  
  const hasSeguimientoActual =
  Boolean(currentAny?.id) || Boolean(currentAny?.fecha_reporte);


  const isDraftPlan =
  estadoPlanActual === "Borrador" && !hasSeguimientoActual;
  
  const isPlanHabilitado =
    (estadoPlanActual || "").toLowerCase() === "plan habilitado para seguimiento";
  const isPlanAprobado =
    (currentAny?.aprobado_evaluador as string) === "Aprobado" || isPlanHabilitado; 

  const isSeguimientoVisible =
    Boolean(currentAny?.plan_id) && isPlanAprobado;


  // Regla: la entidad NO puede reenviar/modificar seguimientos que ya no están en "Pendiente"
  const entidadNoPuedeEnviar =
    isEntidad && isSeguimientoActual && estadoSeguimientoActual !== "Pendiente";

  const activeChild = children[pagerIndex] ?? null;
  const activeChildId = activeChild?.id;
  const puedeAjustarSeguimiento =
    isEntidad && !!activeChildId && !!(activeChild?.observacion_calidad || "").trim();

  // permisos
  const canDeleteChild = !!currentSeguimientoId && isAdmin;
  const canDeletePlan = !!activePlanId && 
    (isAdmin || (isEntidad && isPlanEnBorrador));

  const canResetForm = isAdmin || isEntidad;
  const canAddChild =
    (isAdmin || isEntidad) &&
    Boolean(activePlanId || (current as any)?.nombre_entidad?.trim());


  // Cálculos para bloquear edición si ya se guardó ===
  const auditorYaEvaluoPlan = 
    canAudit && 
    (activePlan?.aprobado_evaluador === "Aprobado" || activePlan?.aprobado_evaluador === "Rechazado");

  // Buscamos el seguimiento "real" en la lista (no el del formulario) para ver si ya tiene observación guardada
  const childOriginal = children.find(c => c.id === activeChildId);
  
  const auditorYaEvaluoSeguimiento = 
    canAudit && 
    !!childOriginal?.observacion_calidad && 
    childOriginal.observacion_calidad.trim().length > 0;

  // enviar/guardar
  const [sending, setSending] = React.useState(false);
  async function handleEnviar() {
    try {
      setSending(true);

      const currentAny = current as any;
      const isDraftPlan = currentAny?.estado === "Borrador";

      if (isEntidad || isAdmin) {
        const overrides: any = {};

        if (isDraftPlan) {
          overrides.estado = "Pendiente";
        }

        const saved = await saveCurrent(overrides);
        if (!saved) return;

        if (isDraftPlan) {
        // Mensaje para cuando se envía un plan por primera vez  
          alert("Acción de mejora enviada con éxito, el reporte de seguimiento lo podrá realizar una vez sea aprobado por la DDCS");
        } else {
          // Mensaje para cuando se guarda/envía un Seguimiento normal
          alert("Seguimiento enviado con éxito.");
        }
      } else {
        // admin / auditor simplemente guardan cambios
        const saved = await saveCurrent({} as any);
        if (!saved) return;
        alert("Seguimiento guardado.");
      }
    } finally {
      setSending(false);
    }
  }

  // ===== Solo móvil: alternar Formulario/Historial
  const [mobileTab, setMobileTab] = React.useState<"form" | "history">(
    () => (children.length ? "history" : "form")
  );

  // Enfocar formulario (desktop)
  const formFocusRef = React.useRef<HTMLInputElement>(null);
  function focusForm() {
    setMobileTab("form");
    requestAnimationFrame(() => {
      const section = document.getElementById("seguimiento-section");
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "center" });
        const firstInput = section.querySelector<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >("input, textarea, select");
        firstInput?.focus();
      }
    });
  }
  const handleNewPlanFromAction = async (_accionRaw: string) => {
    const curr = current as any;

    const indicadorBase = (curr?.indicador || "").trim();
    const criterioBase  = (curr?.criterio || "").trim();

    const tienePlan = Boolean(curr?.plan_id);

    const puedeComoEntidad = (isEntidad || isAdmin) && tienePlan;

    const aprobadoEvaluador = (curr?.aprobado_evaluador as string) || "";
    const isPlanDevuelto =
      aprobadoEvaluador === "Rechazado" ||
      (curr?.estado as string) === "Plan devuelto para ajustes";

    const puedeComoEvaluador = canAudit && isPlanDevuelto;

    if (!puedeComoEntidad && !puedeComoEvaluador) {
      alert(
        "Solo se puede crear una nueva acción de mejora asociada a este indicador " +
          "después de enviar el plan o cuando el plan ha sido devuelto para ajustes por el equipo evaluador."
      );
      return;
    }

    if (!indicadorBase) {
      alert("Primero diligencia el campo Indicador.");
      return;
    }

    try {
      const nuevoPlan = await createPlanFromAction("", indicadorBase, criterioBase); 
      await setActive(nuevoPlan.id);

      requestAnimationFrame(() => {
        const main = document.querySelector("main");
        main?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (e: any) {
      alert(
        e?.message ??
          "No se pudo crear la nueva acción de mejora asociada a este indicador."
      );
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
              className={`rounded-lg px-3 py-1.5 text-sm font-medium text-gray-800  ${
                !isAuditorRole ? "bg-white hover:bg-gray-100" : "bg-gray-400 text-white cursor-not-allowed"
              }`}
              onClick={() => startNew()}
              disabled={isAuditorRole}
            >
              Nuevo registro
            </button>
            {/* Borrar plan */}
            <button
              className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white ${
                canDeletePlan ? "bg-rose-700 hover:bg-rose-800" : "bg-rose-300 cursor-not-allowed"
              }`}
              type="button"
              disabled={!canDeletePlan}
              onClick={() => {
                if (!canDeletePlan) return;
                if (confirm("Se eliminará esta acción de mejora")) removePlan(activePlanId);
              }}
            >
              Borrar registro
            </button>

            {/* Exportar todos los planes + seguimientos */}
            <ExportPlanButtons
              hasData={plans.length > 0}
              loadAllSeguimientos={loadSeguimientosForExport}
            />
          </div>
        </div>

        {/* Layout maestro-detalle */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Sidebar de planes */}
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

          {/* Panel principal */}
          <div className="lg:col-span-8 space-y-4">
            {/* Segment control SOLO móvil */}
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileTab("form")}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  mobileTab === "form" ? "bg-white shadow text-gray-900" : "text-gray-600"
                }`}
              >
                Formulario
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("history")}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  mobileTab === "history" ? "bg-white shadow text-gray-900" : "text-gray-600"
                }`}
              >
                Historial ({children.length})
              </button>
            </div>

            {/* Formulario */}
            <section className={`card ${mobileTab === "form" ? "block" : "hidden lg:block"}`}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Acción de Mejora</h2>
                {canResetForm && (
                  <button
                  type="button"
                  className="btn-outline"
                  onClick={resetCurrent}
                  title="Limpiar formulario actual"
                  >
                    <FaEraser /> <span className="hidden sm:inline">Limpiar</span>
                  </button>
                )}
               

              </div>
              <IndicadoresAutoLoader
                onImport={importSeguimientoFields}
                onOptionsFromApi={setIndicadoresApi}
                nombreEntidad={(current as any)?.nombre_entidad || user?.entidad}
              />

              <SeguimientoForm
                value={current as any}
                onChange={updateLocal as any}
                // (coment MS) readOnlyFields={{ observacion_calidad: isEntidad }}
              readOnlyFields={{
                // 1. La entidad NUNCA edita observaciones de calidad.
                // 2. El auditor NO edita si ya guardó una observación previamente.
                observacion_calidad: isEntidad || auditorYaEvaluoSeguimiento,
                
                // El auditor NO cambia el estado del plan ni su observación si ya lo definió en BD.
                aprobado_evaluador: auditorYaEvaluoPlan,
                plan_observacion_calidad: auditorYaEvaluoPlan,
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
                      onSelect={(id) => {
                        const idx = children.findIndex((c) => c.id === id);
                        if (idx >= 0) setActiveChild(idx);
                        focusForm();
                      }}
                      onAdd={async () => {
                        const parentId = puedeAjustarSeguimiento ? activeChildId : undefined;
                        try {
                          await addChildImmediate(parentId);
                          focusForm();
                        } catch (e: any) {
                          alert(e?.message ?? "No se pudo crear el seguimiento.");
                        }
                      }}

                      onDelete={() => {
                        if (currentSeguimientoId && confirm("¿Eliminar este seguimiento?")) {
                          removeById(currentSeguimientoId);
                        }
                      }}

                      canAdd={canAddChild}
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
                          } catch (e: any) {
                            alert(e?.message ?? "No se pudo crear el seguimiento.");
                          }
                        }}
                        disabled={!canAddChild}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white ${
                          canAddChild
                            ? "bg-emerald-600 hover:bg-emerald-700"
                            : "bg-emerald-300 cursor-not-allowed"
                        }`}
                      >
                        {puedeAjustarSeguimiento
                          ? "Agregar seguimiento de ajuste a observaciones del evaluador"
                          : "Agregar seguimiento"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isAdmin) return;
                          if (currentSeguimientoId && confirm("¿Eliminar este seguimiento?")) {
                            removeById(currentSeguimientoId);
                          }
                        }}
                        disabled={!canDeleteChild || !currentSeguimientoId}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white ${
                          canDeleteChild && currentSeguimientoId
                            ? "bg-amber-600 hover:bg-amber-700"
                            : "bg-amber-300 cursor-not-allowed"
                        }`}
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
                      title={
                        entidadNoPuedeEnviar
                          ? "La entidad no puede modificar un seguimiento ya enviado. Cree un nuevo seguimiento."
                          : "Guardar y enviar"
                      }
                    >
                      <FiSend /> {sending ? "Enviando..." : "Enviar"}
                    </button>
                  </div>
                }
              />

              {canAudit && (
                <p className="mt-2 text-xs text-gray-500">
                  Como auditor puedes editar la observación de calidad y guardar.
                </p>
              )}
              {!canAudit && isEntidad && (
                <p className="mt-2 text-xs text-gray-500">
                  Como entidad no puedes editar “Observación del informe de calidad”.
                </p>
              )}
            </section>

            {/* Historial (debajo en desktop; tab en móvil) */}
            {isPlanAprobado && (
              <section className={`${mobileTab === "history" ? "block" : "hidden lg:block"}`}>
                <h3 className="mb-2 text-sm font-semibold text-gray-700">
                  Historial de seguimientos
                </h3>
                <SeguimientosTimeline
                  items={children}
                  activeId={activeChildId}
                  onSelect={(id) => {
                    const idx = children.findIndex((c) => c.id === id);
                    if (idx >= 0) setActiveChild(idx);
                    focusForm();
                  }}
                />
              </section>
            )}
          </div>
        </div>
      </main>
    </PageBg>
  );
}
