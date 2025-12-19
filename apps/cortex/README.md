Cortex — background worker that processes `ai_extraction_jobs` from Supabase and calls LLMs to extract specs.

Usage

- Set env variables: `SUPABASE_URL`, `SUPABASE_KEY` (service role), optional `CORTEX_BATCH_SIZE`, `CORTEX_POLL_INTERVAL_MS`.
- Dev: `bun run dev`
- Start: `bun start`

Notes

- This is a minimal scaffold. `src/worker.ts` currently writes a stub `result` and marks jobs as completed. Replace with strategies + LLM client when ready.
