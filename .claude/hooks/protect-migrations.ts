// PreToolUse (Edit|Write): una migración ya commiteada puede estar aplicada en D1 remoto; cambiarla deja la base
// distinta de lo que dice el repo. Se crea una migración nueva en su lugar.
const input = await Bun.stdin.json();
const path: string = (input.tool_input?.file_path ?? "").replaceAll("\\", "/");
if (!/packages\/database\/migrations\/[^/]+\.sql$/.test(path)) process.exit(0);

const tracked = Bun.spawnSync(["git", "ls-files", "--error-unmatch", path], { cwd: process.env.CLAUDE_PROJECT_DIR });
if (tracked.exitCode !== 0) process.exit(0);

console.error(
  `Bloqueado: ${path} ya está commiteada y puede estar aplicada en producción. Crea una migración nueva con el ` +
    "siguiente número. Si de verdad no se aplicó en remoto, pídele al dueño que la edite él.",
);
process.exit(2);
