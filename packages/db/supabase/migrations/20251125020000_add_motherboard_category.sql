INSERT INTO public.categories (name, slug)
VALUES ('Motherboard', 'motherboard')
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name;

