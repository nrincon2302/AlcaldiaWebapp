import React, { useEffect, useMemo, useRef, useState } from "react";
import Spinner from "./Spinner";

type Props = React.IframeHTMLAttributes<HTMLIFrameElement> & {
  minHeight?: number | string;
  /** ms to show an error hint if not loaded */
  timeoutMs?: number;
  /** Optional message shown if it takes too long */
  slowHint?: string;
};

export default function ResponsiveIframe({
  minHeight = 720,
  timeoutMs = 12000,
  slowHint = "Tarda en cargar. Si no aparece, ábrelo en pestaña nueva.",
  ...rest
}: Props) {
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [ts, setTs] = useState(Date.now()); // bust key on retry
  const src = String(rest.src || "");

  // Reset loading when src changes
  useEffect(() => {
    setLoading(true);
    setErrored(false);
  }, [src]);

  // Timeout to show hint/error
  useEffect(() => {
    if (!loading) return;
    const id = setTimeout(() => setErrored(true), timeoutMs);
    return () => clearTimeout(id);
  }, [loading, timeoutMs]);

  const onLoad = () => setLoading(false);
  const onError = () => { setErrored(true); setLoading(false); };

  const retry = () => {
    // re-trigger iframe render to force reload
    setTs(Date.now());
    setLoading(true);
    setErrored(false);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Loader overlay */}
      {(loading || errored) && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-sm">
          <Spinner label={loading ? "Cargando contenido…" : "No se pudo cargar"} />
          {errored && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-gray-600 text-center px-4">{slowHint}</p>
              <button onClick={retry} className="btn-outline text-xs">Reintentar</button>
            </div>
          )}
        </div>
      )}

      {/* Skeleton placeholder height */}
      <div className={`h-[70vh] w-full ${rest.className ?? ""}`} style={{ minHeight, ...(rest.style || {}) }}>
        <iframe
          key={ts}
          {...rest}
          className="h-full w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox={rest.sandbox || "allow-same-origin allow-scripts allow-forms allow-popups"}
          onLoad={onLoad}
          onError={onError}
          title={rest.title || "Contenido embebido"}
        />
      </div>
    </div>
  );
}
