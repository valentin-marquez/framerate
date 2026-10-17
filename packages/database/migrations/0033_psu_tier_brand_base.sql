-- Nota base por marca (#177): cuando ningún modelo calza, la calidad típica de la marca. Filas con series = '*' y
-- origin = 'brand', siempre especulativas: para las marcas de la tier list sale de sus propias notas (el rango donde
-- cae la mitad central), para las demás de una investigación general de la marca (`psu-tiers.brands.json`).
-- `tier` es la peor nota del rango y `best` la mejor; en las filas de modelo `best` queda null.
ALTER TABLE psu_tier ADD COLUMN best TEXT;
