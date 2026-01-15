import React from "react";
import type { Seguimiento } from "./useSeguimientos";

type Props = {
  items: Seguimiento[];
  activeId?: number | null;
  onSelect: (id: number) => void;
  onAdd?: () => void;
  onDelete?: () => void;       // borrar seguimiento activo
  onDeletePlan?: () => void;   // borrar plan activo
  canAdd?: boolean;
  canDelete?: boolean;
  canDeletePlan?: boolean;
  hideActions?: boolean;
};

export default function SeguimientoTabs({
  items,
  activeId,
  onSelect,
  onAdd,
  onDelete,
  onDeletePlan,
  canAdd = false,
  canDelete = false,
  canDeletePlan = false,
  hideActions = false,        
}: Props) {
  const hasItems = items.length > 0;

  return (
    <div className="w-full">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        {/* Izquierda: tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {!hasItems ? (
            <span className="text-sm text-gray-500">Sin seguimientos</span>
          ) : (
            items.map((s, idx) => {
              const id = s.id!;
              const isActive = id === activeId;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelect(id)}
                  className={[
                    "rounded-full px-3 py-1 text-sm transition",
                    isActive
                      ? "bg-blue-600 text-white shadow"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                  ].join(" ")}
                >
                  {`Seguimiento ${idx + 1}`}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
