-- 20260105150000_update_extraction_jobs.sql
-- Add useful search columns to extraction_jobs table

ALTER TABLE public.extraction_jobs 
ADD COLUMN IF NOT EXISTS normalized_title text,
ADD COLUMN IF NOT EXISTS brand text,
ADD COLUMN IF NOT EXISTS url text;

COMMENT ON COLUMN public.extraction_jobs.normalized_title IS 'Cleaned and normalized product title for easier searching';
COMMENT ON COLUMN public.extraction_jobs.brand IS 'Detected brand/manufacturer of the product';
COMMENT ON COLUMN public.extraction_jobs.url IS 'Source URL of the product listing';
