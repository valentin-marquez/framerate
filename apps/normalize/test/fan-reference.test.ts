import { describe, expect, test } from "bun:test";
import { toReference } from "../scripts/fan-reference";
import { type FanReference, fillFromFanReference, pickFanReference } from "../src/fan-reference";

const ref = (over: Partial<FanReference>): FanReference => ({
  brand: "Lian Li",
  family: "UNI FAN SL V2",
  size_mm: 120,
  rpm_min: 250,
  rpm_max: 2000,
  airflow_cfm: 64.5,
  static_pressure_mmh2o: 2.59,
  noise_dba: 29.2,
  bearing: "fdb",
  fan_connector: "4pin_pwm",
  lighting: "argb_5v",
  controller: "L-Connect 3",
  requires_controller: false,
  daisy_chain: true,
  warranty_years: 2,
  aliases: ["uni fan sl120 v2", "sl120 v2"],
  source_url: "https://lian-li.com/product/uni-fan-sl-v2/",
  ...over,
});

describe("referencia de ventiladores", () => {
  const refs = [ref({}), ref({ size_mm: 140, rpm_max: 1600, airflow_cfm: 77.6 })];

  test("calza por nombre de familia o por cómo lo escribe el catálogo, y elige el tamaño", () => {
    expect(pickFanReference(refs, "UNI FAN SL V2", 140)?.rpm_max).toBe(1600);
    expect(pickFanReference(refs, "sl120 v2", null)?.size_mm).toBe(120);
    expect(pickFanReference(refs, "uni fan tl", 120)).toBeUndefined();
  });

  test("completa lo que falta, nunca lo que dice la tienda, y el controlador sólo si es obligatorio", () => {
    const out = fillFromFanReference({ rpm_max: 1900 }, { rpm_max: "text" }, refs[0]);
    expect(out.specs).toMatchObject({
      rpm_max: 1900,
      noise_dba_max: 29.2,
      bearing: "fdb",
      lighting: "argb_5v",
      pwm: true,
    });
    expect(out.specs.fan_controller).toBeUndefined();
    const wireless = ref({
      requires_controller: true,
      controller: "Receptor L-Wireless",
      fan_connector: "proprietary",
    });
    expect(fillFromFanReference({}, {}, wireless).specs).toMatchObject({
      fan_controller: "Receptor L-Wireless",
      pwm: false,
    });
  });

  test("la investigación se normaliza y lo que no identifica una familia se descarta", () => {
    expect(
      toReference({ brand: "Arctic", family: "P12 PWM PST", bearing: "FDB", noise_dba: 0, source_url: "x" }),
    ).toMatchObject({
      bearing: "fdb",
      noise_dba: null,
      source_url: null,
    });
    expect(toReference({ brand: "Arctic", family: null, catalog_models: ["p12 pro"] })).toBeNull();
  });
});
