import { describe, expect, it } from "bun:test";
import { normalizeCaseTitle } from "../src/processors/normalizers/case";

describe("Case Title Normalizer", () => {
  describe("Corsair cases", () => {
    it("should normalize FRAME 4000D", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Corsair FRAME 4000D, Modular, Vidrio Templado, USB-C, E-ATX, Color Negro",
      );
      expect(result).toBe("Corsair FRAME 4000D Full Tower TG Negro");
    });

    it("should normalize FRAME 4000D RS ARGB", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Corsair FRAME 4000D RS ARGB, Vidrio Templado, 3x120 ARGB, E-ATX, Color Negro",
      );
      expect(result).toBe("Corsair FRAME 4000D RS Full Tower TG ARGB Negro");
    });

    it("should normalize 7000D Airflow", () => {
      const result = normalizeCaseTitle(
        "Gabinete Corsair 7000D Airflow, VIdrio Templado, Full Tower, ATX/Micro-ATX/Mini-ITX, USB 3.0, Negro",
      );
      expect(result).toBe("Corsair 7000D Full Tower TG Mesh Negro");
    });

    it("should normalize iCUE 7000X RGB", () => {
      const result = normalizeCaseTitle(
        "Gabinete Corsair iCUE 7000X RGB, Full Tower, Factor ATX, Vidrio Templado, Negro",
      );
      expect(result).toBe("Corsair iCUE 7000X Full Tower TG RGB Negro");
    });

    it("should normalize 5000X RGB White", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Corsair 5000X RGB, Mid Tower, White, Vidrio Templado, ATX/EATX/ITX",
      );
      expect(result).toBe("Corsair 5000X Mid Tower TG RGB Blanco");
    });

    it("should normalize 3500X", () => {
      const result = normalizeCaseTitle("Gabinete Gamer Corsair 3500X, Vidrio Templado, USB-C, E-ATX, Color Negro");
      expect(result).toBe("Corsair 3500X Full Tower TG Negro");
    });
  });

  describe("Antec cases", () => {
    it("should normalize AX27 ELITE", () => {
      const result = normalizeCaseTitle("GABINETE ANTEC AX27 ELITE BK ATX 4 FAN 0-761345-10205-6");
      expect(result).toBe("Antec AX27 Elite Mid Tower Negro");
    });

    it("should normalize C8 WOOD", () => {
      const result = normalizeCaseTitle("GABINETE ANTEC C8 WOOD 0-761345-10079-3");
      expect(result).toBe("Antec C8 Wood");
    });

    it("should normalize C7 ARGB White", () => {
      const result = normalizeCaseTitle("ANTEC GABINETE C7 ARGB White ( 1ARGB 140MM Y 3 ARGB 120MM ) 0-761345-10136-3");
      expect(result).toBe("Antec C7 ARGB Blanco");
    });

    it("should normalize CX700 ARGB", () => {
      const result = normalizeCaseTitle("GABINETE ANTEC CX700 ARGB BK P/N 0-761345-10120-2");
      expect(result).toBe("Antec CX700 ARGB Negro");
    });

    it("should normalize AX61 Elite", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Antec AX61 Elite, Mid Tower, Vidrio Templado, 4 Ventiladores ARGB, ATX, Micro ATX",
      );
      expect(result).toBe("Antec AX61 Elite Mid Tower TG ARGB");
    });

    it("should normalize FLUX White", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Antec FLUX White, Mid Tower, E-ATX, Vidrio Templado, 5 Ventiladores PWM",
      );
      expect(result).toBe("Antec Flux Mid Tower TG Blanco");
    });

    it("should normalize Performance 1 FT ARGB", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Antec Performance 1 FT ARGB, Vidrio Templado, Ventiladores ARGB, USB-C, E-ATX",
      );
      expect(result).toBe("Antec Performance 1 FT Full Tower TG ARGB");
    });
  });

  describe("Cooler Master cases", () => {
    it("should normalize MasterBox MB520 Mesh", () => {
      const result = normalizeCaseTitle(
        "Gabiente Gamer Cooler Master MasterBox MB520 Mesh, Vidrio templado, White, RGB Programable, ATX",
      );
      expect(result).toBe("Cooler Master MasterBox MB520 Mid Tower TG Mesh RGB Blanco");
    });

    it("should normalize TD300 Mesh White", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Cooler Master TD300 Mesh, A-RGB, Vidrio Templado, Micro-ATX, Mini ITX, White",
      );
      expect(result).toBe("Cooler Master TD300 Mid Tower TG Mesh ARGB Blanco");
    });

    it("should normalize NR200P", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Coolermaster NR200P, Mini-DTX/Mini-ITX, Vidrio Templado, Negro (Fuente SFX)",
      );
      expect(result).toBe("Cooler Master NR200P Mini ITX TG Negro");
    });

    it("should normalize HAF 500", () => {
      const result = normalizeCaseTitle("GABINETE GAMER COOLER MASTER BLACK HAF 500 H500-KGNN-S00 P/N H500-KGNN-S00");
      expect(result).toBe("Cooler Master HAF 500 Mid Tower Negro");
    });

    it("should normalize Elite 302 White", () => {
      const result = normalizeCaseTitle("GABINETE GAMER COOLER MASTER ELITE 302 WHITE E302-WGNN-S00");
      expect(result).toBe("Cooler Master Elite 302 Mid Tower Blanco");
    });
  });

  describe("Be quiet! cases", () => {
    it("should normalize Light Base 600 DX Black", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Be quiet! Light Base 600 DX Black, ARGB 77 LED, ATX, Color Negro",
      );
      expect(result).toBe("Be quiet! Light Base 600 DX Mid Tower ARGB Negro");
    });

    it("should normalize Light Base 600 LX White", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Be quiet! Light Base 600 LX White, 4x120mm ARGB, ATX, Color Blanco",
      );
      expect(result).toBe("Be quiet! Light Base 600 LX Mid Tower ARGB Blanco");
    });

    it("should normalize Shadow Base 800DX Window White", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Be Quiet! Shadow Base 800DX Window White, Full Tower, ARGB, 3x Pure Wings 3",
      );
      expect(result).toBe("Be quiet! Shadow Base 800DX Window Full Tower ARGB Blanco");
    });

    it("should normalize Pure Base 501 LX Black", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Be quiet! Pure Base 501 LX Black, 3x120mm ARGB, 1x140mm ARGB, ATX, Color Negro",
      );
      expect(result).toBe("Be quiet! Pure Base 501 LX Mid Tower ARGB Negro");
    });
  });

  describe("XPG/ADATA cases", () => {
    it("should normalize Cruiser ST White", () => {
      const result = normalizeCaseTitle("GABINETE GAMER ADATA XPG CRUISER ST BLANCO P/N CRUISERST-WHCWW");
      expect(result).toBe("XPG Cruiser ST Mid Tower Blanco");
    });

    it("should normalize Defender Pro Negro", () => {
      const result = normalizeCaseTitle("GABINETE GAMER ADATA XPG DEFENDER PRO NEGRO P/N DEFENDERPRO-BKCWW");
      expect(result).toBe("XPG Defender Pro Mid Tower Negro");
    });

    it("should normalize Defender Negro E-ATX", () => {
      const result = normalizeCaseTitle("GABINETE GAMER ADATA XPG DEFENDER NEGRO E-ATX P/N DEFENDER-BKCWW");
      expect(result).toBe("XPG Defender Full Tower Negro");
    });
  });

  describe("Cougar cases", () => {
    it("should normalize Duoface RGB Negro", () => {
      const result = normalizeCaseTitle(
        "Gabinete COUGAR Duoface RGB - Mid Tower Paneles Frontales Intercambiables y Ventiladores ARGB, Negro",
      );
      // ARGB takes priority over RGB when both are present
      expect(result).toBe("Cougar Duoface Mid Tower ARGB Negro");
    });

    it("should normalize Duoface RGB White", () => {
      const result = normalizeCaseTitle("GABINETE COUGAR DUOFACE RGB WHITE 385ZD10.0003");
      expect(result).toBe("Cougar Duoface RGB Blanco");
    });

    it("should normalize Panzer Max-G", () => {
      const result = normalizeCaseTitle(
        "Gabinete COUGAR Panzer Max-G Full Tower con Panel de Vidrio Templado y Amplia Capacidad de Expansión",
      );
      expect(result).toBe("Cougar Panzer Max-G Full Tower TG");
    });

    it("should normalize Archon 2 RGB White", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer COUGAR Archon 2 RGB - Mid Tower con Vidrio Templado y Ventiladores ARGB, Blanco",
      );
      // ARGB takes priority over RGB when both are present
      expect(result).toBe("Cougar Archon 2 Mid Tower TG ARGB Blanco");
    });

    it("should normalize Uniface USB-C", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Cougar Uniface USB-C Vidrio Templado, RGB, Mid Tower, Micro ATX, ATX, Negro",
      );
      expect(result).toBe("Cougar Uniface Mid Tower TG RGB Negro");
    });
  });

  describe("Gigabyte cases", () => {
    it("should normalize C500 Panoramic Stealth Ice", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Gigabyte C500 Panoramic Stealth Ice, ATX, Mid Tower, Color Blanco",
      );
      expect(result).toBe("Gigabyte C500 Panoramic Stealth Ice Mid Tower Blanco");
    });

    it("should normalize C301 Glass White", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Gigabyte C301 Glass, ATX extendida, Vidrio templado, Color Blanco",
      );
      // Glass already implies TG, so TG is not added separately
      expect(result).toBe("Gigabyte C301 Glass Full Tower Blanco");
    });
  });

  describe("ASUS cases", () => {
    it("should normalize ProArt PA401 Wood Edition", () => {
      const result = normalizeCaseTitle(
        "Gabinete ASUS ProArt PA401 Wood Edition, Vidrio Templado, 2x 160mm, 1x 120mm, ATX, Black",
      );
      expect(result).toBe("ASUS ProArt PA401 Wood Edition Mid Tower TG Negro");
    });

    it("should normalize A31 TG White", () => {
      const result = normalizeCaseTitle("GABINETE GAMER ASUS A31 TG WHITE 90DC00R3-B08000");
      expect(result).toBe("ASUS A31 Mid Tower TG Blanco");
    });
  });

  describe("Gamemax cases", () => {
    it("should normalize Starlight 2AB", () => {
      const result = normalizeCaseTitle("GABINETE GAMEMAX STARLIGHT 2AB SIN FUENTE ATX");
      expect(result).toBe("Gamemax Starlight Mid Tower");
    });

    it("should normalize Blade Concept", () => {
      const result = normalizeCaseTitle("GABINETE GAMEMAX BLADE CONCEPT BK ATX 1 USB-C");
      expect(result).toBe("Gamemax Blade Concept Mid Tower Negro");
    });

    it("should normalize Diamond CP BK", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer GameMax Diamond CP BK, ATX/mATX/E-ATX, 3xARGB, Vidrio Templado, Sop.280mm , Mid Tower",
      );
      expect(result).toBe("Gamemax Diamond CP Mid Tower TG ARGB Negro");
    });
  });

  describe("Kolink cases", () => {
    it("should normalize Void X RGB", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Kolink Void X RGB, Vidrio Templado, Mid Tower, ATX, Mini-ATX, Mini-ITX",
      );
      expect(result).toBe("Kolink Void X Mid Tower TG RGB");
    });

    it("should normalize Inspire K5", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer KOLINK Inspire Series K5 BLACK RGB, Vidrio Templado, ATX, MICRO-ATX, MINI-ITX",
      );
      expect(result).toBe("Kolink Inspire K5 Mid Tower TG RGB Negro");
    });
  });

  describe("APNX cases", () => {
    it("should normalize Creator C1 ARGB White", () => {
      const result = normalizeCaseTitle("Gabinete Gamer Premium APNX Creator C1 ARGB, Color Blanco");
      expect(result).toBe("APNX Creator C1 Mid Tower ARGB Blanco");
    });

    it("should normalize Creator C1 ChromaFlair Limited Edition", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Premium APNX Creator C1 ARGB, Color ChromaFlair Limited Edition, Incluye 4 Fans",
      );
      expect(result).toBe("APNX Creator C1 ChromaFlair Limited Edition Mid Tower ARGB");
    });
  });

  describe("Clio cases", () => {
    it("should normalize S613 Slim Corporativo", () => {
      const result = normalizeCaseTitle(
        "Gabinete Corporativo Clio S613 Slim, Incluye Fuente Poder 600W, Negro ,USB-C, USB 3.0, Micro-ATX",
      );
      expect(result).toBe("Clio S613 Micro ATX Negro");
    });

    it("should normalize Mado", () => {
      const result = normalizeCaseTitle("GABINETE GAMER CLIO MADO VIDRIO TEMPLADO 2USB 3.0 ATX");
      expect(result).toBe("Clio Mado Mid Tower TG");
    });

    it("should normalize P3B", () => {
      const result = normalizeCaseTitle("GABINETE GAMER CLIO P3B 3 FAN ARGB 2USB 3,0 ATX");
      expect(result).toBe("Clio P3B Mid Tower ARGB");
    });
  });

  describe("Aerocool cases", () => {
    it("should normalize Airhawk Duo", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Aerocool Airhawk Duo, Vidrio Templado, 2xRGB 20cm, 1xRGB 12cm, E-ATX",
      );
      expect(result).toBe("Aerocool Airhawk Duo Full Tower TG RGB");
    });
  });

  describe("Thermaltake cases", () => {
    it("should normalize Divider 370 TG", () => {
      const result = normalizeCaseTitle(
        "Gabinete Gamer Thermaltake Divider 370 TG, Mid Tower, ATX, Vidrio Templado, Negro",
      );
      expect(result).toBe("Thermaltake Divider 370 Mid Tower TG Negro");
    });
  });
});
