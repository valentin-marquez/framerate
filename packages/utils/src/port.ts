export async function findAvailablePort(port = 3000): Promise<number> {
  // In production, always use the default port
  if (process.env.NODE_ENV !== "development") {
    return port;
  }

  let currentPort = port;
  while (true) {
    try {
      const server = Bun.serve({
        port: currentPort,
        fetch: () => new Response("ok"),
      });
      server.stop();
      return currentPort;
    } catch {
      currentPort++;
    }
  }
}
