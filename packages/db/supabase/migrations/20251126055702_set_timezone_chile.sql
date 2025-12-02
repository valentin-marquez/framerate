-- Establecer zona horaria por defecto a Chile (America/Santiago)
-- Esto afecta cómo se muestran las marcas de tiempo al consultar sin conversión explícita

-- Establecer zona horaria de la base de datos
ALTER DATABASE postgres SET timezone TO 'America/Santiago';

-- También establecer para la sesión actual
SET timezone TO 'America/Santiago';

-- Nota: Las marcas de tiempo se almacenan en UTC internamente, pero se muestran en hora de Chile al consultar.
-- Este es el enfoque recomendado ya que mantiene la integridad de los datos mientras muestra la hora local.

