---
applyTo: "apps/tracker/**"
---

# Tracker Service Guidelines (apps/tracker)

This document outlines the architecture, responsibilities, and coding standards for the Price Tracker service.

## 1. Role & Responsibility
- **High-Frequency Monitor**: This service is responsible for updating **Price** and **Stock** status of *existing* products.
- **Lightweight Execution**: Unlike the Scraper, this service must be extremely fast and resource-efficient.
- **No Discovery**: It does NOT look for new products or extract complex specifications. It only validates the current state of known URLs.
- **REST API**: It operates as a web service (ElysiaJS) triggered via HTTP endpoints (e.g., by a Cron job), not as a standalone long-running process.

## 2. Tech Stack & Architecture
- **Runtime**: Bun (v1.1+).
- **Framework**: **ElysiaJS** for high-performance HTTP handling and type safety.
- **Database**: Connects directly to Supabase using `postgres` or `@supabase/supabase-js`.
- **Parsing**: Uses **native `fetch`** combined with lightweight parsers like `cheerio` or `HTMLRewriter`.

## 3. Workflow
### 3.1 The Tracking Loop
1.  **Trigger**: External system calls `POST /track/batch`.
2.  **Fetch Batch**: Service queries DB for `N` listings ordered by `last_scraped_at ASC`.
3.  **Process (Parallel)**:
    - Execute concurrent HTTP GET requests to target URLs.
    - Parse HTML text to extract `price` (number) and `stock` (boolean).
4.  **Upsert**:
    - If price changes: Insert into `price_history` and update `listings`.
    - Always: Update `last_scraped_at`.
5.  **Response**: Return JSON stats (processed, errors, updated).

### 3.2 Strategy Pattern
- Implement a `BaseTracker` interface/abstract class.
- Each store (e.g., `PcExpressTracker`, `SpDigitalTracker`) implements `track(url: string): Promise<Result>`.
- The service selects the correct tracker based on the URL domain.

## 4. Best Practices & Rules
- **STRICTLY NO BROWSERS**: Do **not** use Puppeteer, Playwright, or Selenium. If a site requires JS rendering, it belongs in the `apps/scraper`, not here.
- **Fail Gracefully**: Network timeouts or 404s must not crash the batch. Log the error, flag the listing if necessary, and continue.
- **Shared Types**: Import database types from `@framerate/db`. Do not redefine DB interfaces manually.
- **Environment**: Use `SUPABASE_SERVICE_ROLE_KEY` for database connection (backend-to-backend trust).

## 5. Directory Structure
- `src/index.ts`: Entry point (Elysia server definition).
- `src/routes/`: API route handlers (`/track`, `/health`).
- `src/domain/trackers/`: Store-specific implementations (e.g., `pcexpress.ts`).
- `src/services/`: Core logic (Batch processing, DB interaction).
- `src/config/`: Environment variables and constants.