import { describe, expect, test } from "bun:test";
import { HandSchema, MmRangeParamSchema, MouseFitReportRequestSchema, mmRangeParam, mouseFit } from "./mouse-fit";

const hand = { length_mm: 190, width_mm: 95, grip: "palm" as const };

describe("rango de mouse", () => {
  test("una mano de 190 × 95 mm con palma", () => {
    expect(mouseFit(hand)).toEqual({ length: { min: 106, max: 122 }, width: { min: 56, max: 68 } });
  });

  test("garra da un rango menor que palma, y puntas de los dedos menor que garra", () => {
    const [palm, claw, fingertip] = (["palm", "claw", "fingertip"] as const).map(
      (grip) => mouseFit({ ...hand, grip }).length.max,
    );
    expect(claw).toBeLessThan(palm as number);
    expect(fingertip).toBeLessThan(claw as number);
  });
});

describe("esquemas", () => {
  test("19 no es una mano: son centímetros", () => {
    expect(HandSchema.safeParse({ ...hand, length_mm: 19 }).success).toBe(false);
    expect(HandSchema.safeParse({ ...hand, width_mm: 200 }).success).toBe(false);
    expect(HandSchema.safeParse({ ...hand, grip: "hybrid" }).success).toBe(false);
  });

  test("el rango de la URL ida y vuelta", () => {
    const range = MmRangeParamSchema.parse("106-122");
    expect(range).toEqual({ min: 106, max: 122 });
    expect(mmRangeParam(range)).toBe("106-122");
  });

  test("un rango invertido o que no es número se rechaza", () => {
    expect(MmRangeParamSchema.safeParse("122-106").success).toBe(false);
    expect(MmRangeParamSchema.safeParse("abc").success).toBe(false);
    expect(MmRangeParamSchema.safeParse("106").success).toBe(false);
  });

  test("un caso de calibración trae qué tal le queda", () => {
    const report = { ...hand, product_slug: "logitech-g305", fit: "right" };
    expect(MouseFitReportRequestSchema.safeParse(report).success).toBe(true);
    expect(MouseFitReportRequestSchema.safeParse({ ...report, fit: "enorme" }).success).toBe(false);
  });
});
