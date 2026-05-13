export const Normalizer = {
  synonyms: new Map<string, string>([
    ["republic of gamers", "rog"],
    ["tuf gaming", "tuf"],
    ["geforce", ""], // Often noise in titles if doubled with RTX/GTX
    ["nvidia", ""], // Manufacturer often redundant if implcit
    ["amd", ""],
    ["radeon", ""],
    ["team green", "nvidia"],
    ["team red", "amd"],
    ["graphics card", ""],
    ["video card", ""],
    ["gpu", ""],
    ["gen 4", "gen4"],
    ["gen 5", "gen5"],
    ["edition", ""],
    ["gaming", ""], // Generic noise? Maybe keep for differentiation? context dependent.
    // Add more mappings as discovered
  ]),

  normalize(input: string): string {
    let text = input.toLowerCase();

    // 1. Remove special characters but keep alphanumeric and spaces
    text = text.replace(/[^a-z0-9\s]/g, " ");

    // 2. Collapse multiple spaces
    text = text.replace(/\s+/g, " ").trim();

    // 3. Synonym Expansion / Token Replacement
    const tokens = text.split(" ");
    const normalizedTokens = tokens.map((token) => {
      // Direct map check (naive, single word)
      const synonym = this.synonyms.get(token);
      if (synonym !== undefined) {
        return synonym;
      }
      return token;
    });

    // 4. Multi-word synonym check (Simple implementation)
    // iterate over map and replace in string? inefficient but accurate for "republic of gamers"
    let normalizedText = normalizedTokens.join(" "); // Rejoin first

    for (const [key, value] of this.synonyms) {
      if (key.includes(" ")) {
        // Only check phrases here
        const regex = new RegExp(`\\b${key}\\b`, "g");
        normalizedText = normalizedText.replace(regex, value);
      }
    }

    return normalizedText.replace(/\s+/g, " ").trim();
  },

  extractMPN(input: string): string | null {
    // Regex for common MPN patterns:
    // - Letters and Numbers
    // - At least 3 chars
    // - Often has hyphens like "RTX-3080", "GV-N3080GAMING-OC-10GD"
    // This is hard to perfect, but let's try a heuristic.

    const mpnRegex = /\b([a-zA-Z0-9]{3,}-[a-zA-Z0-9-]{3,})\b/i;
    const match = input.match(mpnRegex);
    return match ? match[1].toUpperCase() : null;
  },
};
