---
applyTo: "apps/web/**"
---
# Web Application Guidelines (apps/web)

Architectural principles and coding standards for the Framerate.cl frontend.

## 1. Architecture Overview
- **Framework**: React Router v7.
- **Deployment**: Cloudflare Workers (edge-first).
- **Rendering Strategy**: Server-Side Rendering (SSR) at the Edge.
- **Language**: TypeScript.
- **Styling**: Tailwind CSS v4.

## 2. Data Access & Security
- **Data Fetching**: Use React Router `loaders` for server-side data fetching.
- **Mutations**: Use React Router `actions` for form submissions and data mutations.
- **No direct database access**: the frontend never touches D1; everything goes through the API.
- **API Gateway**: All data fetching must go through the v2 API (`apps/server`, `/v1/*`), typed with `@framerate/contracts`.
- **Credentials**: Do not store any secrets or API keys with write access in the frontend code.

## 3. Project Structure & Modularization
- **Routing**: File-based routing using React Router v7 conventions (`routes.ts` or `app/routes/`).
- **Shared types**: use the schemas and types from `@framerate/contracts`.
- **Component Design**: Follow atomic design principles or feature-based folder structure.
- **Lazy Loading**: Implement lazy loading for routes and heavy components to optimize initial load time.

## 4. Performance Optimization
- **SEO**: product and category pages carry dynamic meta tags and JSON-LD structured data.
- **Edge Caching**: Leverage Cloudflare's caching capabilities for static assets and API responses where appropriate.
- **Images**:
    - Use thumbnails for initial views.
    - Load full-size images only upon user interaction.
    - Future-proof for Cloudflare Images integration.
- **State Management**: Keep state local where possible; use URL search params for filter state (shareable URLs).

## 5. Development Workflow
- **Linting & Formatting**: Adhere to the project's BiomeJS configurations.
- **Testing**: Write unit tests for utility functions and critical components.

## 6. Key Principles
- **Separation of Concerns**: Presentation logic only. Business logic should reside in the API or shared packages where appropriate.
- **User Experience**: Prioritize speed and responsiveness (Core Web Vitals).
- **Interactividad**: Focus on fast, client-side filtering and comparison features while maintaining SSR benefits.

## 7. Directrices de Diseño y UI (Estética macOS)

### 7.1. Filosofía de "Capas y Superficies"

Para replicar el look de macOS, no usamos un solo color de fondo. Estructuramos la interfaz en niveles de profundidad:

* **Nivel 0 (Base - `bg-background`):** Un gris/azul casi imperceptible. Se usa para el fondo de la página.
* **Nivel 1 (Superficie - `bg-card`):** Blanco puro (en Light Mode) o gris oscuro elevado (en Dark Mode). Se usa para contenedores, secciones y cards que deben resaltar sobre el fondo.
* **Nivel 2 (Interacción - `bg-secondary`):** Se usa para elementos que "viven" dentro de las superficies (inputs, botones secundarios, botones de control).

### 7.2. Sistema de Botones y Estados Dinámicos

Adoptamos el patrón de **"Estado Pasivo Sutil → Estado Activo Fuerte"**.

* **Uso Preferente de Secondary:** La mayoría de las acciones deben usar la variante `secondary`.
* **Comportamiento de Botón:**
* **Normal:** `bg-secondary/30 text-secondary-foreground/65`. El botón se funde con el fondo, manteniendo una legibilidad discreta.
* **Hover/Active:** `hover:bg-primary hover:text-primary-foreground`. Al interactuar, el botón reclama atención total transformándose en el color de marca.
* **Aria-Expanded:** Cuando un menú está abierto, el gatillo debe mantener el estado de `primary` para indicar el foco actual.


### 7.3. Reglas de Color y Opacidad (OKLCH)

* **Light Mode (Pureza):** Abuso intencionado del blanco y transparencias bajas. Los bordes deben ser `border-border/40` para que parezcan dibujados con un lápiz fino.
* **Dark Mode (Profundidad):** No usar negro puro (#000) para superficies, sino los tokens oklch de `apps/web/app/shared/styles/app.css`. La profundidad se da subiendo ligeramente la luminosidad en cada capa superior.
* **Translucidez (Glassmorphism):** Lo que flote (paneles de modales, tooltips, dropdowns) lleva `backdrop-blur-md` y fondo entre 70% y 85% de opacidad. El velo del diálogo va sin desenfoque (`bg-black/50`) y sin fundido: ver `apps/web/CLAUDE.md`.

### 7.4. Radios de Borde (The Squircle Rule)

Siguiendo el estilo de Apple, los radios no son lineales:

* **Inputs/Botones pequeños:** `rounded-md` (0.5rem).
* **Cards de contenido:** `rounded-xl` o `rounded-2xl` (1.5rem).
* **Modales/Grandes contenedores:** `rounded-3xl` (2rem).

### 7.5. Tipografía y Espaciado

* **Tracking:** Usar `tracking-tight` en títulos para un look premium.
* **Contraste Muted:** Para textos explicativos o secundarios, usar siempre `text-muted-foreground` en lugar de bajar la opacidad manualmente, para mantener la accesibilidad.
