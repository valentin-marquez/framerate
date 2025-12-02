---
applyTo: "apps/web/**"
---
# Web Application Guidelines (apps/web)

This document outlines the architectural principles and coding standards for the frontend application of Framerate.cl, based on the technical architecture document.

## 1. Architecture Overview
- **Framework**: React Router v7.
- **Deployment**: Cloudflare Pages (Edge-First).
- **Rendering Strategy**: Server-Side Rendering (SSR) at the Edge.
- **Language**: TypeScript.
- **Styling**: Tailwind CSS v4.

## 2. Data Access & Security
- **Data Fetching**: Use React Router `loaders` for server-side data fetching.
- **Mutations**: Use React Router `actions` for form submissions and data mutations.
- **No Direct Database Access**: The frontend MUST NEVER access the Supabase database directly.
- **API Gateway**: All data fetching must go through the public API exposed by Cloudflare Workers (`apps/api`).
- **Credentials**: Do not store any secrets or API keys with write access in the frontend code.

## 3. Project Structure & Modularization
- **Routing**: File-based routing using React Router v7 conventions (`routes.ts` or `app/routes/`).
- **Shared Types**: Use types defined in `packages/db` and `packages/utils` to ensure consistency.
- **Component Design**: Follow atomic design principles or feature-based folder structure.
- **Lazy Loading**: Implement lazy loading for routes and heavy components to optimize initial load time.

## 4. Performance Optimization
- **SEO**: Critical priority. Ensure all product and category pages have dynamic meta tags and structured data (JSON-LD).
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

