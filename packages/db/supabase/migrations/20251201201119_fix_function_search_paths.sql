-- Fix function search paths for security
-- https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

ALTER FUNCTION public.extract_numeric_value(text) SET search_path = public;
ALTER FUNCTION public.increment_product_view(text) SET search_path = public;
ALTER FUNCTION public.filter_products(text, text, integer, integer, text, jsonb, text, integer, integer) SET search_path = public;
