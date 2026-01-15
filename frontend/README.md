# 🎨 Plan de Acción — Frontend (React + Vite + Tailwind)

SPA que consume la API FastAPI **únicamente para la sección de Seguimiento**.  
Las secciones **Captura** y **Reportes** funcionan como accesos a herramientas externas (encuestas y Shiny).

**Backend PROD**: https://fastapi-back-600959037813.us-east1.run.app

---

## 🧱 Stack
- React + Vite (TypeScript)
- Tailwind CSS
- React Router DOM
- Fetch API con JWT

---

## 🧭 Flujo real del sistema (para nuevos devs)

```
Captura (links) ──▶ Encuestas externas
                         │
                         ▼
Seguimiento (frontend) ─▶ FastAPI ─▶ DB
                         │
                         ▼
Reportes (Shiny)
```

---

## 🧩 Responsabilidad por sección

### 📝 Captura (Encuestas)
- Esta app **NO captura datos** ni guarda respuestas.
- La pantalla de Captura **solo muestra links/cards** a encuestas externas.

**Archivos responsables**
- `src/pages/Captura.tsx`  
  Renderiza las cards/botones con enlaces a:
  - Encuesta a la ciudadanía
  - Grupos focales

👉 No consume API  
👉 No persiste información

---

### 📊 Seguimiento (NÚCLEO DEL SISTEMA)
- Aquí vive toda la lógica real del sistema.
- Consume la API FastAPI (`/seguimiento`).

**Archivos principales**
- `src/pages/SeguimientoPage.tsx`  
  Página principal del módulo de seguimiento.
- `src/components/seguimiento/useSeguimientos.tsx`  
  Hook central: fetch a la API, estado global, CRUD.
- `src/components/seguimiento/PlanesSidebar.tsx`  
  Lista y selección de planes.
- `src/components/seguimiento/SeguimientoForm.tsx`  
  Crear / editar seguimiento.
- `src/components/seguimiento/SeguimientosTimeline.tsx`  
  Historial visual de seguimientos.
- `src/components/seguimiento/SeguimientoTabs.tsx`  
  Navegación entre vistas del plan.
- `src/components/seguimiento/exporters.ts`  
  Exportación a CSV / XLSX / PDF (desde el frontend).

👉 Si algo falla en la lógica del sistema, casi siempre está aquí.

---

### 📄 Reportes (Shiny)
- El frontend **no genera reportes**.
- Esta sección **solo muestra Shiny** (iframe o link).

**Archivos responsables**
- `src/pages/Reportes.tsx`  
  Renderiza el iframe de Shiny.
- `src/components/ResponsiveIframe.tsx`  
  Iframe responsivo con manejo de carga.

👉 No consume la API  
👉 No procesa datos

---

### 🔐 Autenticación y API
**Archivos clave**
- `src/context/AuthContext.tsx` — usuario, rol y token.
- `src/lib/api.ts` — helper fetch con Bearer token.
- `src/lib/auth.ts` — utilidades de autenticación.

---

## 📂 Estructura del repo
```
.
├─ public/
├─ src/
├─ .env.development
├─ .env.production
├─ index.html
├─ package.json
├─ tailwind.config.js
├─ postcss.config.js
├─ tsconfig.json
└─ vite.config.ts
```

---

## ✅ Requisitos
- Node.js 18+
- npm 9+ (o PNPM/Yarn)

---

## 🚀 Setup local

1) Clonar e instalar
```bash
git clone https://github.com/nedo8680/plan-accion-front-end.git
cd plan-accion-front-end
npm i
```

2) Variables de entorno
```env
VITE_API_URL=http://localhost:8000
```

3) Ejecutar
```bash
npm run dev
```

---

## 🧪 Prueba rápida
1. Backend activo
2. Front en local
3. Login → Seguimiento → crear Plan → crear Seguimiento

---

## 📄 Licencia
MIT
