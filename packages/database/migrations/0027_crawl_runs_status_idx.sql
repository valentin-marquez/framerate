-- La frescura del catálogo (`max(finished_at) WHERE status = ?`) corre en cada MISS y recorría la tabla entera (#169).
CREATE INDEX crawl_runs_status_finished_idx ON crawl_runs (status, finished_at);
