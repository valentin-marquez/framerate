---
applyTo: "apps/scraper/**"
---
# Framerate.cl - Scraper Guidelines

## Tech Stack
- **Runtime:** Bun
- **Concurrency:** Bun Workers
- **Database:** Supabase (Service Role Key)

## Architecture Principles
- **Isolation:** Operates in a local/isolated environment. No public API exposure.
- **Write Access:** This is the ONLY component authorized to write to the database (using Service Role Key).
- **Incremental Updates:** Only update records if data (price, stock, URL) has changed.

## Design Patterns
- **BaseCrawler:** All store scrapers must inherit from the abstract `BaseCrawler` class.
- **Strategy Pattern:** Implement store-specific logic (selectors) as strategies.
- **Worker-Based:** Use Bun Workers for executing scraping jobs in background threads.
- **Fingerprinting:** Use the multi-layer matching algorithm (MPN -> EAN -> Specs Fingerprint) for product matching.

## Resilience & Quality
- **Circuit Breaker:** Implement cooldowns for failing stores.
- **Error Handling:** Log worker errors and terminate failing workers gracefully.
- **Normalization:** Convert prices to numbers, clean text, and validate specs before storage.
- **User-Agent:** Rotate User-Agents and manage proxies.
