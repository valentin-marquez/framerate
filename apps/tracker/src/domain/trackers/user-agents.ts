import { config } from "@/config";

// Small curated list of common desktop UAs
export const DEFAULT_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:117.0) Gecko/20100101 Firefox/117.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Mobile/15E148 Safari/604.1",
];

let rrIndex = 0;

export function getUserAgent(strategy?: "random" | "roundrobin") {
  const s = strategy ?? (config.USER_AGENT_STRATEGY as "random" | "roundrobin");
  const list = (
    config.USER_AGENT_LIST
      ? config.USER_AGENT_LIST.split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : DEFAULT_USER_AGENTS
  ) as string[];
  if (list.length === 0) return DEFAULT_USER_AGENTS[0];

  if (s === "roundrobin") {
    const ua = list[rrIndex % list.length];
    rrIndex += 1;
    return ua;
  }

  return list[Math.floor(Math.random() * list.length)];
}
