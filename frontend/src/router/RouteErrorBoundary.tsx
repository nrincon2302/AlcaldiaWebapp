import React from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";

export default function RouteErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md w-full bg-white shadow rounded-2xl p-6">
          <h1 className="text-xl font-semibold mb-2">
            {error.status} {error.statusText}
          </h1>
          {error.data && (
            <p className="text-sm text-gray-600">
              {typeof error.data === "string" ? error.data : JSON.stringify(error.data)}
            </p>
          )}
          <button
            onClick={() => (window.location.href = "/")}
            className="mt-4 px-3 py-2 rounded-lg bg-gray-900 text-white"
          >
            Ir al inicio
          </button>
        </div>
      </div>
    );
  }
  const message =
    error instanceof Error ? error.message : "Ha ocurrido un error inesperado.";
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-md w-full bg-white shadow rounded-2xl p-6">
        <h1 className="text-xl font-semibold mb-2">Ups…</h1>
        <p className="text-sm text-gray-600">{message}</p>
        <button
          onClick={() => (window.location.href = "/")}
          className="mt-4 px-3 py-2 rounded-lg bg-gray-900 text-white"
        >
          Ir al inicio
        </button>
      </div>
    </div>
  );
}