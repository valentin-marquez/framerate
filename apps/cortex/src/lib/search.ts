import { search } from "duck-duck-scrape";
import logger from "@/logger";

export async function searchWeb(query: string): Promise<string> {
  try {
    logger.info(`Searching web for: ${query}`);
    const searchResults = await search(query, {
      safeSearch: 0, // Off
    });

    if (!searchResults.results || searchResults.results.length === 0) {
      logger.warn(`No results found for: ${query}`);
      return "";
    }

    // Take top 5 results
    const topResults = searchResults.results.slice(0, 5);

    const text = topResults.map((r) => `Title: ${r.title}\nDescription: ${r.description}\nURL: ${r.url}`).join("\n\n");
    return text;
  } catch (error) {
    logger.error(`Search failed for ${query}:`, error);
    return "";
  }
}
