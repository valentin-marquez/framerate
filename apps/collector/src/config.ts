export const config = {
  PORT: process.env.PORT || 3001,
  // Proxy Configuration
  // Example: "http://user:pass@host:port" or "server:port"
  PROXY_URL: process.env.PROXY_URL,
  // Optional: Rotate proxies from a list (comma separated)
  PROXY_LIST: process.env.PROXY_LIST ? process.env.PROXY_LIST.split(",") : [],

  // Browser Config
  HEADLESS: process.env.HEADLESS !== "false",
  CONCURRENCY: Number(process.env.CONCURRENCY) || 3,
};
