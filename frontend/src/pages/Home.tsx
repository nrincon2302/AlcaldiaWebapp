import React from "react";
import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="relative min-h-screen w-full">
      {/* Imagen de fondo */}
      <img
        src="/images/slider-bogota-3-optimized.jpg"
        alt="Panorámica de Bogotá"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Overlay para contraste */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Header con logo (ocupa espacio visual arriba en mobile) */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-full justify-between px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6">
           <img
              src="/images/logo-bgt-casa.png"
              alt="Alcaldía Mayor de Bogotá"
              className="h-9 w-auto opacity-95 sm:h-12 md:h-20"
            />
          <Link
            to="https://bogota.gov.co"
            target="_blank"
            rel="noreferrer"
            aria-label="Alcaldía Mayor de Bogotá"
            className="inline-block"
          >
            <img
              src="/images/logo-blanco-bta.png"
              alt="Alcaldía Mayor de Bogotá"
              className="h-9 w-auto opacity-95 sm:h-12 md:h-20"
            />
          </Link>
        </div>
      </header>

      {/* Contenido (hero) 
          pt-20/24 en mobile para no chocar con el header; en desktop se anula */}
      <div className="relative z-10 mx-auto flex max-w-6xl items-center px-4 pt-32 pb-10">
        <div className="max-w-3xl">
          {/* Caja translúcida para legibilidad */}
          <div className="rounded-2xl bg-white/10 p-6 backdrop-blur-sm shadow-lg ring-1 ring-white/20">
            <h1 className="text-3xl font-extrabold leading-tight text-white drop-shadow md:text-4xl">
              ¡Bienvenido a la herramienta que transformará la calidad del servicio en Bogotá!
            </h1>

            <p className="mt-4 text-base leading-relaxed text-white/90 md:text-lg">
              Con este sistema, la Secretaría General de la Alcaldía Mayor puede medir de manera automática y precisa la
              satisfacción de los ciudadanos en todos los canales de atención: presencial, virtual y telefónico.
              <br />
              Captura datos clave, genera reportes detallados y permite realizar seguimiento a los planes de mejora para garantizar un
              servicio público más eficiente, transparente y cercano a la ciudadanía.
            </p>

            {/* CTA */}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="rounded-md bg-yellow-400 px-5 py-2.5 font-semibold text-black shadow hover:bg-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2"
              >
                Ingresar
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Degradado inferior sutil */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />
    </div>
  );
}
