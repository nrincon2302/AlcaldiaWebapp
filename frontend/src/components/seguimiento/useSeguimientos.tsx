import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { hasAuditorAccess } from "../../lib/auth";

export type Plan = {
  id: number;
  num_plan_mejora?: string | null;
  nombre_entidad: string;
  enlace_entidad?: string | null;
  estado?: string | null;
  created_by: number;
  created_at?: string | null;

  insumo_mejora?: string | null;
  tipo_accion_mejora?: string | null;
  accion_mejora_planteada?: string | null;
  observacion_informe_calidad?: string | null;
  descripcion_actividades?: string | null;
  evidencia_cumplimiento?: string | null;
  fecha_inicio?: string | null;
  fecha_final?: string | null;
  seguimiento?: string | null;
  observacion_calidad?: string | null;
  plan_descripcion_actividades?: string | null;
  plan_evidencia_cumplimiento?: string | null;
  plan_observacion_calidad?: string | null;
  seguimientos?: Seguimiento[];
  indicador?: string | null;
  criterio?: string | null;
  aprobado_evaluador?: string | null; 
};


export type Seguimiento = {
  id?: number;
  plan_id?: number;
  ajuste_de_id?: number | null;

  observacion_informe_calidad?: string | null; // entidad
  insumo_mejora?: string | null;
  tipo_accion_mejora?: string | null;
  accion_mejora_planteada?: string | null;
  descripcion_actividades?: string | null;
  evidencia_cumplimiento?: string | null;
  fecha_inicio?: string | null;
  fecha_final?: string | null;
  seguimiento?: "Pendiente" | "En progreso" | "Finalizado" | string | null;
  enlace_entidad?: string | null;

  observacion_calidad?: string | null; // auditor/admin

  created_at?: string | null;
  updated_at?: string | null;
  updated_by_email?: string | null;

  entidad?: string | null;
  indicador?: string | null;
  criterio?: string | null;  
  fecha_reporte?: string | null;
};

export type UnifiedForm = Seguimiento & {
  nombre_entidad: string;
  enlace_entidad?: string | null;
  estado?: string | null;
  plan_descripcion_actividades?: string | null;
  plan_evidencia_cumplimiento?: string | null;

  aprobado_evaluador?: string | null;
  plan_observacion_calidad?: string | null;
  _saved_by_entidad?: boolean;
};

export const emptyForm = (): UnifiedForm => ({
  nombre_entidad: "",
  enlace_entidad: "",
  ajuste_de_id: undefined,
  observacion_informe_calidad: "",
  observacion_calidad: "",
  insumo_mejora: "",
  tipo_accion_mejora: "",
  accion_mejora_planteada: "",
  descripcion_actividades: "",
  evidencia_cumplimiento: "",
  plan_descripcion_actividades: "",
  plan_evidencia_cumplimiento: "",
  fecha_inicio: "",
  fecha_final: "",
  seguimiento: "Pendiente",
  entidad: "",
  indicador: "",
  criterio: "",   
  fecha_reporte: "",
  estado: "Borrador",

  aprobado_evaluador: "",
  plan_observacion_calidad: "",
  _saved_by_entidad: false,
});

function toNull(v?: string | null) {
  return !v || v.trim() === "" ? null : v;
}

function buildPlanPayload(base: UnifiedForm) {
  return {
    nombre_entidad: base.nombre_entidad?.trim() ?? "",
    enlace_entidad: toNull(base.enlace_entidad),
    ajuste_de_id: base.ajuste_de_id ?? undefined,
    insumo_mejora: toNull(base.insumo_mejora),
    indicador: toNull(base.indicador),
    criterio: toNull(base.criterio),   
    tipo_accion_mejora: toNull(base.tipo_accion_mejora),
    accion_mejora_planteada: toNull(base.accion_mejora_planteada),
    observacion_informe_calidad: toNull(base.observacion_informe_calidad),
    descripcion_actividades: toNull(base.plan_descripcion_actividades),
    evidencia_cumplimiento: toNull(base.plan_evidencia_cumplimiento),
    fecha_inicio: toNull(base.fecha_inicio),
    fecha_final: toNull(base.fecha_final),
    observacion_calidad: toNull(base.plan_observacion_calidad),
    aprobado_evaluador: toNull((base as any).aprobado_evaluador as any),
    estado: base.estado ?? "Borrador",
  };
}

export function useSeguimientos() {
  const { user } = useAuth();
  const role = user?.role;
  const isEntidad = role === "entidad";
  const isAuditor = hasAuditorAccess(user as any);
  const isAdmin = role === "admin";

  const actorEmail = useMemo(() => {
    const u: any = user;
    
    return u?.email ?? u?.sub ?? null;
   
  }, [user]);
  const actorEmailLower = useMemo(
    () => (actorEmail || "").toString().trim().toLowerCase(),
    [actorEmail]
  );

  // PADRES
  const [createdOrder, setCreatedOrder] = useState<"asc" | "desc">("desc");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlanId, setActivePlanId] = useState<number | null>(null);

  // HIJOS
  const [children, setChildren] = useState<Seguimiento[]>([]);

  // FORM unificado
  const [form, setForm] = useState<UnifiedForm>(emptyForm());
  const [planMissingKeys, setPlanMissingKeys] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const data = await api("/seguimiento");
      setPlans(data);
    })();
  }, []);
  const [autoSelected, setAutoSelected] = useState(false);
  useEffect(() => {
    if (autoSelected) return;
    if (!plans.length) return;
    setAutoSelected(true);
    setActive(plans[0].id);
  }, [plans, autoSelected]);

  function toDate(v?: string | null) {
    if (!v) return null;
    const d = v.length > 10 ? new Date(v) : new Date(v + "T00:00:00");
    return isNaN(+d) ? null : d;
  }
  const previousActions = useMemo(
    () =>
      Array.from(
        new Set(
          plans
            .map((p) => p.accion_mejora_planteada)
            .filter((v): v is string => !!v && v.trim() !== "")
        )
      ),
    [plans]
  );
  

  const [usedIndicadores, setUsedIndicadores] = useState<string[]>([]);

  async function reloadUsedIndicadores() {
    try {
      const data = await api("/seguimiento/indicadores_usados");
      if (Array.isArray(data)) {
        setUsedIndicadores(
          data
            .map((v: unknown) => (typeof v === "string" ? v.trim() : ""))
            .filter(Boolean)
        );
      }
    } catch (e) {
      console.error("useSeguimientos: error cargando indicadores usados", e);
    }
  }
  useEffect(() => {
    reloadUsedIndicadores();
  }, []);


  function newPlanFromAction(accion: string) {
    setActivePlanId(null);
    setChildren([]);

    setForm((prev) => ({
      ...emptyForm(),
      // heredamos datos de contexto
      nombre_entidad: prev.nombre_entidad,
      enlace_entidad: prev.enlace_entidad,
      accion_mejora_planteada: accion,
      indicador: prev.indicador,  
    }));
  }
async function createPlanFromAction(accion: string, indicadorBase: string, criterioBase?: string) {
  const nombre = form.nombre_entidad?.trim();
  const enlace = form.enlace_entidad ?? "";
  

  if (!nombre) {
    throw new Error("Primero ingresa el nombre de la entidad.");
  }

  const payload: any = {
    nombre_entidad: nombre,
    enlace_entidad: toNull(enlace),
    estado: "Borrador",    
    indicador: toNull(indicadorBase),    
    criterio: toNull(criterioBase ?? ""),
  };

  const accionLimpia = (accion || "").trim();
  if (accionLimpia) {
    payload.accion_mejora_planteada = accionLimpia;
  }

  const created: Plan = await api("/seguimiento", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  // En frontend lo tratamos como plan con indicador + estado Borrador
  const createdWithIndicador: Plan = {
    ...created,
    indicador: created.indicador ?? indicadorBase,
    criterio: created.criterio ?? criterioBase,
    estado: created.estado ?? "Borrador",
  };

  setPlans((prev) => [createdWithIndicador, ...prev]);

  return createdWithIndicador;
}
  const sortedPlans = useMemo(() => {
    const arr = [...plans];
    const getTs = (p: Plan): number => {
      const d1 = toDate((p as any).created_at ?? (p as any).createdAt);
      if (d1) return d1.getTime();
      const firstSeg = p.seguimientos?.[0];
      const d2 = toDate((firstSeg as any)?.created_at ?? (firstSeg as any)?.createdAt);
      if (d2) return d2.getTime();
      return p.id ?? 0;
    };
    arr.sort((a, b) => {
      const da = getTs(a);
      const db = getTs(b);
      return (da - db) * (createdOrder === "asc" ? 1 : -1);
    });
    return arr;
  }, [plans, createdOrder]);

  function toggleCreatedOrder() {
    setCreatedOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  async function setActive(idxOrId: number) {
    setPlanMissingKeys([]);
    let plan = plans.find((p) => p.id === idxOrId) ?? plans[idxOrId];
    if (!plan) return;

    try {
      const refreshed: Plan = await api(`/seguimiento/${plan.id}`);
      plan = { ...plan, ...refreshed };
      setPlans((prev) => prev.map((p) => (p.id === plan!.id ? plan! : p)));
    } catch (e) {
      console.warn("useSeguimientos: no se pudo refrescar plan", e);
    }

    setActivePlanId(plan.id);

    const segs: Seguimiento[] =
      plan.seguimientos && plan.seguimientos.length
        ? plan.seguimientos
        : await api(`/seguimiento/${plan.id}/seguimiento`);
    
    const safeSegs: Seguimiento[] = segs.length
      ? segs.map((s) => ({
          ...s,
          entidad: s.entidad ?? plan.nombre_entidad,  
          accion_mejora_planteada: s.accion_mejora_planteada ?? plan.accion_mejora_planteada ?? null,
        }))
      : [];

    setChildren(safeSegs);

    const first = segs[0];
    const savedByEntidad =
      !!actorEmailLower &&
      first &&
      ((first as any).updated_by_email || "")
        .toString()
        .trim()
        .toLowerCase() === actorEmailLower &&
      !!(first.descripcion_actividades || "").trim();

    setForm({
      ...(first ?? emptyForm()),
      // nivel plan
      plan_id: plan.id,
      nombre_entidad: plan.nombre_entidad,
      enlace_entidad: plan.enlace_entidad ?? "",
      estado: plan.estado,
      fecha_inicio: plan.fecha_inicio ?? "",
      fecha_final: plan.fecha_final ?? "",
      plan_descripcion_actividades: plan.descripcion_actividades ?? "",
      plan_evidencia_cumplimiento: plan.evidencia_cumplimiento ?? "",
      tipo_accion_mejora: plan.tipo_accion_mejora ?? "",
      insumo_mejora: plan.insumo_mejora ?? "",
      observacion_informe_calidad: plan.observacion_informe_calidad ?? first?.observacion_informe_calidad ?? "",
      plan_observacion_calidad: plan.observacion_calidad ?? "",
      accion_mejora_planteada:
        plan.accion_mejora_planteada ??
        first?.accion_mejora_planteada ??
        "",
      indicador: first?.indicador ?? (plan as any).indicador ?? "", 
      criterio: (first as any)?.criterio ?? (plan as any).criterio ?? "",
      aprobado_evaluador:
      (plan as any).aprobado_evaluador ??
      (first as any)?.aprobado_evaluador ??
      "",
      _saved_by_entidad: savedByEntidad,
    });
  }


  function startNew() {
    setPlanMissingKeys([]);
    setActivePlanId(null);
    setChildren([]);
    setForm(emptyForm());
  }

  function updateLocal<K extends keyof UnifiedForm>(key: K, value: UnifiedForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetCurrent() {
    setForm((prev) => ({
      ...emptyForm(),
      nombre_entidad: activePlanId ? prev.nombre_entidad : "",
      enlace_entidad: activePlanId ? prev.enlace_entidad : "",
      plan_id: activePlanId || undefined,
      id: undefined,
    }));
  }

  async function ensurePlanExists(): Promise<number> {
    if (activePlanId) return activePlanId;

    const nombre = form.nombre_entidad?.trim();
    if (!nombre) throw new Error("Ingresa el nombre de la entidad para crear el plan.");

    const planPayload = buildPlanPayload(form);

    const created: Plan = await api("/seguimiento", {
      method: "POST",
      body: JSON.stringify(planPayload),
    });

    const createdWithIndicador: Plan = {
      ...created,
      indicador: form.indicador ?? (created as any).indicador ?? "",
      criterio: form.criterio ?? (created as any).criterio ?? "",
      estado: "Borrador",
      observacion_informe_calidad:
        form.observacion_informe_calidad ?? (created as any).observacion_informe_calidad ?? "",

      aprobado_evaluador:
      (created as any).aprobado_evaluador ??
      (form as any).aprobado_evaluador ??
      null,
    };

    setPlans((prev) => [createdWithIndicador, ...prev]);
    setActivePlanId(createdWithIndicador.id);

    return createdWithIndicador.id;
  }

  const planFieldLabels: Record<string, string> = {
    enlace_entidad: "Enlace de la entidad",
    indicador: "Indicador",
    criterio: "Criterio",
    tipo_accion_mejora: "Tipo de acción de mejora",
    observacion_informe_calidad: "Acción recomendada",
    accion_mejora_planteada: "Acción de mejora planteada",
    plan_descripcion_actividades: "Descripción de las actividades",
    plan_evidencia_cumplimiento: "Evidencia de cumplimiento",
    fecha_inicio: "Fecha inicio",
    fecha_final: "Fecha final",
  };

  function collectPlanFieldGaps(base: UnifiedForm, requirePlan: boolean): string[] {
    if (!requirePlan) return [];
    const isBlank = (v: any) =>
      v === null ||
      v === undefined ||
      (typeof v === "string" && v.trim() === "");

    const missing: string[] = [];
    if (isBlank(base.enlace_entidad)) missing.push("enlace_entidad");
    if (isBlank(base.indicador)) missing.push("indicador");
    if (isBlank(base.criterio)) missing.push("criterio");
    if (isBlank(base.tipo_accion_mejora)) missing.push("tipo_accion_mejora");
    if (isBlank(base.observacion_informe_calidad)) missing.push("observacion_informe_calidad");
    if (isBlank(base.accion_mejora_planteada)) missing.push("accion_mejora_planteada");
    if (isBlank(base.plan_descripcion_actividades)) missing.push("plan_descripcion_actividades");
    if (isBlank(base.plan_evidencia_cumplimiento)) missing.push("plan_evidencia_cumplimiento");
    if (isBlank(base.fecha_inicio)) missing.push("fecha_inicio");
    if (isBlank(base.fecha_final)) missing.push("fecha_final");

    return missing;
  }

  async function saveCurrent(overrides?: Partial<UnifiedForm>) {
    const base = overrides ? { ...form, ...overrides } : form;
    setPlanMissingKeys([]);
    if (!base.nombre_entidad?.trim()) throw new Error("Ingresa el nombre de la entidad");
    const prevEstado = form.estado ?? "Borrador";
    const shouldValidatePlan = prevEstado === "Borrador" || !form.plan_id;
    const missingPlanFields = collectPlanFieldGaps(base, shouldValidatePlan);
    if (missingPlanFields.length) {
      setPlanMissingKeys(missingPlanFields);
      const labels = missingPlanFields.map((k) => planFieldLabels[k] || k);
      alert(`Todos los campos son requeridos: ${labels.join(", ")} `);
      return null;
    }
    const planId = await ensurePlanExists();

    const planPayload = buildPlanPayload(base);

    if (planId) {
      try {
        await api(`/seguimiento/${planId}`, {
          method: "PUT",
          body: JSON.stringify(planPayload),
        });
      } catch (e) {
        console.error("useSeguimientos: no se pudo actualizar el plan", e);
      }
    }
    const nextEstado =
      (overrides && "estado" in overrides ? overrides.estado : form.estado) ?? null;

    // Solo plan: no crear seguimiento automáticamente
    if (!base.id) {
      const v = (base.indicador || "").trim();
      if (v) {
        setUsedIndicadores((prev) =>
          prev.includes(v) ? prev : [...prev, v]
        );
      }

      setForm((prev) => ({
        ...prev,
        plan_id: planId,
        estado: nextEstado ?? prev.estado ?? null,
        observacion_informe_calidad:
          base.observacion_informe_calidad ?? prev.observacion_informe_calidad ?? "",
        aprobado_evaluador:
          (base as any).aprobado_evaluador ??
          prev.aprobado_evaluador ??
          null,
        plan_observacion_calidad:
          base.plan_observacion_calidad ??
          prev.plan_observacion_calidad ??
          null,
      }));
      setPlanMissingKeys([]);

      setPlans((prev) =>
        prev.map((p) =>
          p.id === planId
            ? {
                ...p,
                enlace_entidad: base.enlace_entidad ?? p.enlace_entidad,
                estado: nextEstado ?? p.estado ?? null,
                fecha_inicio: base.fecha_inicio ?? p.fecha_inicio ?? null,
                fecha_final: base.fecha_final ?? p.fecha_final ?? null,
                tipo_accion_mejora: base.tipo_accion_mejora ?? p.tipo_accion_mejora ?? null,
                accion_mejora_planteada: base.accion_mejora_planteada ?? p.accion_mejora_planteada ?? null,
                plan_descripcion_actividades:
                  base.plan_descripcion_actividades ?? p.plan_descripcion_actividades ?? null,
                plan_evidencia_cumplimiento:
                  base.plan_evidencia_cumplimiento ?? p.plan_evidencia_cumplimiento ?? null,
                indicador: base.indicador ?? p.indicador ?? null,
                criterio: base.criterio ?? p.criterio ?? null,
                observacion_informe_calidad:
                  base.observacion_informe_calidad ?? p.observacion_informe_calidad ?? null,

                aprobado_evaluador:
                  (base as any).aprobado_evaluador ??
                  (p as any).aprobado_evaluador ??
                  null,
                observacion_calidad:
                  base.plan_observacion_calidad ??
                  (p as any).observacion_calidad ??
                  null,
              }
            : p
        )
      );

      // Devolvemos un objeto liviano para que los flujos superiores (alertas) continúen
      return { plan_id: planId } as any;
    }

    const childPayload: Seguimiento = {
      ajuste_de_id: base.ajuste_de_id ?? null,
      observacion_informe_calidad: toNull(base.observacion_informe_calidad),
      insumo_mejora: toNull(base.insumo_mejora),
      tipo_accion_mejora: toNull(base.tipo_accion_mejora),
      accion_mejora_planteada: toNull(base.accion_mejora_planteada),
      descripcion_actividades: toNull(base.descripcion_actividades),
      evidencia_cumplimiento: toNull(base.evidencia_cumplimiento),
      fecha_inicio: toNull(base.fecha_inicio),
      fecha_final: toNull(base.fecha_final),
      fecha_reporte: toNull(base.fecha_reporte),
      seguimiento: base.seguimiento ?? "Pendiente",
      enlace_entidad: toNull(base.enlace_entidad),
      ...(isAuditor || isAdmin ? { observacion_calidad: toNull(base.observacion_calidad) } : {}),
      indicador: toNull(base.indicador),
      criterio: toNull(base.criterio), 
    };

    const planActionFallback =
      toNull(base.accion_mejora_planteada) ??
      plans.find((p) => p.id === planId)?.accion_mejora_planteada ??
      null;

    let saved: Seguimiento;

    const updated = await api(`/seguimiento/${planId}/seguimiento/${base.id}`, {
      method: "PUT",
      body: JSON.stringify(childPayload),
    });
    const withActor: Seguimiento = {
      ...updated,
      updated_by_email: actorEmail,
      entidad: base.entidad ?? base.nombre_entidad ?? null,
      accion_mejora_planteada:
        updated.accion_mejora_planteada ?? planActionFallback ?? null,
    };
    setChildren((prev) => prev.map((x) => (x.id === updated.id ? withActor : x)));
    saved = withActor;

    if (childPayload.indicador) {
      const v = (childPayload.indicador || "").trim();
      if (v) {
        setUsedIndicadores((prev) =>
          prev.includes(v) ? prev : [...prev, v]
        );
      }
    }

    
    setForm((prev) => ({
      ...prev,
      ...(overrides ? { ...saved, ...overrides } : saved),
      plan_id: planId,
      ajuste_de_id: saved.ajuste_de_id ?? prev.ajuste_de_id ?? null,
      nombre_entidad: prev.nombre_entidad,
      enlace_entidad: base.enlace_entidad ?? "",
      estado: nextEstado ?? prev.estado ?? null,
      fecha_inicio: base.fecha_inicio ?? prev.fecha_inicio ?? "",
      fecha_final: base.fecha_final ?? prev.fecha_final ?? "",

      aprobado_evaluador:
      (base as any).aprobado_evaluador ??
      prev.aprobado_evaluador ??
      null,
      plan_observacion_calidad:
        base.plan_observacion_calidad ??
        prev.plan_observacion_calidad ??
        null,
      _saved_by_entidad:
        prev._saved_by_entidad ||
        (isEntidad &&
          !!actorEmailLower &&
          ((saved as any).updated_by_email || "")
            .toString()
            .trim()
            .toLowerCase() === actorEmailLower &&
          !!(saved.descripcion_actividades || base.descripcion_actividades || "").trim()),
    }));
    setPlanMissingKeys([]);

    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              enlace_entidad: base.enlace_entidad ?? p.enlace_entidad,
              estado: nextEstado ?? p.estado ?? null,
              fecha_inicio: base.fecha_inicio ?? p.fecha_inicio ?? null,
              fecha_final: base.fecha_final ?? p.fecha_final ?? null,
              tipo_accion_mejora: base.tipo_accion_mejora ?? p.tipo_accion_mejora ?? null,
              accion_mejora_planteada: base.accion_mejora_planteada ?? p.accion_mejora_planteada ?? null,
              plan_descripcion_actividades:
                base.plan_descripcion_actividades ?? p.plan_descripcion_actividades ?? null,
              plan_evidencia_cumplimiento:
                base.plan_evidencia_cumplimiento ?? p.plan_evidencia_cumplimiento ?? null,
              indicador: base.indicador ?? p.indicador ?? null,
              criterio: base.criterio ?? p.criterio ?? null,
              observacion_informe_calidad:
                base.observacion_informe_calidad ?? p.observacion_informe_calidad ?? null,

              aprobado_evaluador:
              (base as any).aprobado_evaluador ??
              (p as any).aprobado_evaluador ??
              null,
              observacion_calidad:
                base.plan_observacion_calidad ??
                (p as any).observacion_calidad ??
                null,
            }
          : p
      )
    );

    return saved;
  }


async function addChildImmediate(ajusteDeId?: number | null) {
  const planId = await ensurePlanExists();

  const planActual = plans.find((p) => p.id === planId) || null;
  const enlaceBase =
    toNull(form.enlace_entidad) ??
    toNull(planActual?.enlace_entidad ?? null);

  const payload: Seguimiento = {
    seguimiento: "Pendiente",
    enlace_entidad: enlaceBase,
    ajuste_de_id: ajusteDeId ?? null,
  };

  const created: Seguimiento = await api(`/seguimiento/${planId}/seguimiento`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const withEnlace: Seguimiento = {
    ...created,
    enlace_entidad: created.enlace_entidad ?? enlaceBase,
    entidad: form.entidad ?? form.nombre_entidad ?? "",
  };

  setChildren((prev) => [...prev, withEnlace]);

  setForm((prev) => ({
    ...prev,

    // Identidad del seguimiento actual
    id: withEnlace.id,
    plan_id: planId,
    ajuste_de_id: ajusteDeId ?? null,

    // Mantener nombre de entidad del contexto
    nombre_entidad:
      prev.nombre_entidad || planActual?.nombre_entidad || "",

    // Enlace del funcionario responsable
    enlace_entidad:
      withEnlace.enlace_entidad ??
      prev.enlace_entidad ??
      planActual?.enlace_entidad ??
      "",
      descripcion_actividades: "",
      evidencia_cumplimiento: "",
      fecha_reporte: "",
      seguimiento: withEnlace.seguimiento ?? "Pendiente",

    observacion_calidad: "",

    observacion_informe_calidad: prev.observacion_informe_calidad ?? "",

    indicador: withEnlace.indicador ?? prev.indicador ?? "",
    _saved_by_entidad: false,
  }));

  return withEnlace;
}



async function removeById(id: number) {
  if (!activePlanId || !id) return;

  // 1) Borrar en backend
  await api(`/seguimiento/${activePlanId}/seguimiento/${id}`, { method: "DELETE" });

  // 2) Actualizar hijos en memoria y capturar el nuevo arreglo
  let nextChildren: Seguimiento[] = [];
  setChildren((prev) => {
    nextChildren = prev.filter((x) => x.id !== id);
    return nextChildren;
  });

  
  setForm((prev) => {
    if (prev.id === id || !prev.id) {
      const planBase = {
        plan_id: activePlanId,
        nombre_entidad: prev.nombre_entidad,
        enlace_entidad: prev.enlace_entidad ?? "",
        estado: prev.estado ?? null,
        aprobado_evaluador: (prev as any).aprobado_evaluador ?? null,
        plan_observacion_calidad: prev.plan_observacion_calidad ?? null,
        ajuste_de_id: prev.ajuste_de_id ?? null,
        insumo_mejora: prev.insumo_mejora ?? "",
        tipo_accion_mejora: prev.tipo_accion_mejora ?? "",
        accion_mejora_planteada: prev.accion_mejora_planteada ?? "",
        plan_descripcion_actividades: prev.plan_descripcion_actividades ?? "",
        plan_evidencia_cumplimiento: prev.plan_evidencia_cumplimiento ?? "",
        fecha_inicio: prev.fecha_inicio ?? "",
        fecha_final: prev.fecha_final ?? "",
        indicador: prev.indicador ?? "",
        observacion_informe_calidad: prev.observacion_informe_calidad ?? "",
        observacion_calidad: prev.observacion_calidad ?? "",
      };
      if (nextChildren.length > 0) {
        const next = nextChildren[nextChildren.length - 1];

        return {
          ...planBase,
          ...next,
          // Normalizar campos a string para evitar undefined
          evidencia_cumplimiento: next.evidencia_cumplimiento ?? "",
          observacion_informe_calidad: next.observacion_informe_calidad ?? planBase.observacion_informe_calidad,
          observacion_calidad: next.observacion_calidad ?? planBase.observacion_calidad,
          ajuste_de_id: next.ajuste_de_id ?? planBase.ajuste_de_id,
          insumo_mejora: next.insumo_mejora ?? planBase.insumo_mejora,
          tipo_accion_mejora: next.tipo_accion_mejora ?? planBase.tipo_accion_mejora,
          accion_mejora_planteada: next.accion_mejora_planteada ?? planBase.accion_mejora_planteada,
          descripcion_actividades: next.descripcion_actividades ?? "",
          fecha_inicio: next.fecha_inicio ?? planBase.fecha_inicio,
          fecha_final: next.fecha_final ?? planBase.fecha_final,
          fecha_reporte: next.fecha_reporte ?? "",
          seguimiento: next.seguimiento ?? "Pendiente",
          indicador: next.indicador ?? planBase.indicador,
        };
      } else {
        return {
          ...planBase,
          id: undefined,
          ajuste_de_id: undefined,
          descripcion_actividades: "",
          evidencia_cumplimiento: "",
          fecha_reporte: "",
          seguimiento: "Pendiente",
        };
      }
    }
    return prev;
  });
  await reloadUsedIndicadores();
}


  async function removePlan(id?: number) {
    const planId = id ?? activePlanId;
    if (!planId) return;
    await api(`/seguimiento/${planId}`, { method: "DELETE" });
    setPlans((prev) => prev.filter((p) => p.id !== planId));
    if (activePlanId === planId) {
      setActivePlanId(null);
      setChildren([]);
      setForm(emptyForm());
    }
    await reloadUsedIndicadores();
  }

  function setActiveChild(i: number) {
    if (!children.length) return;
    const safe = Math.max(0, Math.min(i, children.length - 1));
    const child = children[safe];
    if (!child) return;
    const savedByEntidad =
      !!actorEmailLower &&
      ((child as any).updated_by_email || "")
        .toString()
        .trim()
        .toLowerCase() === actorEmailLower &&
      !!(child.descripcion_actividades || "").trim();

    setForm((prev) => ({
      ...prev,
      // Identidad del seguimiento activo
      id: child.id,
      plan_id: activePlanId ?? child.plan_id,
      ajuste_de_id: child.ajuste_de_id ?? prev.ajuste_de_id,

      // Campos propios del SEGUIMIENTO (bloque de abajo)
      descripcion_actividades: child.descripcion_actividades ?? "",
      evidencia_cumplimiento: child.evidencia_cumplimiento ?? "",
      fecha_reporte: child.fecha_reporte ?? prev.fecha_reporte ?? "",
      seguimiento: child.seguimiento ?? "Pendiente",

      observacion_calidad:
        child.observacion_calidad ?? "",

      observacion_informe_calidad:
        child.observacion_informe_calidad ??
        prev.observacion_informe_calidad ??
        "",

      indicador: child.indicador ?? prev.indicador ?? "",
      _saved_by_entidad: savedByEntidad,
      plan_observacion_calidad: prev.plan_observacion_calidad ?? null,
    }));
  }




  function importSeguimientoFields(data: {
    entidad?: string;
    indicador?: string;
    accion?: string;
  }) {
    setForm((prev) => ({
      ...prev,
      
      // Solo completar si el campo está vacío para no pisar datos del plan/seguimiento
      nombre_entidad:
        (prev.nombre_entidad && prev.nombre_entidad.trim()) ? prev.nombre_entidad : (data.entidad ?? prev.nombre_entidad ?? ""),
      indicador:
        (prev.indicador && (prev.indicador as string).trim()) ? prev.indicador : (data.indicador ?? prev.indicador ?? ""),
      observacion_informe_calidad:
        (prev.observacion_informe_calidad && prev.observacion_informe_calidad.trim())
          ? prev.observacion_informe_calidad
          : (prev.observacion_informe_calidad ?? "")
    }));
  }

  const rows = useMemo(() => {
    return sortedPlans.map((p, idx) => ({
      "#": idx + 1,
      Plan: p.num_plan_mejora ?? "—",
      Entidad: p.nombre_entidad,
      "Fecha Inicio": p.fecha_inicio ?? "—",
      Seguimiento: p.seguimiento ?? "—",
      Estado: p.estado ?? "—",
    }));
  }, [sortedPlans]);

  const isDuplicableCurrent = !!form.nombre_entidad?.trim();
  const indexInChildren = form.id ? Math.max(0, children.findIndex((c) => c.id === form.id)) : 0;
  const pagerIndex = activePlanId ? indexInChildren : 0;
  const pagerTotal = activePlanId ? Math.max(1, children.length || 1) : 1;

  async function loadSeguimientosForExport() {
    const results: { plan: Plan; seguimientos: Seguimiento[] }[] = [];
    const targets = sortedPlans.length ? sortedPlans : plans;
    for (const plan of targets) {
      if (!plan?.id) continue;
      let segs: Seguimiento[] = [];
      try {
        const data = await api(`/seguimiento/${plan.id}/seguimiento`);
        segs = Array.isArray(data) ? data : [];
      } catch (e) {
        console.error(`useSeguimientos: error cargando seguimientos para plan ${plan.id}`, e);
      }
      const normalized = segs.map((s) => ({
        ...s,
        entidad: s.entidad ?? plan.nombre_entidad,
        accion_mejora_planteada:
          s.accion_mejora_planteada ?? plan.accion_mejora_planteada ?? null,
        aprobado_evaluador: (plan as any).aprobado_evaluador ?? (s as any).aprobado_evaluador ?? null,
      }));
      results.push({ plan, seguimientos: normalized });
    }
    return results;
  }

  return {
    plans: sortedPlans,
    rows,
    activePlanId,
    setActive,

    children,
    current: form,
    updateLocal,
    resetCurrent,
    startNew,
    saveCurrent,
    removeById,
    addChildImmediate,
    removePlan,

    setActiveChild,
    isDuplicableCurrent,
    pagerIndex,
    pagerTotal,
    role,
    createdOrder,
    toggleCreatedOrder,

    importSeguimientoFields,
    previousActions,
    newPlanFromAction,
    createPlanFromAction, 
    usedIndicadores,
    loadSeguimientosForExport,
    planMissingKeys,
  };
}
