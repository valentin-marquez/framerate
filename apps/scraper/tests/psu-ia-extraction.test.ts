// Set dummy env vars to pass initial checks
Bun.env.SUPABASE_URL = "https://dummy.supabase.co";
Bun.env.SUPABASE_SERVICE_ROLE_KEY = "dummy-key";
Bun.env.GROQ_API_KEY = "dummy";
Bun.env.AI_MODE = "groq";

import { describe, expect, mock, test } from "bun:test";

// Mock Supabase
mock.module("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: null }), // Simulate cache miss
        }),
      }),
      insert: async () => ({ error: null }),
    }),
  },
}));

// Mock OpenAI
const mockCreate = mock(async (_params: unknown) => {
  // Return a mock response based on the prompt content if needed,
  // or just a generic valid response for PSU
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            manufacturer: "Corsair",
            wattage: "750W",
            certification: "80 Plus Gold",
            form_factor: "ATX",
            pfc_active: true,
            modular: "Full Modular",
            rail_12v: "62.5 A",
            rail_5v: "20 A",
            rail_3v3: "20 A",
            power_connectors: [
              "1x 20+4 pines (Motherboard)",
              "2x 4+4 pines (CPU)",
              "3x 6+2 pines (PCIe)",
              "7x SATA",
            ],
          }),
        },
      },
    ],
  };
});

mock.module("openai", () => {
  return {
    default: class OpenAI {
      baseURL = "https://api.groq.com/openai/v1";
      chat = {
        completions: {
          create: mockCreate,
        },
      };
      // biome-ignore lint/suspicious/noExplicitAny: Mocking
      constructor(opts: any) {
        if (opts?.baseURL) this.baseURL = opts.baseURL;
      }
    },
  };
});

describe("PSU IA Extraction (Mocked)", () => {
  test("should extract specs using mocked LLM", async () => {
    const { PsuIAExtractor } = await import("@/processors/ai/psu");
    const psuExtractor = new PsuIAExtractor();

    const psuText = `
      Fuente de Poder Corsair RM750e 750W 80 Plus Gold Full Modular, ATX 3.0, PCIe 5.0.
      +12V: 62.5A, +5V: 20A, +3.3V: 20A.
      Conectores: 1x ATX 24-pin, 2x EPS 8-pin, 3x PCIe 8-pin, 7x SATA
    `;

    const specs = await psuExtractor.extract("TEST-PSU-MPN-001", psuText);

    expect(specs).toBeDefined();
    if (specs) {
      expect(specs.wattage).toBe("750W");
      expect(specs.certification).toBe("80 Plus Gold");
      expect(specs.modular).toBe("Full Modular");
      expect(specs.pfc_active).toBe(true);
    }

    // Verify OpenAI was called
    expect(mockCreate).toHaveBeenCalled();
    // biome-ignore lint/suspicious/noExplicitAny: Mocking
    const callArgs = mockCreate.mock.calls[0][0] as any;
    expect(callArgs.messages[0].content).toContain(
      "You are a technical product specifications extractor specialized in Power Supply Units (PSU).",
    );
  }, 20000); // Increase timeout to 20s
});
