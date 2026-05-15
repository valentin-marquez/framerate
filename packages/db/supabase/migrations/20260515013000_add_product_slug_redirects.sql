-- Mantiene un historial de slugs obsoletos por producto para que la web/API
-- puedan emitir HTTP 301 cuando un producto cambia de nombre/slug (renombres
-- por backfill, correcciones de datos, etc.).
CREATE TABLE public.product_slug_redirects (
    old_slug text PRIMARY KEY,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_product_slug_redirects_product_id ON public.product_slug_redirects(product_id);

ALTER TABLE public.product_slug_redirects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public_Read_Slug_Redirects"
    ON public.product_slug_redirects FOR SELECT USING (true);

CREATE POLICY "Service_Role_Write_Slug_Redirects"
    ON public.product_slug_redirects FOR ALL
    USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

COMMENT ON TABLE public.product_slug_redirects IS
    'Mapea slugs obsoletos a su producto actual para servir HTTP 301 después de renombres.';
