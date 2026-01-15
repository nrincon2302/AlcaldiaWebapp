import React from "react";

type Props = {
  children: React.ReactNode;
  overlay?: string; // ej: "bg-white/70"
};

export default function PageBg({ children }: Props) {
  return (
    <div className="relative min-h-screen">
      <img
        src="/images/fondo-app.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      {/* Overlay para contraste del contenido */}
      <div className={`absolute inset-0}`} aria-hidden="true" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}