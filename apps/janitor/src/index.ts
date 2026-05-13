import { Logger } from "@framerate/utils";
import { createClient } from "@supabase/supabase-js";
import { OpenDBRepo } from "./git";

const logger = new Logger("Janitor");

// Configuration
const OPENDB_PATH = process.env.OPENDB_PATH || "./opendb";
const SYNC_INTERVAL_MS = 60 * 1000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  logger.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  logger.info("Starting Janitor Service...");
  logger.info(`Monitoring OpenDB at: ${OPENDB_PATH}`);

  const repo = new OpenDBRepo(OPENDB_PATH);

  // Initial Sync or Resume
  while (true) {
    try {
      await sync(repo);
    } catch (error) {
      logger.error("Sync failed", error);
    }
    await new Promise((resolve) => setTimeout(resolve, SYNC_INTERVAL_MS));
  }
}

async function sync(repo: OpenDBRepo) {
  const currentHead = await repo.getHeadHash();

  // Get last synced commit from the most recently updated record
  // Idealmente deberíamos tener una tabla de estado global, pero usaremos el último commit hash visto.
  // Warning: This assumes all records are updated to the same commit.
  // If a partial sync happened, we might miss things.
  // BUT: The logic is to diff (Last -> Current).

  const { data: lastSynced } = await db
    .from("products_canonical")
    .select("git_commit_hash")
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .single();

  const lastHash = lastSynced?.git_commit_hash;

  if (lastHash === currentHead) {
    return;
  }

  logger.info(`Detected change: ${lastHash || "Initial"} -> ${currentHead}`);

  let filesToProcess: string[] = [];

  if (!lastHash) {
    logger.info("Performing full initial sync...");
    filesToProcess = await repo.getAllFiles(currentHead);
  } else {
    filesToProcess = await repo.getChangedFiles(lastHash, currentHead);
  }

  logger.info(`Processing ${filesToProcess.length} files...`);

  let batch = [];
  const BATCH_SIZE = 50;

  for (const file of filesToProcess) {
    const content = await repo.getFileContent(file);
    const blobHash = await repo.getBlobHash(file);

    // Derived ID from filename (remove .json) or content?
    // User said "matches OpenDB JSON filename/UUID".
    // Assuming filename is the UUID.json
    const id = file.replace(".json", "").split("/").pop();

    if (!id) continue;

    if (content === null) {
      // Deletion
      logger.info(`Marking deleted: ${id}`);
      await db
        .from("products_canonical")
        .update({
          is_deleted: true,
          archived_at: new Date().toISOString(),
          git_commit_hash: currentHead,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", id);
    } else {
      // Upsert
      batch.push({
        id: id,
        specifications: content,
        git_commit_hash: currentHead,
        git_blob_hash: blobHash,
        last_synced_at: new Date().toISOString(),
        is_deleted: false,
        archived_at: null,
      });
    }

    if (batch.length >= BATCH_SIZE) {
      const { error } = await db.from("products_canonical").upsert(batch);
      if (error) logger.error("Batch upsert failed", error);
      batch = [];
    }
  }

  if (batch.length > 0) {
    const { error } = await db.from("products_canonical").upsert(batch);
    if (error) logger.error("Final batch upsert failed", error);
  }

  logger.info(`Sync complete. Head is now ${currentHead}`);
}

main().catch((e) => logger.error("Fatal error", e));
