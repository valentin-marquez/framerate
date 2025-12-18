// Set dummy env vars to pass initial checks
Bun.env.SUPABASE_URL = "https://dummy.supabase.co";
Bun.env.SUPABASE_SERVICE_ROLE_KEY = "dummy-key";
Bun.env.GROQ_API_KEY = "dummy";
Bun.env.AI_MODE = "groq";

import { describe, expect, test } from "bun:test";

// Increase timeout for LLM calls to 60 seconds
const TIMEOUT = 60000;

describe("IA Extraction", () => {
  test(
    "should extract HDD specs from full description",
    async () => {
      const { HddIAExtractor } = await import("@/processors/ai/hdd");
      const hddExtractor = new HddIAExtractor();

      console.log("\n--- Testing HDD Extraction ---");
      const hddText = `
				WD Blue 1TB Desktop Hard Disk Drive - 7200 RPM SATA 6Gb/s 64MB Cache 3.5 Inch - WD10EZEX
				Brand: Western Digital
				Series: Blue
				Item model number: WD10EZEX
				Hardware Platform: PC
				Item Weight: 15.5 ounces
				Product Dimensions: 5.79 x 4 x 1.03 inches
				Item Dimensions LxWxH: 5.79 x 4 x 1.03 inches
				Color: Blue
				Flash Memory Size: 1 TB
				Hard Drive Interface: Serial ATA-600
				Hard Drive Rotational Speed: 7200 RPM
			`;

      const specs = await hddExtractor.extract("TEST-HDD-MPN-001", hddText);
      console.log("HDD Specs Result:", JSON.stringify(specs, null, 2));

      expect(specs).toBeDefined();
      expect(specs).not.toBeNull();
      expect(specs?.capacity).toBeDefined();
      expect(specs?.rpm).toBeDefined();
    },
    TIMEOUT,
  );

  test(
    "should extract SSD specs from full description",
    async () => {
      const { SsdIAExtractor } = await import("@/processors/ai/ssd");
      const ssdExtractor = new SsdIAExtractor();

      console.log("\n--- Testing SSD Extraction ---");
      const ssdText = `
				Samsung 980 PRO SSD 1TB PCIe 4.0 NVMe Gen 4 Gaming M.2 Internal Solid State Drive Memory Card, Maximum Speed, Thermal Control, MZ-V8P1T0B
				NEXT-LEVEL SSD PERFORMANCE: Unleash the power of the Samsung 980 PRO PCIe 4.0 NVMe SSD for next-level computing. 
				MAXIMUM SPEED: 980 PRO is raising the bar for NVMe SSDs, delivering read speeds up to 7,000 MB/s.
				A WINNING COMBINATION: Designed for hardcore gamers and tech-savvy users, the 980 PRO offers high-performance bandwidth and throughput for heavy-duty applications in gaming, graphics, data analytics, and more.
				EFFICIENT M.2 SSD: The 980 PRO comes in a compact M.2 2280 form factor, which can be easily plugged into desktops and laptops for maximum board design flexibility.
				RELIABLE THERMAL CONTROL: To ensure stable performance, the 980 PRO uses nickel coating to help manage the controller's heat level and a heat spreader label to deliver effective thermal control of the NAND chip.
				SMART THERMAL SOLUTION: Embedded with Samsung's cutting-edge thermal control algorithm, the 980 PRO manages heat on its own to deliver durable and reliable performance.
				SAMSUNG MAGICIAN SOFTWARE: Unlock the full power of the 980 PRO with Samsung Magician's intuitive yet advanced optimization tools.
				FLASH MEMORY BRAND: Samsung
			`;

      const specs = await ssdExtractor.extract("TEST-SSD-MPN-001", ssdText);
      console.log("SSD Specs Result:", JSON.stringify(specs, null, 2));

      expect(specs).toBeDefined();
      expect(specs).not.toBeNull();
      expect(specs?.capacity).toBeDefined();
      expect(specs?.format).toBeDefined();
    },
    TIMEOUT,
  );

  describe("Short Descriptions", () => {
    const shortTests = [
      {
        type: "SSD",
        text: "Unidad SSD ADATA Legend 860, 1TB,M.2 2280, NVMe PCIe 4.0, Lec. 6000MB/s Esc. 5000MB/s",
        mpn: "TEST-SSD-SHORT-001",
      },
      {
        type: "SSD",
        text: "Unidad SSD Crucial E100, 1TB, M.2 2280, NVMe PCIe 4.0 x4, Lect 5000MB/s Escr 4500MB/s",
        mpn: "TEST-SSD-SHORT-002",
      },
      {
        type: "HDD",
        text: 'Disco Duro 20TB Seagate IronWolf Pro, 3.5", SATA III, 6Gbit/s, 7200RPM, 256MB Caché',
        mpn: "TEST-HDD-SHORT-001",
      },
      {
        type: "HDD",
        text: 'Disco Duro 4TB WD Gold Clase empresarial, 3.5", 7200 RPM, caché 256MB, SATA, tecnología OptiNAND',
        mpn: "TEST-HDD-SHORT-002",
      },
    ];

    for (const testCase of shortTests) {
      test(
        `should extract ${testCase.type} from: ${testCase.text.substring(0, 30)}...`,
        async () => {
          console.log(`\nTesting ${testCase.type}: ${testCase.text}`);
          // biome-ignore lint/suspicious/noExplicitAny: Testing multiple types
          let specs: any;
          if (testCase.type === "SSD") {
            const { SsdIAExtractor } = await import("@/processors/ai/ssd");
            const ssdExtractor = new SsdIAExtractor();
            specs = await ssdExtractor.extract(testCase.mpn, testCase.text);
          } else {
            const { HddIAExtractor } = await import("@/processors/ai/hdd");
            const hddExtractor = new HddIAExtractor();
            specs = await hddExtractor.extract(testCase.mpn, testCase.text);
          }
          console.log(`Result for ${testCase.mpn}:`, JSON.stringify(specs, null, 2));
          expect(specs).toBeDefined();
        },
        TIMEOUT,
      );
    }
  });
});
