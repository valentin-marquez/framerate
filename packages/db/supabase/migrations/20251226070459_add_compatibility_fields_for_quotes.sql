-- Migration: Add compatibility fields to quotes table
-- This enables caching of validation results for better UI performance

-- Create enum for compatibility status
CREATE TYPE public.compatibility_status AS ENUM ('valid', 'warning', 'incompatible', 'unknown');

-- Add compatibility fields to quotes table
ALTER TABLE public.quotes 
ADD COLUMN compatibility_status public.compatibility_status DEFAULT 'unknown',
ADD COLUMN estimated_wattage integer, -- Estimated power consumption in Watts
ADD COLUMN validation_errors jsonb DEFAULT '[]'::jsonb, -- Cached validation issues for quick UI rendering
ADD COLUMN last_analyzed_at timestamp with time zone; -- When was the last analysis performed

-- Create index for filtering quotes by compatibility status
CREATE INDEX idx_quotes_compatibility_status ON public.quotes(compatibility_status);

-- Create index for filtering by user and status (common query pattern)
CREATE INDEX idx_quotes_user_status ON public.quotes(user_id, compatibility_status);

-- Add comment explaining the fields
COMMENT ON COLUMN public.quotes.compatibility_status IS 'Cached compatibility status: valid, warning, incompatible, or unknown (not yet analyzed)';
COMMENT ON COLUMN public.quotes.estimated_wattage IS 'Estimated total power consumption in Watts based on component specs';
COMMENT ON COLUMN public.quotes.validation_errors IS 'Array of validation issues found during last analysis (see BuildAnalysis type)';
COMMENT ON COLUMN public.quotes.last_analyzed_at IS 'Timestamp of the last compatibility analysis';

-- Create function to update compatibility cache
-- This can be called after quote items are modified
CREATE OR REPLACE FUNCTION public.invalidate_quote_compatibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When quote items change, mark the quote as needing re-analysis
  UPDATE public.quotes
  SET 
    compatibility_status = 'unknown',
    last_analyzed_at = NULL
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to auto-invalidate cache when quote items change
DROP TRIGGER IF EXISTS trigger_invalidate_quote_compatibility ON public.quote_items;
CREATE TRIGGER trigger_invalidate_quote_compatibility
AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
FOR EACH ROW
EXECUTE FUNCTION public.invalidate_quote_compatibility();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.invalidate_quote_compatibility() TO authenticated, service_role;