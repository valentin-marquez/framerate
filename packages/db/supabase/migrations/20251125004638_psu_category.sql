INSERT INTO public.categories (name, slug)
VALUES ('Power Supply', 'psu')
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name;

