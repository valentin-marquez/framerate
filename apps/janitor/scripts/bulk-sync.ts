/**
 * Carga bulk de OpenDB en `products_canonical`.
 *
 * El `sync()` del janitor hace una llamada `git` por archivo — inviable para la
 * carga inicial de ~45k productos (~30h). Este script hace lo mismo pero
 * batcheado, con lecturas en paralelo y sin la llamada git por archivo.
 *
 * Mapeo: cada archivo es `open-db/<Categoria>/<opendb_id>.json`. Se guarda
 * `id` = opendb_id, y `specifications` = el contenido del archivo + `category`
 * inyectada desde la carpeta (la estructura real de OpenDB NO trae la categoría
 * adentro del JSON; viene del path).
 *
 * Uso (desde la raíz del repo):
 *   bun run --cwd apps/janitor bulk-sync
 *
 * Requiere SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y un clon de OpenDB en
 * `OPENDB_PATH` (default `./opendb`).
 */
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { Logger } from "@framerate/utils";
import { createClient } from "@supabase/supabase-js";
import { Glob } from "bun";

const logger = new Logger("BulkSync");

const REPO = process.env.OPENDB_PATH || "./opendb";
const DATA_DIR = `${REPO}/open-db`;
const BATCH = 500;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  logger.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const head = execSync("git rev-parse HEAD", { cwd: REPO }).toString().trim();
logger.info(`OpenDB HEAD: ${head}`);

const files: string[] = [];
for await (const f of new Glob("**/*.json").scan(DATA_DIR)) files.push(f);
logger.info(`Archivos OpenDB: ${files.length}`);

const now = new Date().toISOString();
let inserted = 0;
let failed = 0;

for (let i = 0; i < files.length; i += BATCH) {
  const chunk = files.slice(i, i + BATCH);
  const rows = await Promise.all(
    chunk.map(async (rel) => {
      try {
        const parts = rel.split(/[/\\]/);
        const category = parts[0]; // open-db/<Categoria>/<id>.json → carpeta
        const id = parts[parts.length - 1].replace(/\.json$/, "");
        if (!id || !category) return null;
        const content = JSON.parse(await readFile(`${DATA_DIR}/${rel}`, "utf-8"));
        // `category` se inyecta en specifications: la estructura real de OpenDB
        // no la trae adentro, viene del path, y el resolver la necesita.
        return {
          id,
          specifications: { ...content, category },
          git_commit_hash: head,
          git_blob_hash: null,
          last_synced_at: now,
          is_deleted: false,
          archived_at: null,
        };
      } catch {
        return null;
      }
    }),
  );
  const valid = rows.filter((r): r is NonNullable<typeof r> => r !== null);
  const { error } = await db.from("products_canonical").upsert(valid);
  if (error) {
    logger.error(`Batch ${i}: ${error.message}`);
    failed += valid.length;
  } else {
    inserted += valid.length;
  }
}

logger.info(`Bulk sync completo. insertados=${inserted} fallidos=${failed}`);
