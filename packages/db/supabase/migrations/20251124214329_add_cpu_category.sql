INSERT INTO public.categories (name, slug)
VALUES ('Processor', 'cpu')
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name;

