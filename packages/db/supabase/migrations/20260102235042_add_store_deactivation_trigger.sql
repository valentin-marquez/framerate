-- Function to deactivate all listings when a store is deactivated
CREATE OR REPLACE FUNCTION public.deactivate_store_listings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- If the store is being deactivated (is_active changed from true to false)
    IF OLD.is_active = true AND NEW.is_active = false THEN
        -- Deactivate all listings for this store
        UPDATE public.listings
        SET is_active = false,
            updated_at = NOW()
        WHERE store_id = NEW.id
        AND is_active = true;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on stores table
DROP TRIGGER IF EXISTS trigger_deactivate_store_listings ON public.stores;

CREATE TRIGGER trigger_deactivate_store_listings
    AFTER UPDATE ON public.stores
    FOR EACH ROW
    WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
    EXECUTE FUNCTION public.deactivate_store_listings();

-- Add comment for documentation
COMMENT ON FUNCTION public.deactivate_store_listings() IS 
'Automatically deactivates all listings when their associated store is deactivated';
