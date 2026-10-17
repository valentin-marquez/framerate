-- Referencia de tarjetas de video por chipset (#180), desde la tabla de especificaciones de AMD y las páginas por
-- familia de NVIDIA. La normalización le muestra a Haiku los chipsets cuyo número está en el título y la usa sólo para
-- completar specs: lo que diga la tienda sobre una tarjeta gana, porque cada fabricante cambia consumo, largo y
-- conectores. Se reemplaza entera (`apps/normalize/scripts/gpu-reference.ts`).
CREATE TABLE gpu_reference (
  -- Minúsculas, como `identity.chipset`: "rtx 5070 ti", "rx 9070 xt". Con la memoria cuando las variantes consumen
  -- distinto: "rtx 3050 8gb".
  chipset TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  name TEXT NOT NULL,
  -- El número del chipset ("5070"): se busca por los números del título.
  number TEXT NOT NULL,
  -- "Blackwell", "Ada Lovelace", "RDNA 4".
  architecture TEXT,
  launch TEXT,
  -- Núcleos CUDA o stream processors.
  shader_cores INTEGER,
  -- Consumo de la tarjeta de referencia (TGP de NVIDIA, Typical Board Power de AMD).
  board_power_w INTEGER,
  -- Fuente mínima que recomienda el fabricante del chip.
  min_psu_w INTEGER,
  -- Conectores de la tarjeta de referencia; las de cada marca pueden traer otros.
  power_connectors TEXT,
  -- "GDDR7".
  memory_type TEXT,
  -- JSON: las capacidades de memoria del chipset, [8, 16].
  vram_gb TEXT NOT NULL DEFAULT '[]',
  memory_bus_bit INTEGER,
  pcie_version TEXT,
  -- Largo de la tarjeta de referencia (Founders Edition); las de cada marca varían.
  reference_length_mm INTEGER,
  source_url TEXT NOT NULL
);
CREATE INDEX gpu_reference_number ON gpu_reference (number);

-- Procesadores: nombre en clave ("Raphael", "Raptor Lake") y nodo de fabricación, de las mismas fichas (#179).
ALTER TABLE cpu_reference ADD COLUMN codename TEXT;
ALTER TABLE cpu_reference ADD COLUMN lithography TEXT;
