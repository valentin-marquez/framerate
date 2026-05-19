const COLORS = {
  RESET: "\x1b[0m",
  INFO: "\x1b[36m", // Cyan
  WARN: "\x1b[33m", // Yellow
  ERROR: "\x1b[31m", // Red
  HTTP: "\x1b[35m", // Magenta
};

/**
 * Sink a archivo opcional, integrado en el Logger compartido (mismo módulo que
 * usamos para todos los prints). Así los logs de cualquier app/worker quedan
 * consultables sin depender de cómo se arrancó el proceso.
 *
 * - Solo se activa en Bun (collector/tracker/cortex/janitor). En Cloudflare
 *   Workers (api/web SSR) NO hay filesystem → se omite silenciosamente.
 * - Se desactiva en tests y si `LOG_TO_FILE=0`/`false`.
 * - Destino: `LOG_FILE` si está seteado, si no `logs/dev.log` relativo al cwd
 *   (con turbo, el cwd es el dir del app → e.g. `apps/collector/logs/dev.log`).
 * - Append; el archivo se trunca al iniciar si supera ~10 MB (evita crecer sin
 *   límite en dev). Sin colores ANSI → greppable.
 */
type FileAppender = (line: string) => void;
let fileAppender: FileAppender | null | undefined;

function initFileAppender(): FileAppender | null {
  try {
    const proc = (globalThis as { process?: NodeJS.Process }).process;
    const isBun = !!proc?.versions?.bun;
    const env = proc?.env ?? {};
    const flag = (env.LOG_TO_FILE ?? "").toLowerCase();
    const disabled = flag === "0" || flag === "false" || env.NODE_ENV === "test";
    if (!isBun || disabled) return null;

    // `import.meta.require` es específico de Bun (sync) y NO existe en Workers
    // ni en Node ESM → ahí queda en null y solo se loguea a consola. Evita que
    // el bundle de Workers resuelva node:fs estáticamente.
    const bunRequire = (import.meta as unknown as { require?: NodeRequire }).require;
    if (typeof bunRequire !== "function") return null;
    const fs = bunRequire("node:fs") as typeof import("node:fs");
    const path = bunRequire("node:path") as typeof import("node:path");

    const file = env.LOG_FILE?.trim() ? env.LOG_FILE : path.join(proc?.cwd?.() ?? ".", "logs", "dev.log");
    fs.mkdirSync(path.dirname(file), { recursive: true });

    // Rotación simple: si ya pesa > 10MB, arrancar limpio.
    try {
      if (fs.statSync(file).size > 10 * 1024 * 1024) fs.truncateSync(file, 0);
    } catch {
      /* no existe aún */
    }

    const stream = fs.createWriteStream(file, { flags: "a" });
    stream.write(`# log abierto ${new Date().toISOString()} (pid ${proc?.pid ?? "?"})\n`);
    return (line: string) => stream.write(line);
  } catch {
    // Cualquier fallo (sin fs, permisos, etc.) → solo consola, nunca tira.
    return null;
  }
}

function serializeRest(rest: unknown[]): string {
  if (rest.length === 0) return "";
  return ` ${rest
    .map((v) => {
      if (typeof v === "string") return v;
      if (v instanceof Error) return v.stack ?? `${v.name}: ${v.message}`;
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    })
    .join(" ")}`;
}

export class Logger {
  constructor(private scope: string) {}

  private format(level: string, message: string, ...rest: unknown[]) {
    const timestamp = new Date().toISOString();
    const color = COLORS[level as keyof typeof COLORS] || COLORS.RESET;
    console.log(`${color}[${timestamp}] [${this.scope}] [${level}]${COLORS.RESET} ${message}`, ...rest);

    if (fileAppender === undefined) fileAppender = initFileAppender();
    if (fileAppender) {
      fileAppender(`[${timestamp}] [${this.scope}] [${level}] ${message}${serializeRest(rest)}\n`);
    }
  }

  info(message: string, ...rest: unknown[]) {
    this.format("INFO", message, ...rest);
  }

  warn(message: string, ...rest: unknown[]) {
    this.format("WARN", message, ...rest);
  }

  error(message: string, ...rest: unknown[]) {
    this.format("ERROR", message, ...rest);
  }

  http = (message: string, ...rest: unknown[]) => {
    this.format("HTTP", message, ...rest);
  };
}
