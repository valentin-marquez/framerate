-- Agregar columna stock_quantity a la tabla listings
-- Esto permite rastrear disponibilidad y niveles de stock por listado de tienda

-- Agregar la columna stock_quantity
-- NULL significa desconocido, 0 significa sin stock, enteros positivos representan cantidad real
ALTER TABLE public.listings
ADD COLUMN stock_quantity INTEGER DEFAULT NULL;

-- Agregar comentario para documentar la columna
COMMENT ON COLUMN public.listings.stock_quantity IS 
    'Cantidad de stock en la tienda. NULL = desconocido, 0 = sin stock, >0 = cantidad disponible';

-- Crear índice para filtrado eficiente por estado de stock
-- Esto ayuda con consultas como "mostrar solo productos en stock"
CREATE INDEX idx_listings_stock_quantity ON public.listings (stock_quantity)
WHERE stock_quantity IS NOT NULL;

-- Crear índice parcial para encontrar ítems sin stock
CREATE INDEX idx_listings_out_of_stock ON public.listings (product_id, store_id)
WHERE stock_quantity = 0 OR is_active = FALSE;

-- Crear índice parcial para encontrar ítems en stock (consulta más común)
CREATE INDEX idx_listings_in_stock ON public.listings (product_id, store_id)
WHERE stock_quantity > 0 AND is_active = TRUE;

