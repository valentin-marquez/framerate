import fs from "node:fs/promises";
import path from "node:path";
import simpleGit, { type SimpleGit } from "simple-git";

export class OpenDBRepo {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  async getHeadHash(): Promise<string> {
    return this.git.revparse(["HEAD"]);
  }

  async getChangedFiles(fromHash: string, toHash: string): Promise<string[]> {
    if (fromHash === toHash) return [];
    const diff = await this.git.diff(["--name-only", fromHash, toHash]);
    return diff.split("\n").filter((line: string) => line.trim() !== "" && line.endsWith(".json"));
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
      const result = await this.git.raw(["ls-tree", "HEAD", filePath]);
      // output format: 100644 blob <hash>\t<file>
      const match = result.match(/blob\s+([0-9a-f]+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  async getAllFiles(ref: string = "HEAD"): Promise<string[]> {
    try {
      const result = await this.git.raw(["ls-tree", "-r", "--name-only", ref]);
      return result.split("\n").filter((line: string) => line.trim() !== "" && line.endsWith(".json"));
    } catch {
      return [];
    }
  }
}
