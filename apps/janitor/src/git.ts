import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_CONFIG } from "@framerate/opendb";
import simpleGit, { type SimpleGit } from "simple-git";

/**
 * Las specs de producto en BuildCores OpenDB viven bajo `open-db/<categoria>/<id>.json`
 * (ver `OpenDBClient` en @framerate/opendb). El resto de `.json` del repo (config,
 * schemas, .github) no son productos: solo procesamos lo que cuelga de este prefijo.
 */
const OPENDB_DATA_PREFIX = "open-db/";

function isProductFile(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith(OPENDB_DATA_PREFIX) && trimmed.endsWith(".json");
}

export class OpenDBRepo {
  private git: SimpleGit | null = null;
  private repoPath: string;
  private repoUrl: string;
  /** true cuando el clon lo gestionamos nosotros (dev); false si lo provee git-sync (prod) */
  private selfManaged = false;
  /** El repo OpenDB no está disponible localmente (privado/sin git-sync). Janitor queda inactivo. */
  private unavailableReason: string | null = null;

  constructor(repoPath: string, repoUrl: string = process.env.OPENDB_REPO_URL || DEFAULT_CONFIG.repoUrl) {
    this.repoPath = repoPath;
    this.repoUrl = repoUrl;
  }

  private async pathExists(target: string): Promise<boolean> {
    try {
      await fs.stat(target);
      return true;
    } catch {
      return false;
    }
  }

  /** Motivo por el que el repo no está disponible, o null si está operativo. */
  get unavailable(): string | null {
    return this.unavailableReason;
  }

  /**
   * Idempotente. Devuelve `true` si el repo quedó listo para sincronizar.
   * Resuelve cuatro escenarios:
   *  - ya inicializado -> en clones propios hace `git pull` (en prod lo hace git-sync).
   *  - `.git` presente -> repo gestionado por git-sync (prod). Solo lectura.
   *  - directorio ausente -> intenta clonarlo (dev local). Si falla (repo privado/
   *    sin credenciales) marca el repo como no disponible y janitor queda inactivo.
   *  - directorio presente sin `.git` -> git-sync aún clonando; lanza para reintentar.
   */
  async ensureRepo(): Promise<boolean> {
    if (this.unavailableReason) return false;

    if (this.git) {
      if (this.selfManaged) await this.git.pull();
      return true;
    }

    const hasGit = await this.pathExists(path.join(this.repoPath, ".git", "HEAD"));
    if (hasGit) {
      this.git = simpleGit(this.repoPath);
      this.selfManaged = false;
      return true;
    }

    const dirExists = await this.pathExists(this.repoPath);
    if (dirExists) {
      throw new Error(`OpenDB repo en "${this.repoPath}" aún no está listo (esperando a git-sync). Reintentando...`);
    }

    try {
      await fs.mkdir(path.dirname(path.resolve(this.repoPath)), { recursive: true });
      await simpleGit().clone(this.repoUrl, this.repoPath);
      this.git = simpleGit(this.repoPath);
      this.selfManaged = true;
      return true;
    } catch (error) {
      this.unavailableReason =
        `No se pudo clonar OpenDB desde "${this.repoUrl}" ` +
        "(repo privado o sin credenciales). En producción lo provee el contenedor " +
        "git-sync; en local Janitor queda inactivo. Define OPENDB_PATH a un clon " +
        `existente o OPENDB_REPO_URL accesible para habilitarlo. Detalle: ${
          error instanceof Error ? error.message.split("\n")[0] : String(error)
        }`;
      return false;
    }
  }

  private client(): SimpleGit {
    if (!this.git) {
      throw new Error("OpenDBRepo no inicializado: llama a ensureRepo() primero");
    }
    return this.git;
  }

  async getHeadHash(): Promise<string> {
    return this.client().revparse(["HEAD"]);
  }

  async getChangedFiles(fromHash: string, toHash: string): Promise<string[]> {
    if (fromHash === toHash) return [];
    const diff = await this.client().diff(["--name-only", fromHash, toHash]);
    return diff.split("\n").filter(isProductFile);
  }

  // biome-ignore lint/suspicious/noExplicitAny: payload de git sin tipo
  async getFileContent(filePath: string): Promise<any> {
    const fullPath = path.join(this.repoPath, filePath);
    try {
      const content = await fs.readFile(fullPath, "utf-8");
      return JSON.parse(content);
    } catch (_error: unknown) {
      return null;
    }
  }

  async getBlobHash(filePath: string): Promise<string | null> {
    try {
      const result = await this.client().raw(["ls-tree", "HEAD", filePath]);
      // output format: 100644 blob <hash>\t<file>
      const match = result.match(/blob\s+([0-9a-f]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  async getAllFiles(ref: string = "HEAD"): Promise<string[]> {
    try {
      const result = await this.client().raw(["ls-tree", "-r", "--name-only", ref]);
      return result.split("\n").filter(isProductFile);
    } catch {
      return [];
    }
  }
}
