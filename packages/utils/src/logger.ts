const COLORS = {
  RESET: "\x1b[0m",
  INFO: "\x1b[36m", // Cyan
  WARN: "\x1b[33m", // Yellow
  ERROR: "\x1b[31m", // Red
  HTTP: "\x1b[35m", // Magenta
};

export class Logger {
  constructor(private scope: string) {}

  private format(level: string, message: string, ...rest: unknown[]) {
    const timestamp = new Date().toISOString();
    const color = COLORS[level as keyof typeof COLORS] || COLORS.RESET;
    console.log(`${color}[${timestamp}] [${this.scope}] [${level}]${COLORS.RESET} ${message}`, ...rest);
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
