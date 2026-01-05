export interface OpenDBConfig {
  repoUrl: string;
  localPath: string;
}

export const DEFAULT_CONFIG: OpenDBConfig = {
  repoUrl: "https://github.com/buildcores/buildcores-open-db.git",
  localPath: "./tmp/opendb",
};
