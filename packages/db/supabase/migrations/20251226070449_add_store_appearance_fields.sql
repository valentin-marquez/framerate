ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS appearance varchar(5) DEFAULT 'light' NOT NULL CHECK (appearance IN ('dark','light'));

-- Comment for clarity
COMMENT ON COLUMN public.stores.appearance IS 
  'Appearance indicator: ''dark'' or ''light''. Used by frontend to adjust rendering.';
