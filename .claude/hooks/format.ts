// PostToolUse (Edit|Write): formatea con Biome el archivo tocado, así el pre-commit no rechaza por formato.
const input = await Bun.stdin.json();
const path: string = input.tool_input?.file_path ?? "";
if (!/\.(ts|tsx|json|jsonc)$/.test(path)) process.exit(0);

Bun.spawnSync(["bunx", "biome", "format", "--write", path], { cwd: process.env.CLAUDE_PROJECT_DIR });
