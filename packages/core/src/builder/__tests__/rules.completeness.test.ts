import { describe, expect, test } from "bun:test";
import { CompletenessRule } from "../index";
import { makeCase, makeFullValidBuild } from "./fixtures";

describe("CompletenessRule", () => {
  test("build completo => sin issues", () => {
    const issues = CompletenessRule.validate(makeFullValidBuild());
    // No deberían haber errores ni warnings (puede haber info como
    // "USING_INTEGRATED_GRAPHICS" pero NO con un GPU dedicado presente).
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  test("falta CPU => error MISSING_COMPONENT", () => {
    const build = makeFullValidBuild();
    delete (build as Partial<typeof build>).cpu;
    const issues = CompletenessRule.validate(build);
    expect(issues.some((i) => i.code === "MISSING_COMPONENT" && i.severity === "error")).toBe(true);
  });

  test("case con included_fans=null => INSUFFICIENT_DATA, NO falso positivo NO_CASE_FANS", () => {
    const build = makeFullValidBuild();
    build.case = makeCase({ included_fans: null });
    const issues = CompletenessRule.validate(build);
    expect(issues.some((i) => i.code === "INSUFFICIENT_DATA")).toBe(true);
    expect(issues.some((i) => i.code === "NO_CASE_FANS")).toBe(false);
  });

  test("case con included_fans=0 y sin extra fans => warning NO_CASE_FANS", () => {
    const build = makeFullValidBuild();
    build.case = makeCase({ included_fans: 0 });
    const issues = CompletenessRule.validate(build);
    expect(issues.some((i) => i.code === "NO_CASE_FANS" && i.severity === "warning")).toBe(true);
  });
});
