import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_CONFIG, type OpenDBConfig } from "./types";

export class OpenDBClient {
  private config: OpenDBConfig;

  constructor(config: Partial<OpenDBConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public async sync() {
    if (existsSync(join(this.config.localPath, ".git"))) {
      console.log("Pulling latest changes...");
      execSync("git pull", { cwd: this.config.localPath, stdio: "inherit" });
    } else {
      console.log("Cloning repository...");
      // Ensure parent directory exists
      if (!existsSync(this.config.localPath)) {
        mkdirSync(this.config.localPath, { recursive: true });
      }

      // If directory exists but is empty or not a git repo, we might need to handle it.
      // For now, assuming if it exists and has .git it's good, otherwise clone into it.
      // If it exists and is not empty but no .git, git clone will fail.
      // Let's just try to clone if .git doesn't exist.

      // If the directory exists, we should probably clear it or check if it's empty.
      // But git clone <url> . works if directory is empty.

      execSync(`git clone ${this.config.repoUrl} .`, {
        cwd: this.config.localPath,
        stdio: "inherit",
      });
    }
  }

  public getCategories(): string[] {
    const dbPath = join(this.config.localPath, "open-db");
    if (!existsSync(dbPath)) {
      throw new Error("OpenDB not found. Run sync() first.");
    }
    return readdirSync(dbPath).filter((item) => !item.startsWith("."));
  }

  public getItems<T = any>(category: string): T[] {
    const categoryPath = join(this.config.localPath, "open-db", category);
    if (!existsSync(categoryPath)) {
      return [];
    }

    const files = readdirSync(categoryPath).filter((f) => f.endsWith(".json"));
    return files.map((file) => {
      const content = readFileSync(join(categoryPath, file), "utf-8");
      return JSON.parse(content);
    });
  }
}
