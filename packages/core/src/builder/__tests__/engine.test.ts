import { describe, expect, test } from "bun:test";
import { ALL_RULES, analyzeBuild, CompatibilityEngine, estimatePerformance, inferGpuArchitecture } from "../index";
import { makeCpu, makeFullValidBuild, makeGpu, makeMobo } from "./fixtures";

describe("analyzeBuild", () => {
  test("build válido completo => status valid y tier > Mid / 1080p", () => {
    const build = makeFullValidBuild();
    const result = analyzeBuild(build);

    expect(result.status).toBe("valid");
    expect(result.performance).toBeDefined();
    const tier = result.performance?.tier;
    // Con RTX 5070 + Ryzen 7 9700X esperamos ≥ "High / 1440p".
    expect(["High / 1440p", "Elite", "4K / Enthusiast"]).toContain(tier as string);
  });

  test("AM4 CPU + AM5 motherboard => incompatible con SOCKET_MISMATCH", () => {
    const build = makeFullValidBuild();
    build.cpu = makeCpu({ socket: "AM4", microarchitecture: "Zen 3" });

    const result = analyzeBuild(build);

    expect(result.status).toBe("incompatible");
    expect(result.issues.some((i) => i.code === "SOCKET_MISMATCH")).toBe(true);
  });

  test("RTX 5070 con architecture: null => infiere Blackwell", () => {
    const gpu = makeGpu({ architecture: null });
    const arch = inferGpuArchitecture(gpu.specs as never);
    expect(arch).toBe("Blackwell");
  });

  test("estimatePerformance usa arquitectura inferida cuando architecture=null", () => {
    const cpu = makeCpu();
    const gpuNullArch = makeGpu({ architecture: null });
    const gpuExplicit = makeGpu({ architecture: "Blackwell" });

    const perfInferred = estimatePerformance({ cpu, gpu: gpuNullArch });
    const perfExplicit = estimatePerformance({ cpu, gpu: gpuExplicit });

    // Ambos scores deben coincidir si la inferencia es correcta.
    expect(perfInferred.gpuScore).toBe(perfExplicit.gpuScore);
    // Y debe ser claramente superior a un build "Pascal-fallback" (factor 1.0):
    const gpuFallback = makeGpu({ architecture: "Pascal" });
    const perfFallback = estimatePerformance({ cpu, gpu: gpuFallback });
    expect(perfInferred.gpuScore).toBeGreaterThan(perfFallback.gpuScore);
  });

  test("CompatibilityEngine.run sigue funcionando (back-compat)", () => {
    const engine = new CompatibilityEngine(ALL_RULES);
    const build = makeFullValidBuild();
    const result = engine.run(build);
    expect(result.status).toBe("valid");
  });
});

describe("inferGpuArchitecture", () => {
  test("RTX 50xx => Blackwell", () => {
    expect(inferGpuArchitecture({ chipset: "GeForce RTX 5070" } as never)).toBe("Blackwell");
    expect(inferGpuArchitecture({ chipset: "GeForce RTX 5090 Ti" } as never)).toBe("Blackwell");
  });
  test("RTX 40xx => Ada Lovelace", () => {
    expect(inferGpuArchitecture({ chipset: "GeForce RTX 4070" } as never)).toBe("Ada Lovelace");
  });
  test("RTX 30xx => Ampere", () => {
    expect(inferGpuArchitecture({ chipset: "GeForce RTX 3060" } as never)).toBe("Ampere");
  });
  test("RTX 20xx / GTX 16xx => Turing", () => {
    expect(inferGpuArchitecture({ chipset: "GeForce RTX 2070" } as never)).toBe("Turing");
    expect(inferGpuArchitecture({ chipset: "GeForce GTX 1660 Super" } as never)).toBe("Turing");
  });
  test("GTX 10xx => Pascal", () => {
    expect(inferGpuArchitecture({ chipset: "GeForce GTX 1080 Ti" } as never)).toBe("Pascal");
  });
  test("RX 9xxx => RDNA 4", () => {
    expect(inferGpuArchitecture({ chipset: "Radeon RX 9070 XT" } as never)).toBe("RDNA 4");
  });
  test("RX 7xxx => RDNA 3", () => {
    expect(inferGpuArchitecture({ chipset: "Radeon RX 7800 XT" } as never)).toBe("RDNA 3");
  });
  test("RX 6xxx => RDNA 2", () => {
    expect(inferGpuArchitecture({ chipset: "Radeon RX 6700 XT" } as never)).toBe("RDNA 2");
  });
  test("RX 5xxx => RDNA", () => {
    expect(inferGpuArchitecture({ chipset: "Radeon RX 5700 XT" } as never)).toBe("RDNA");
  });
  test("chipset null => null", () => {
    expect(inferGpuArchitecture({ chipset: null } as never)).toBeNull();
  });
  test("chipset desconocido => null", () => {
    expect(inferGpuArchitecture({ chipset: "Some Future GPU" } as never)).toBeNull();
  });
});

// Sanity check: que makeMobo siga siendo válido en aislamiento (no toca al engine).
describe("fixtures sanity", () => {
  test("makeMobo retorna AM5 por default", () => {
    const m = makeMobo();
    expect((m.specs as never as { socket: string }).socket).toBe("AM5");
  });
});
