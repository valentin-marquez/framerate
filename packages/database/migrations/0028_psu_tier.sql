-- Calidad de fuentes de poder (#177): copia de una tier list externa, de uso interno para la regla `psu_tier` de la
-- compatibilidad. Se reemplaza entera en cada importación (`apps/server/scripts/psu-tiers.ts`); nada la referencia.
CREATE TABLE psu_tier (
  id INTEGER PRIMARY KEY,
  brand TEXT NOT NULL,
  -- Claves de la marca entre espacios, para buscar con LIKE '% clave %': "Antec/Atom" → ' antecatom antec atom '.
  brand_key TEXT NOT NULL,
  series TEXT NOT NULL,
  subseries TEXT NOT NULL DEFAULT '',
  variant TEXT NOT NULL DEFAULT '',
  -- JSON: potencias que cubre la fila, [650, 750, 850].
  wattages TEXT NOT NULL,
  -- A+ a F, sin el asterisco.
  tier TEXT NOT NULL,
  -- La planilla marca con * el tier especulativo, sin datos suficientes.
  limited INTEGER NOT NULL DEFAULT 0,
  year INTEGER,
  form_factor TEXT,
  atx_version TEXT,
  -- full, semi o none, como `modular` de las specs de fuente.
  modular TEXT,
  -- white, bronze, silver, gold, platinum o titanium, como `efficiency` de la identidad; null sin certificación.
  efficiency TEXT,
  odm TEXT,
  platform TEXT,
  -- Traducidas al español en la importación.
  notes TEXT,
  source_version TEXT NOT NULL
);
