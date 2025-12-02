/**
 * CPU Cooler Normalization Tests
 * Tests for the cpu-cooler title normalizer using sample data
 */

import { describe, expect, test } from "bun:test";
import { normalizeCpuCoolerTitle } from "../src/processors/normalizers/cpu-cooler";

describe("CPU Cooler Title Normalization", () => {
  describe("AIO Liquid Coolers", () => {
    test("Cooler Master MasterLiquid 360 Core II White", () => {
      const input =
        "REFRIGERACION LIQUIDA COOLER MASTER MASTERLIQUID 360 CORE II WHITE EDITION MLW-D36M-A18PA-RW";
      const result = normalizeCpuCoolerTitle(input, "MLW-D36M-A18PA-RW");
      expect(result).toContain("Cooler Master");
      expect(result).toContain("MasterLiquid");
      expect(result).toContain("360mm");
      expect(result).toContain("Core II");
      expect(result).toContain("AIO");
      expect(result).toContain("White");
    });

    test("Cooler Master MasterLiquid 240 Core II ARGB", () => {
      const input =
        "REFRIGERACION LIQUIDA COOLER MASTER MASTERLIQUID 240 CORE II ARGB MLW-D24M-A18PA-R1";
      const result = normalizeCpuCoolerTitle(input, "MLW-D24M-A18PA-R1");
      expect(result).toContain("Cooler Master");
      expect(result).toContain("MasterLiquid");
      expect(result).toContain("240mm");
      expect(result).toContain("ARGB");
      expect(result).toContain("AIO");
    });

    test("NZXT Kraken Elite 240 LCD Black", () => {
      const input =
        'REFRIGERACION LIQUIDA NZXT Kraken Elite 240 2.72" IPS LCD BLACK P/N RL- KN24E-B2';
      const result = normalizeCpuCoolerTitle(input, "RL- KN24E-B2");
      expect(result).toContain("NZXT");
      expect(result).toContain("Kraken Elite");
      expect(result).toContain("240mm");
      expect(result).toContain("LCD");
      expect(result).toContain("AIO");
    });

    test("NZXT Kraken Plus 240 V2 White", () => {
      const input =
        'REFRIGERACION LIQUIDA NZXT Kraken Plus 240 1.54" LCD & RGB V2 White P/N RL- KR240-W2';
      const result = normalizeCpuCoolerTitle(input, "RL- KR240-W2");
      expect(result).toContain("NZXT");
      expect(result).toContain("240mm");
      expect(result).toContain("White");
      expect(result).toContain("AIO");
    });

    test("Antec Skeleton 360 ARGB Black", () => {
      const input = "REFRIGERACION LIQUIDA ANTEC SKELETON 360 ARGB BK P/N 0-761345-40066-4";
      const result = normalizeCpuCoolerTitle(input, "SKELETON360ARGBBK");
      expect(result).toContain("Antec");
      expect(result).toContain("Skeleton");
      expect(result).toContain("360mm");
      expect(result).toContain("ARGB");
      expect(result).toContain("AIO");
    });

    test("Antec Vortex Lum 240 ARGB", () => {
      const input = "REFRIGERACION LIQUIDA ANTEC VORTEX LUM 240 ARGB NEGRO 0-761345-40054-1";
      const result = normalizeCpuCoolerTitle(input, "0-761345-40054-1");
      expect(result).toContain("Antec");
      expect(result).toContain("Vortex Lum");
      expect(result).toContain("240mm");
      expect(result).toContain("ARGB");
      expect(result).toContain("AIO");
    });

    test("Antec Neptune 120 ARGB", () => {
      const input =
        "SISTEMA DE REFRIGERACION LIQUIDA ANTEC WATERCOOLING * 120 * NEPTUNE 120 ARGB P/N 0-761345-74026-5";
      const result = normalizeCpuCoolerTitle(input, "0-761345-74026-5");
      expect(result).toContain("Antec");
      expect(result).toContain("Neptune");
      expect(result).toContain("120mm");
      expect(result).toContain("ARGB");
      expect(result).toContain("AIO");
    });

    test("Gamemax Iceburg 240 Digital", () => {
      const input =
        "SISTEMA DE REFRIGERACION LIQUIDA GAMEMAX WATERCOOLING ICEBURG 240 DIGITAL BK ( s1700 ready y AM5 ) P/N ICEBURG-240-DIGITAL-BK";
      const result = normalizeCpuCoolerTitle(input, "ICEBURG-240-DIGITAL-BK");
      expect(result).toContain("Gamemax");
      expect(result).toContain("Iceburg");
      expect(result).toContain("240mm");
      expect(result).toContain("Digital");
      expect(result).toContain("AIO");
    });

    test("Gigabyte AORUS Waterforce X II 240", () => {
      const input =
        "SISTEMA DE REFRIGERACION LIQUIDA GIGABYTE AORUS WATERFORCE X II 240 P/N GP-AORUSWATERFORCEXII240";
      const result = normalizeCpuCoolerTitle(input, "GP-AORUS WATERFORCE X II 240");
      expect(result).toContain("Gigabyte");
      expect(result).toContain("AORUS Waterforce X II");
      expect(result).toContain("240mm");
      expect(result).toContain("AIO");
    });

    test("MSI MPG CoreLiquid K240 V2", () => {
      const input =
        "SISTEMA DE REFRIGERACION LIQUIDA MSI WATERCOOLING MPG CORELIQUID K240 V2 am5 ready P/N MPG CORELIQUID K240 V2";
      const result = normalizeCpuCoolerTitle(input, "MPGCORELIQUIDK240V2");
      expect(result).toContain("MSI");
      expect(result).toContain("MPG CoreLiquid");
      expect(result).toContain("240mm");
      expect(result).toContain("AIO");
    });

    test("Gamdias Chione E1A-120 ARGB", () => {
      const input =
        "SISTEMA DE REFRIGERACION LIQUIDA GAMDIAS CHIONE E1A-120 ARGB WATERCOOLING P/N CHIONE E1A-120";
      const result = normalizeCpuCoolerTitle(input, "CHIONEE1A-120");
      expect(result).toContain("Gamdias");
      expect(result).toContain("Chione");
      expect(result).toContain("120mm");
      expect(result).toContain("ARGB");
      expect(result).toContain("AIO");
    });

    test("Cougar Helor 240 RGB", () => {
      const input =
        "SISTEMA DE REFRIGERACION LIQUIDA COUGAR Watercooling Helor 240mm Dynamic RGB P/N 35CCL24.0004";
      const result = normalizeCpuCoolerTitle(input, "35CCL24.0004");
      expect(result).toContain("Cougar");
      expect(result).toContain("Helor");
      expect(result).toContain("240mm");
      expect(result).toContain("RGB");
      expect(result).toContain("AIO");
    });

    test("Cooler Master ML280 Mirror", () => {
      const input =
        "REFRIGERACION LIQUIDA WATER COOLING COOLER MASTER MASTERLIQUID ML280 MIRROR P/N MLX-D28M-A14PK-R1";
      const result = normalizeCpuCoolerTitle(input, "MLX-D28M-A14PK-R1");
      expect(result).toContain("Cooler Master");
      expect(result).toContain("MasterLiquid");
      expect(result).toContain("280mm");
      expect(result).toContain("Mirror");
      expect(result).toContain("AIO");
    });
  });

  describe("Air Coolers", () => {
    test("Cougar Forza 85 ARGB", () => {
      const input =
        "Disipador para CPU COUGAR Forza 85 ARGB - Disipador de Torre Única con Iluminación ARGB";
      const result = normalizeCpuCoolerTitle(input, "CGR-FZA85-ARGB");
      expect(result).toContain("Cougar");
      expect(result).toContain("Forza");
      expect(result).toContain("ARGB");
      expect(result).toContain("Air");
    });

    test("Cougar Forza 50 Essential", () => {
      const input =
        "Disipador para CPU COUGAR Forza 50 Essential - Disipador de Torre para CPU de Nivel Básico";
      const result = normalizeCpuCoolerTitle(input, "CGR-FZAE50");
      expect(result).toContain("Cougar");
      expect(result).toContain("Forza");
      expect(result).toContain("Essential");
      expect(result).toContain("Air");
    });

    test("Be Quiet! Dark Rock Pro 5", () => {
      const input =
        "Disipador de Procesador Be Quiet! Dark Rock Pro 5, 2 Ventiladores PWM, 7 Heatpipes, Negro";
      const result = normalizeCpuCoolerTitle(input, "BK036");
      expect(result).toContain("Be Quiet!");
      expect(result).toContain("Dark Rock Pro");
      expect(result).toContain("Air");
    });

    test("Be Quiet! Pure Rock 3 LX ARGB", () => {
      const input = "Disipador CPU Be quiet! Pure Rock 3 LX, 190W TDP, 120mm, ARGB, 31.2 dB";
      const result = normalizeCpuCoolerTitle(input, "BK040");
      expect(result).toContain("Be Quiet!");
      expect(result).toContain("Pure Rock");
      expect(result).toContain("LX");
      expect(result).toContain("ARGB");
      expect(result).toContain("Air");
    });

    test("Gamemax Gamma 200 RGB", () => {
      const input = "VENTILADOR PARA CPU ARGB GAMEMAX GAMMA 200 RGB P/N GAMMA 200";
      const result = normalizeCpuCoolerTitle(input, "GAMMA200");
      expect(result).toContain("Gamemax");
      expect(result).toContain("Gamma");
      expect(result).toContain("RGB");
      expect(result).toContain("Air");
    });

    test("Gamemax Sigma 520 Digital White", () => {
      const input =
        "VENTILADOR PARA CPU GAMEMAX SIGMA 520 DIGITAL WHITE ( S1700 y AM5 ) P/N SIGMA520DIGITALWHITE";
      const result = normalizeCpuCoolerTitle(input, "SIGMA520DIGITALWHITE");
      expect(result).toContain("Gamemax");
      expect(result).toContain("Sigma");
      expect(result).toContain("Digital");
      expect(result).toContain("White");
      expect(result).toContain("Air");
    });

    test("Gamemax Ice Surface White", () => {
      const input =
        "VENTILADOR PARA CPU GAMEMAX ICE SURFACE WHITE ( S1700 y AM4 ) P/N ICE-SURFACE-WH";
      const result = normalizeCpuCoolerTitle(input, "ICE-SURFACE-WH");
      expect(result).toContain("Gamemax");
      expect(result).toContain("Ice Surface");
      expect(result).toContain("White");
      expect(result).toContain("Air");
    });

    test("XYZ Thermax 6 Pro Duo Black", () => {
      const input =
        "Disipador para CPU XYZ THERMAX 6 PRO DUO, 2x 120mm, 6 Heatpipes, Pantalla T°, Intel/AMD, Negro";
      const result = normalizeCpuCoolerTitle(input, "X-AC-THERPRODUOB6");
      expect(result).toContain("XYZ");
      expect(result).toContain("Thermax");
      expect(result).toContain("Air");
    });

    test("Morpheus G20 RGB", () => {
      const input = "Disipador para CPU Morpheus G20 RGB, Intel/AMD, Ventilador 92mm, RGB";
      const result = normalizeCpuCoolerTitle(input, "G20 RGB");
      expect(result).toContain("Morpheus");
      expect(result).toContain("G20");
      expect(result).toContain("RGB");
      expect(result).toContain("Air");
    });

    test("Morpheus Gaming A100 ARGB", () => {
      const input = "Disipador para CPU Morpheus Gaming A100 ARGB, Intel/AMD, 120mm";
      const result = normalizeCpuCoolerTitle(input, "A100 ARGB");
      expect(result).toContain("Morpheus");
      expect(result).toContain("ARGB");
      expect(result).toContain("Air");
    });

    test("Intel Original LGA1700", () => {
      const input = "VENTILADOR PARA CPU INTEL ORIGINAL BASE COBRE s1700 P/n M23901-001";
      const result = normalizeCpuCoolerTitle(input, "M23901-001");
      expect(result).toContain("Intel");
      expect(result).toContain("Air");
    });

    test("AMD Original AM4", () => {
      const input =
        "Ventilador CPU AMD Original para Socket AM4 Disipador con Ventilador Integrado Enfriamiento Eficaz";
      const result = normalizeCpuCoolerTitle(input, "VENTILADOR AMD ORIGINAL");
      expect(result).toContain("AMD");
      expect(result).toContain("Air");
    });

    test("Antec A30 Pro", () => {
      const input = "VENTILADOR PARA CPU ANTEC A30 PRO P/N 0-761345-77752-0";
      const result = normalizeCpuCoolerTitle(input, "A30PRO");
      expect(result).toContain("Antec");
      expect(result).toContain("A30 Pro");
      expect(result).toContain("Air");
    });
  });

  describe("Edge Cases", () => {
    test("Should remove verbose descriptors", () => {
      const input = "SISTEMA DE REFRIGERACION LIQUIDA ANTEC Symphony 360 ARGB WATERCOOLING";
      const result = normalizeCpuCoolerTitle(input, "SYMPHONY360ARGB");
      expect(result).not.toContain("SISTEMA DE REFRIGERACION");
      expect(result).not.toContain("WATERCOOLING");
      expect(result).toContain("Antec");
      expect(result).toContain("Symphony");
    });

    test("Should handle typos in source data", () => {
      const input = "SISTEMA DE REGRIGERACION LIQUIDA ANTEC VORTEX 360 ARGB WATERCOOLING";
      const result = normalizeCpuCoolerTitle(input, "VORTEX360ARGB");
      expect(result).not.toContain("REGRIGERACION"); // typo
      expect(result).toContain("Antec");
      expect(result).toContain("Vortex");
    });

    test("Should handle WHITE spelled as WITHE (typo)", () => {
      const input =
        "SISTEMA DE REFRIGERACION LIQUIDA ANTEC VORTEX LUM 360 ARGB WITHE 0-761345-40056-5";
      const result = normalizeCpuCoolerTitle(input, "0-761345-40056-5");
      expect(result).toContain("White");
    });

    test("Should handle adapter products", () => {
      const input = "ADAPTADOR COOLER MASTER LGA1700 PARA WATER COOLING P/N 603005870-GP";
      const result = normalizeCpuCoolerTitle(input, "603005870-GP");
      expect(result).toContain("Cooler Master");
    });
  });
});

describe("Normalization Quality", () => {
  test("Normalized titles should be shorter than original verbose titles", () => {
    const testCases = [
      "REFRIGERACION LIQUIDA COOLER MASTER MASTERLIQUID 360 CORE II WHITE EDITION MLW-D36M-A18PA-RW",
      "Disipador para CPU COUGAR Forza 85 ARGB - Disipador de Torre Única con Iluminación ARGB",
      "SISTEMA DE REFRIGERACION LIQUIDA GAMEMAX WATERCOOLING ICEBURG 240 DIGITAL BK ( s1700 ready y AM5 )",
    ];

    for (const title of testCases) {
      const normalized = normalizeCpuCoolerTitle(title);
      expect(normalized.length).toBeLessThan(title.length);
    }
  });

  test("Normalized titles should not contain common junk phrases", () => {
    const testCases = [
      "REFRIGERACION LIQUIDA COOLER MASTER MASTERLIQUID 360 CORE II WHITE EDITION",
      "Disipador para CPU COUGAR Forza 85 ARGB - Disipador de Torre Única",
      "VENTILADOR PARA CPU GAMEMAX GAMMA 200 RGB",
    ];

    const junkPhrases = [
      "REFRIGERACION LIQUIDA",
      "DISIPADOR PARA CPU",
      "VENTILADOR PARA CPU",
      "TORRE ÚNICA",
      "SISTEMA DE",
    ];

    for (const title of testCases) {
      const normalized = normalizeCpuCoolerTitle(title);
      for (const junk of junkPhrases) {
        expect(normalized.toUpperCase()).not.toContain(junk);
      }
    }
  });
});
