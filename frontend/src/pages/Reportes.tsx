import React from "react";
import Header from "../components/Header";
import ResponsiveIframe from "../components/ResponsiveIframe";
import PageBg from "../components/PageBackground";

/**
 * Enlace de prueba (Shiny público). Puedes sustituirlo por tu URL oficial cuando la recibas.
 */
const SHINY_URL = "https://modeloserviciociudadania.shinyapps.io/Dashboard-Shiny";

export default function Reportes() {
  return (
     <PageBg >
      <Header />
      <main className="mx-auto p-4">
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Reportes</h1>
            <a href={SHINY_URL} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
              Abrir en pestaña nueva
            </a>
          </div>
          <ResponsiveIframe
            src={SHINY_URL}
            title="Shiny embebido"
            minHeight={760}
            allow="clipboard-write; fullscreen; download; allow-downloads"
            sandbox="allow-same-origin allow-scripts allow-forms allow-downloads"
          />
          <p className="mt-3 text-xs text-gray-500">
            * Si no se visualiza, ábrelo en una ventana nueva.
          </p>
        </div>
      </main>
     </PageBg >
  );
}
