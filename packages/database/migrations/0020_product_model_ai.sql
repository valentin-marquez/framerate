-- Modelo del producto sacado de su nombre por el modelo de lenguaje, para las categorías sin clave de atributos
-- (gabinetes, coolers y ventiladores): sin esto dos fichas del mismo gabinete nunca se comparan, porque el puntaje
-- máximo sin clave es 0,45 y la banda de revisión empieza en 0,6 (#98).
--
-- No va en `attributes` porque esa columna se reconstruye desde el nombre en cada carga (`loadCandidates`), y esto
-- no se puede derivar del título con reglas: lo que identifica un gabinete es un código corto (FV270, NR200P,
-- TD 300) que ninguna expresión regular general reconoce.
ALTER TABLE products ADD COLUMN model_ai TEXT;
-- Cuándo se preguntó. Un nombre del que el modelo no supo sacar nada queda con fecha y `model_ai` nula, para no
-- volver a gastar neurons en él.
ALTER TABLE products ADD COLUMN model_ai_at TEXT;
