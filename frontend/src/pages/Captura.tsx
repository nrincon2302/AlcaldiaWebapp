import React from "react";
import Header from "../components/Header";
import PageBg from "../components/PageBackground";
import { useAuth } from "../context/AuthContext";
import { hasAuditorAccess } from "../lib/auth";
import { FiChevronDown } from "react-icons/fi";
import SkillLoader from "../components/SkillLoader"; // <-- añadido

type LinkItem = { label: string; url?: string | null };
type SubSection = { title: string; items: LinkItem[], subsections?: SubSection[] };
type Group = { title: string; description?: string; subsections: SubSection[], items?: LinkItem[] };

type Section = {
  title: string;
  items?: LinkItem[];          // botones directos
  subsections?: SubSection[];  // subsecciones estándar
  groups?: Group[];            // bloques con subsecciones anidadas (acordeón)
};

/* ======================== DATA ======================== */
const CAPTURA_BASE = (((import.meta as any).env?.VITE_CAPTURA_BASE) || "").replace(/\/+$/, "");
const DDC_PQRSD = (((import.meta as any).env?.VITE_DDC_PQRSD) || "").replace(/\/+$/, "");
const DDC_CALPROC = (((import.meta as any).env?.VITE_DDC_CALPROC) || "").replace(/\/+$/, "");
const DDC_COTEL = (((import.meta as any).env?.VITE_DDC_COTEL) || "").replace(/\/+$/, "");
const DDC_COVRT = (((import.meta as any).env?.VITE_DDC_COVRT) || "").replace(/\/+$/, "");
const DDC_COPR_CAPINS = (((import.meta as any).env?.VITE_DDC_COPR_CAPINS) || "").replace(/\/+$/, "");
const DDC_COPR_STDYPRTC = (((import.meta as any).env?.VITE_DDC_COPR_STDYPRTC) || "").replace(/\/+$/, "");
const DDC_SATEXP_PR = (((import.meta as any).env?.VITE_DDC_SATEXP_PR) || "").replace(/\/+$/, "");
const DDC_SATEXP_CT = (((import.meta as any).env?.VITE_DDC_SATEXP_CT) || "").replace(/\/+$/, "");
const DDC_SATEXP_CV = (((import.meta as any).env?.VITE_DDC_SATEXP_CV) || "").replace(/\/+$/, "");


const DATA: Section[] = [
  {
    title: "Satisfacción y Experiencia",
    groups: [
      {
        title: "Encuesta a la Ciudadanía",
        description: "",
        subsections: [
          {
            title: "",
            items: [
              { label: "Canal Presencial", url: "/external/presencial.html?baseUrl="+encodeURIComponent(DDC_SATEXP_PR) },
            ],
          },
          {
            title: "Canal Virtual",
            items: [
              { label: "Chat", url: "/external/chat.html?baseUrl="+encodeURIComponent(DDC_SATEXP_CV) },
              { label: "Chatico", url: DDC_SATEXP_CV+"&d[/data/mod1/gp0/p0]=2&d[/data/mod1/gp0/p00]=10&d[/data/mod1/gp1/p3]=&d[/data/mod1/gp1/p4]=&d[/data/mod1/gp1/p01]=&d[/data/mod1/gp1/c5]=" },
              { label: "Portales web", url: "/external/portal-web-entidad.html?baseUrl="+encodeURIComponent(DDC_SATEXP_CV) },
              { label: "Bogotá te escucha", url: DDC_SATEXP_CV+"&d[/data/mod1/gp0/p0]=2&d[/data/mod1/gp0/p00]=9&d[/data/mod1/gp1/p3]=&d[/data/mod1/gp1/p4]=&d[/data/mod1/gp1/p01]=&d[/data/mod1/gp1/c5]=" },
            ],
          },
          {
            title: "Canal Telefónico",
            items: [
              { label: "Líneas telefónicas", url: DDC_SATEXP_CT+"&d[/data/mod1/gp0/p0]=3&d[/data/mod1/gp0/p00]=8&d[/data/mod1/gp1/p3]=&d[/data/mod1/gp1/p4]=&d[/data/mod1/gp1/p01]=&d[/data/mod1/gp1/c5]=" },
            ],
          },
        ],
      },
    ],
    items: [],
  },
  {
    title: "Prestación del Servicio",
    items: [
      { label: "Calificación de PQRSD", url: DDC_PQRSD },
      { label: "Calificación de Procesos", url: DDC_CALPROC },
      { label: "Capacidad instalada", url: DDC_COPR_CAPINS+"&d[/data/mod1/gp1/p0]=1" },
    ],
    subsections: [
      {
        title: "Cliente Oculto",
        items: [
          { label: "Canal Presencial", url: DDC_COPR_STDYPRTC+"&d[/data/mod1/gp1/p0]=1" },
          { label: "Canal Virtual", url: DDC_COVRT+"&d[/data/mod1/gp1/p0]=2" },
          { label: "Canal Telefónico", url: DDC_COTEL+"&d[/data/mod1/gp1/p0]=3" },
        ],
      },
    ],
  },
  // NUEVA SECCIÓN para montar el componente de carga de datos
  {
    title: "Carga de datos",
    items: [], // el componente se renderiza directamente, no necesita items
  },
];

/* ======================== UI Helpers ======================== */
function LinkButton({ item, onPqrChange, pqrFuncionarioId, pqrPassword }: { item: LinkItem; onPqrChange?: (id: number | null, password: string) => void; pqrFuncionarioId?: number | null; pqrPassword?: string | null }) {
  const base =
    "w-full rounded-md px-4 py-3 text-left text-sm font-medium transition shadow focus:outline-none focus:ring-2 focus:ring-yellow-300";
  if (!item.url) {
    return (
      <button
        type="button"
        className={`${base} cursor-not-allowed border bg-gray-100 text-gray-400`}
        title="Encuesta no disponible por el momento"
        disabled
      >
        {item.label}
      </button>
    );
  }
  // special case: Calificación de PQRSD -> render the control for PQRSD (select + password)
  if (item.label === "Calificación de PQRSD") {
    return <PqrControl item={item} onPqrChange={onPqrChange} pqrFuncionarioId={pqrFuncionarioId} pqrPassword={pqrPassword} />;
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} border bg-[#D32D37] text-white hover:bg-yellow-400 hover:text-gray-900`}
      title={item.label}
    >
      {item.label}
    </a>
  );
}

function SubSectionBlock({ sub, onPqrChange, pqrFuncionarioId, pqrPassword }: { sub: SubSection; onPqrChange?: (id: number | null, password: string) => void; pqrFuncionarioId?: number | null; pqrPassword?: string | null }) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-gray-700">{sub.title}</h4>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sub.items.map((it) => (
          <LinkButton key={it.label} item={it} onPqrChange={onPqrChange} pqrFuncionarioId={pqrFuncionarioId} pqrPassword={pqrPassword} />
        ))}
      </div>
    </div>
  );
}

function PqrControl({ item, onPqrChange, pqrFuncionarioId, pqrPassword }: { item: LinkItem; onPqrChange?: (id: number | null, password: string) => void; pqrFuncionarioId?: number | null; pqrPassword?: string | null }) {
  const base =
    "w-full rounded-md px-4 py-3 text-left text-sm font-medium transition shadow focus:outline-none focus:ring-2 focus:ring-yellow-300";

  const [open, setOpen] = React.useState(false);
  const [reopenBlocked, setReopenBlocked] = React.useState(false);
  const [funcionarioId, setFuncionarioId] = React.useState<number | null>(pqrFuncionarioId ?? 1);
  const [password, setPassword] = React.useState<string>(pqrPassword ?? "");

  // popup management refs
  const popupRef = React.useRef<Window | null>(null);
  const popupUrlRef = React.useRef<string | null>(null);
  const lastReadableHostRef = React.useRef<string | null>(null);
  const reloadAttemptsRef = React.useRef<number>(0);
  const surveyCompleteProcessingRef = React.useRef<boolean>(false);
  
  // Timeouts refs
  const surveyCloseTimeoutRef = React.useRef<number | null>(null);
  const surveyReopenTimeoutRef = React.useRef<number | null>(null);
  // NUEVO: Ref para el timeout del refresh forzado
  const forceRefreshTimeoutRef = React.useRef<number | null>(null);

  const allowedOrigins = React.useMemo(() => {
    try {
      const origin = new URL(item.url ?? "").origin;
      return [origin, window.location.origin];
    } catch {
      return [CAPTURA_BASE, window.location.origin];
    }
  }, [item.url]);

  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      // validate origin
      if (!allowedOrigins.includes(e.origin)) return;
      const data = e.data;
      if (data && data.type === "PROYECTAMOS_SURVEY_SUBMIT" && Number(data.status) === 201) {
        // When survey completes, show the completion page for a little while, then close and reopen.
        const reloadUrl = popupUrlRef.current ?? buildUrl();
        triggerSurveyCompleteBehavior(reloadUrl);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [allowedOrigins, item.url, funcionarioId, password]);

  const openPopup = (url: string, name?: string) => {
    popupUrlRef.current = url;
    console.log("PQRSD: opening popup to url=", url);
    const popupName = name ?? "pqrPopup";
    popupRef.current = window.open(url, popupName, "width=1024,height=800,scrollbars=yes,resizable=yes");
    if (!popupRef.current) {
      console.warn("PQRSD: window.open returned null — popup may be blocked");
      setReopenBlocked(true);
      return;
    }
    setReopenBlocked(false);
    if (popupRef.current) popupRef.current.focus();
    // reset tracking state
    lastReadableHostRef.current = null;
    reloadAttemptsRef.current = 0;
  };

  const reloadPopup = () => {
    const url = popupUrlRef.current ?? buildUrl();
    if (!popupRef.current || popupRef.current.closed) {
      openPopup(url);
      return;
    }
    try {
      popupRef.current.location.href = url;
      popupRef.current.focus();
    } catch {
      try { popupRef.current.close(); } catch {}
      openPopup(url);
    }
  };

  // Trigger the behavior for survey-complete: show for 3s, close, wait 1s, reopen
  const triggerSurveyCompleteBehavior = (url?: string) => {
    if (surveyCompleteProcessingRef.current) return;
    surveyCompleteProcessingRef.current = true;
    
    // clear previous timeouts if any
    if (surveyCloseTimeoutRef.current) {
      window.clearTimeout(surveyCloseTimeoutRef.current);
      surveyCloseTimeoutRef.current = null;
    }
    if (surveyReopenTimeoutRef.current) {
      window.clearTimeout(surveyReopenTimeoutRef.current);
      surveyReopenTimeoutRef.current = null;
    }
    // NUEVO: Limpiar timeout de refresh si existe
    if (forceRefreshTimeoutRef.current) {
      window.clearTimeout(forceRefreshTimeoutRef.current);
      forceRefreshTimeoutRef.current = null;
    }

    const finalUrl = url ?? popupUrlRef.current ?? buildUrl();
    
    // Wait 3 seconds showing survey-continue, then close the current popup (if any)
    surveyCloseTimeoutRef.current = window.setTimeout(() => {
      try {
        console.log("PQRSD: survey complete detected — closing current popup and preparing to open a new one");
        if (popupRef.current && !popupRef.current.closed) {
          try { popupRef.current.close(); } catch (err) { console.warn('PQRSD: popup close error', err); }
          popupRef.current = null;
        }
      } catch (err) {
        // ignore
      }
    }, 3000);

    // After 1s more, attempt to navigate popup back to survey URL if it still exists, otherwise open a new window
    surveyReopenTimeoutRef.current = window.setTimeout(() => {
      try {
        console.log("PQRSD: reopening popup with finalUrl=", finalUrl);
        // Reset last readable host so periodic polling can resume tracking
        lastReadableHostRef.current = null;
        // Reset reload attempts as this is intentional reopen
        reloadAttemptsRef.current = 0;

        // Attempt to open a new popup (must be a different popup). Use a unique name to ensure a new window.
        try {
          const popupName = `pqrPopup_${Date.now()}`;
          const opened = window.open(finalUrl, popupName, "width=1024,height=800,scrollbars=yes,resizable=yes");
          if (opened) {
            popupRef.current = opened;
            opened.focus();
            setReopenBlocked(false);

            // NUEVO: Lógica experimental para refrescar a los 0.5s
            forceRefreshTimeoutRef.current = window.setTimeout(() => {
              try {
                if (popupRef.current && !popupRef.current.closed) {
                  console.log("PQRSD: Forzando refresh (F5) en el popup...");
                  popupRef.current.location.reload();
                }
              } catch (err) {
                console.warn("PQRSD: No se pudo refrescar el popup automáticamente", err);
              }
            }, 500);

          } else {
            // blocked — set a flag for the UI to show user a manual reopen
            setReopenBlocked(true);
          }
        } catch (err) {
          console.warn('PQRSD: popup reopen attempt failed', err);
          setReopenBlocked(true);
        }
      } finally {
        surveyCompleteProcessingRef.current = false;
      }
    }, 4000);
  };

  // Polling to detect when the popup navigates to a known third-party URL (e.g., google.com) and then force-refresh/reopen.
  React.useEffect(() => {
    let pollId: number | null = null;
    const redirectHosts = ["google.com", "www.google.com"];
    const MAX_RELOAD_ATTEMPTS = 400;
    const RELOAD_COOLDOWN_MS = 15000; 
    function checkPopupLocation() {
      if (!popupRef.current || popupRef.current.closed) {
        // If popup is closed, cancel any survey timeouts & stop processing flag
        if (surveyCloseTimeoutRef.current) {
          window.clearTimeout(surveyCloseTimeoutRef.current);
          surveyCloseTimeoutRef.current = null;
        }
        if (surveyReopenTimeoutRef.current) {
          window.clearTimeout(surveyReopenTimeoutRef.current);
          surveyReopenTimeoutRef.current = null;
        }
        // NUEVO: Limpiar también el refresh forzado si se cierra la ventana
        if (forceRefreshTimeoutRef.current) {
          window.clearTimeout(forceRefreshTimeoutRef.current);
          forceRefreshTimeoutRef.current = null;
        }
        surveyCompleteProcessingRef.current = false;
        return;
      }
      try {
        const href = popupRef.current.location.href;
        if (href) {
          const host = popupRef.current.location.hostname;
          // save accessible host
          lastReadableHostRef.current = host;
          const pathname = popupRef.current.location.pathname || popupRef.current.location.href;
          // If the popup navigated to our survey-continue page (same origin), trigger reopen behavior
          if (String(pathname).includes("survey-continue.html") || String(pathname).includes("survey-complete.html")) {
            // Trigger timed close + reopen
            triggerSurveyCompleteBehavior(popupUrlRef.current ?? buildUrl());
            return; // bail early to avoid extra reload logic
          }
          if (redirectHosts.includes(host)) {
            // Found redirect target — close and re-open (force refresh)
            if (reloadAttemptsRef.current < MAX_RELOAD_ATTEMPTS) {
              reloadAttemptsRef.current += 1;
              try { popupRef.current.close(); } catch {}
              openPopup(popupUrlRef.current ?? buildUrl());
              // cooldown: reset attempts after some time
              setTimeout(() => {
                reloadAttemptsRef.current = 0;
              }, RELOAD_COOLDOWN_MS);
            }
          }
        }
      } catch (err) {
        // reading href/hostname failed due to cross-origin; if we previously could read a host
        // and now we can't, assume the popup navigated to an external origin (e.g. Google)
        if (lastReadableHostRef.current && reloadAttemptsRef.current < MAX_RELOAD_ATTEMPTS) {
          reloadAttemptsRef.current += 1;
          try { popupRef.current?.close(); } catch {}
          openPopup(popupUrlRef.current ?? buildUrl());
          setTimeout(() => {
            reloadAttemptsRef.current = 0;
          }, RELOAD_COOLDOWN_MS);
        }
      }
    }

    // Start polling only while popup exists
    pollId = window.setInterval(() => checkPopupLocation(), 3000);
    return () => {
      if (pollId) window.clearInterval(pollId);
    };
  }, []);

  React.useEffect(() => {
    if (typeof pqrFuncionarioId !== "undefined") setFuncionarioId(pqrFuncionarioId ?? null);
    if (typeof pqrPassword !== "undefined") setPassword(pqrPassword ?? "");
  }, [pqrFuncionarioId, pqrPassword]);

  // clean up any pending timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (surveyCloseTimeoutRef.current) window.clearTimeout(surveyCloseTimeoutRef.current);
      if (surveyReopenTimeoutRef.current) window.clearTimeout(surveyReopenTimeoutRef.current);
      // NUEVO: Limpieza al desmontar
      if (forceRefreshTimeoutRef.current) window.clearTimeout(forceRefreshTimeoutRef.current);
    };
  }, []);

  const buildUrl = () => {
    const id = funcionarioId ?? "";
    const pwd = password ?? "";
    // Build a return_url back to this app so the survey can redirect to a same-origin page
    const parentOrigin = window.location.origin;
    // Use a "non-closing" return URL so the popup isn't auto-closed by the survey page.
    const returnUrl = encodeURIComponent(`${parentOrigin}/survey-complete.html?parent_origin=${encodeURIComponent(parentOrigin)}`);
    return `${item.url}&d[/data/mod1/gv4/v4]=${encodeURIComponent(String(id))}&d[/data/mod1/gv4/v4.1]=${encodeURIComponent(String(pwd))}&return_url=${returnUrl}`;
  };

  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const selectRef = React.useRef<HTMLSelectElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  // close on outside click
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener('mousedown', onDocClick);
    return () => window.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // close on ESC
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // focus select when open
  React.useEffect(() => {
    if (open) {
      setTimeout(() => selectRef.current?.focus(), 100);
    }
  }, [open]);
  
  return (
    <div className="relative w-full">
      <div>
        <button
          type="button"
          ref={buttonRef}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`${base} border bg-[#D32D37] text-white hover:bg-yellow-400 hover:text-gray-900`}
        >
          {item.label}
        </button>
      </div>
      {reopenBlocked ? (
        <div className="mt-2 text-sm text-yellow-700">
          No se pudo abrir automáticamente la ventana emergente. <button
            type="button"
            className="underline font-medium"
              onClick={() => {
                  const url = buildUrl();
                  const newName = `pqrPopup_${Date.now()}`;
                  openPopup(url, newName);
                  setReopenBlocked(false);
                }}
          >Reabrir ahora</button>
        </div>
      ) : null}

      <div
        ref={panelRef}
        role="dialog"
        aria-hidden={!open}
        className="rounded-md border bg-gray-50 p-3 shadow-sm overflow-hidden absolute left-0 z-40"
        style={{
          top: 'calc(100% + 8px)',
          minWidth: '240px',
          width: '100%',
          transform: open ? 'translateY(0)' : 'translateY(-8px)',
          opacity: open ? 1 : 0,
          transition: 'transform 200ms ease, opacity 180ms ease',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <label className="block text-sm font-medium text-gray-700">Funcionario</label>
        <select
          aria-label="Funcionario"
          ref={selectRef}
          value={funcionarioId ?? undefined}
          onChange={(e) => {
            const id = Number(e.target.value) || null;
            setFuncionarioId(id);
            onPqrChange?.(id, password);
          }}
          className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
        >
          <option value={1}>Jairo Rico</option>
          <option value={2}>Sandra Avila</option>
          <option value={3}>Andrés Villamil</option>
        </select>

        <label className="mt-3 block text-sm font-medium text-gray-700">Número de Validación</label>
        <input
          type="password"
          aria-label="Contraseña"
          inputMode="numeric"
          pattern="[0-9]*"
          value={password}
          onChange={(e) => {
            // enforce numeric-only value while storing it as a string
            const val = e.target.value.replace(/\D/g, "");
            setPassword(val);
            onPqrChange?.(funcionarioId, val);
          }}
          className="mt-1 w-full rounded-md border px-2 py-2 text-sm"
          placeholder="*****"
        />

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className={`inline-flex items-center rounded-md border bg-[#D32D37] px-3 py-2 text-sm font-medium text-white hover:bg-yellow-400 hover:text-gray-900 ${!password || !funcionarioId ? "opacity-50 pointer-events-none" : ""}`}
            onClick={() => {
              const url = buildUrl();
              openPopup(url);
              console.log("PQRSD popup open: funcionarioId=", funcionarioId, "password=", password, "url=", url);
            }}
            title="Abrir Encuestas"
          >
            Abrir Encuestas
          </button>

          <button
            type="button"
            className={`inline-flex items-center rounded-md border bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 ${!popupRef.current ? "opacity-70" : ""}`}
            onClick={() => setOpen(false)}
          >
            Cancelar
          </button>
          {/* manual refresh removed by request: the popup will auto-reload when redirect detected */}
        </div>
        {reopenBlocked ? (
          <div className="mt-3 rounded-md border-l-4 border-yellow-400 bg-yellow-50 p-3 text-sm text-yellow-800">
            <div>No se pudo abrir automáticamente la ventana emergente. Haz clic para reabrirla manualmente.</div>
            <div className="mt-2">
              <button
                type="button"
                onClick={() => {
                  const url = buildUrl();
                  const newName = `pqrPopup_${Date.now()}`;
                  openPopup(url, newName);
                  setReopenBlocked(false);
                }}
                className="inline-flex items-center rounded-md border bg-[#D32D37] px-3 py-2 text-sm font-medium text-white hover:bg-yellow-400 hover:text-gray-900"
              >
                Reabrir Ventana
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Acordeón accesible con <details>/<summary>
function GroupAccordion({ group, onPqrChange, pqrFuncionarioId, pqrPassword }: { group: Group; onPqrChange?: (id: number | null, password: string) => void; pqrFuncionarioId?: number | null; pqrPassword?: string | null }) {
  const [open, setOpen] = React.useState(false);

  return (
    <details
      className="mt-4 rounded-xl border bg-white/90 shadow-sm open:shadow-md"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between rounded-xl px-4 py-3 text-base font-semibold text-gray-900
                   [&::-webkit-details-marker]:hidden"
        aria-label={group.title}
      >
        <span>{group.title}</span>
        <span
          aria-hidden="true"
          className={`transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
        >
          <FiChevronDown className="h-5 w-5 text-gray-500" />
        </span>
        <span className="sr-only">{open ? "Contraer" : "Expandir"}</span>
      </summary>

      {group.description ? (
        <p className="mt-1 px-4 text-sm text-gray-600">{group.description}</p>
      ) : null}

      {/* 👇 si el grupo tiene items directos, que los pinte igual que los demás */}
      {group.items?.length ? (
        <div className="mt-3 px-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {group.items.map((it) => (
            <LinkButton key={it.label} item={it} onPqrChange={onPqrChange} pqrFuncionarioId={pqrFuncionarioId} pqrPassword={pqrPassword} />
          ))}
        </div>
      ) : null}

      <div className="px-4 pb-4">
        {group.subsections.map((sub) => (
          <SubSectionBlock key={sub.title} sub={sub} onPqrChange={onPqrChange} pqrFuncionarioId={pqrFuncionarioId} pqrPassword={pqrPassword} />
        ))}
      </div>
    </details>
  );
}


/* ======================== PAGE ======================== */
export default function Captura() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isEntidad = user?.role === "entidad";
  const isAuditor = hasAuditorAccess(user as any);
  const perm = (user as any)?.entidad_perm as "captura_reportes" | "reportes_seguimiento" | null | undefined;

  const allowedLabels = new Set<string>([
    "Grupos Focales (Sistematización)",
    "Calificación de Procesos",
  ]);

  const filteredData: Section[] = React.useMemo(() => {
    if (isAdmin || isAuditor ) return DATA;

    if (isEntidad) {
      // Rol: Seguimiento + Reportes -> puede ver Captura, pero solo ciertas secciones
      if (perm === "reportes_seguimiento") {
        const keepPrestacion = new Set(["Calificación de Procesos", "Capacidad instalada"]);
        return DATA.map((section) => {
          if (section.title === "Satisfacción y Experiencia") {
            return section; // se muestra completa
          }
          if (section.title === "Prestación del Servicio") {
            const items = (section.items ?? []).filter((it) => keepPrestacion.has(it.label));
            return { ...section, items, subsections: [], groups: [] };
          }
          return null;
        })
          .filter((sec): sec is Section => !!sec)
          .filter(
            (sec) =>
              (sec.items && sec.items.length) ||
              (sec.subsections && sec.subsections.length) ||
              (sec.groups && sec.groups.length)
          );
      }

      // Resto de entidades: misma restricción anterior
      return DATA.map((section) => {
        const items = section.items?.filter((it) => allowedLabels.has(it.label)) ?? [];
        const groups = section.groups ?? [];
        const subsections: SubSection[] = [];

        return { ...section, items, groups, subsections };
      }).filter(
        (sec) =>
          (sec.items && sec.items.length) ||
          (sec.subsections && sec.subsections.length) ||
          (sec.groups && sec.groups.length)
      );
    }

    return [];
  }, [isAdmin, isEntidad, isAuditor, perm]);

  const SECTIONS = isAdmin || isAuditor ? DATA : filteredData;

  // PQRSD selection state: store selected funcionario id and password
  const [pqrFuncionarioId, setPqrFuncionarioId] = React.useState<number | null>(1);
  const [pqrPassword, setPqrPassword] = React.useState<string>("");

  const handlePqrChange = (id: number | null, password: string) => {
    setPqrFuncionarioId(id);
    setPqrPassword(password);
  };

  return (
    <PageBg>
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <h1 className="text-2xl font-extrabold text-gray-900 md:text-3xl">Captura de Información</h1>
        <p className="mt-1 text-sm text-gray-600">
          Selecciona el formulario correspondiente. Los enlaces se abrirán en una nueva pestaña.
        </p>

        <div className="mt-6 space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.title} className="rounded-2xl bg-white p-6 shadow-md">
              <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>

              {/* INSERT: sección que monta el componente SkillLoader */}
              {section.title === "Carga de datos" ? (
                <div className="mt-4">
                  <SkillLoader onProcessed={() => {}} />
                </div>
              ) : null}

              {/* Botones directos */}
              {section.items?.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {section.items.map((it) => (
                    <LinkButton key={it.label} item={it} onPqrChange={handlePqrChange} pqrFuncionarioId={pqrFuncionarioId} pqrPassword={pqrPassword} />
                  ))}
                </div>
              ) : null}

              {/* Subsecciones estándar */}
              {section.subsections?.map((sub) => (
                <div key={sub.title} className="mt-6">
                  <h3 className="text-base font-semibold text-gray-700">{sub.title}</h3>

                  {/* botones directos de la subsección (p. ej. "Cliente Oculto") */}
                  {sub.items?.length ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {sub.items.map((it) => (
                        <LinkButton key={it.label} item={it} onPqrChange={handlePqrChange} pqrFuncionarioId={pqrFuncionarioId} pqrPassword={pqrPassword} />
                      ))}
                    </div>
                  ) : null}

                  {/* 👇 subsecciones internas (p. ej. "Sistematización Cliente Oculto") como acordeón */}
                  {sub.subsections?.map((nested) => (
                    <GroupAccordion
                      key={nested.title}
                      group={{
                        title: nested.title,
                        description: undefined,
                        subsections: nested.subsections ?? [],
                        items: nested.items ?? [],
                      }}
                      onPqrChange={handlePqrChange}
                      pqrFuncionarioId={pqrFuncionarioId}
                      pqrPassword={pqrPassword}
                    />
                  ))}
                </div>
              ))}

              {/* NUEVO: Grupos (acordeón) */}
              {section.groups?.map((group) => (
                <GroupAccordion key={group.title} group={group} onPqrChange={handlePqrChange} pqrFuncionarioId={pqrFuncionarioId} pqrPassword={pqrPassword} />
              ))}
            </section>
          ))}
        </div>
      </main>
    </PageBg>
  );
}
