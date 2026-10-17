-- Referencia de procesadores (#179): una fila por modelo desde las fichas oficiales de AMD e Intel. La normalización
-- le muestra a Haiku los modelos cuyo número está en el título y escribe estas specs con fuente `reference`. Se
-- reemplaza entera en cada importación (`apps/normalize/scripts/cpu-reference.ts`).
CREATE TABLE cpu_reference (
  -- Minúsculas, como `identity.model`: "ryzen 7 7800x3d", "core i5 12400f", "core ultra 7 265k".
  model TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  name TEXT NOT NULL,
  -- El número del modelo ("7800", "12400", "265"): se busca por los números del título.
  number TEXT NOT NULL,
  -- Como lo escriben las specs: "AM5", "LGA1700".
  socket TEXT,
  cores_total INTEGER,
  cores_performance INTEGER,
  cores_efficiency INTEGER,
  threads INTEGER,
  base_ghz REAL,
  boost_ghz REAL,
  l3_mb REAL,
  tdp_w INTEGER,
  max_power_w INTEGER,
  -- null si no tiene gráficos integrados.
  integrated_graphics TEXT,
  -- Cooler de la caja: '' si no trae, null si la ficha no lo dice.
  boxed_cooler TEXT,
  -- "DDR4, DDR5".
  memory_types TEXT,
  memory_max_mt_s INTEGER,
  launch TEXT,
  -- JSON: códigos de producto del fabricante (Boxed, Tray, MPK).
  part_numbers TEXT NOT NULL DEFAULT '[]',
  source_url TEXT NOT NULL
);
CREATE INDEX cpu_reference_number ON cpu_reference (number);
