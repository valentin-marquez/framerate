-- Referencia de ventiladores de gabinete por familia y tamaño (#181), desde las fichas de cada fabricante. La
-- normalización le muestra a Haiku las familias de la marca y la usa para completar specs que las tiendas casi nunca
-- dicen (ruido, presión, rodamiento, iluminación). Se reemplaza entera (`apps/normalize/scripts/fan-reference.ts`).
CREATE TABLE fan_reference (
  id INTEGER PRIMARY KEY,
  brand TEXT NOT NULL,
  -- `brand` en minúsculas y sólo letras y números: "be quiet!" → "bequiet".
  brand_key TEXT NOT NULL,
  -- Nombre oficial sin la marca: "UNI FAN SL V2", "P12 PWM PST".
  family TEXT NOT NULL,
  size_mm INTEGER,
  rpm_min INTEGER,
  rpm_max INTEGER,
  airflow_cfm REAL,
  static_pressure_mmh2o REAL,
  noise_dba REAL,
  -- fdb, hydraulic, rifle, sleeve, ball, dual_ball, maglev, lcp_fdb u otro texto corto.
  bearing TEXT,
  -- 3pin, 4pin_pwm, molex o proprietary.
  fan_connector TEXT,
  -- none, rgb_12v, argb_5v o proprietary.
  lighting TEXT,
  -- El controlador o hub que necesita ("L-Connect 3"); requires_controller = 1 si no va directo a la placa.
  controller TEXT,
  requires_controller INTEGER,
  daisy_chain INTEGER,
  warranty_years INTEGER,
  -- JSON: cómo escribe el catálogo esta familia ("mf120 halo", "masterfan mf120 halo argb").
  aliases TEXT NOT NULL DEFAULT '[]',
  source_url TEXT
);
CREATE INDEX fan_reference_brand ON fan_reference (brand_key);
