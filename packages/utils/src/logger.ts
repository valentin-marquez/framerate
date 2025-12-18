export class Logger {
  constructor(private scope: string) {}

  private format(level: string, message: string, ...rest: unknown[]) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.scope}] [${level}] ${message}`, ...rest);
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
