-- Insert Eylstore into stores table
INSERT INTO public.stores (name, slug, url, logo_url, is_active)
VALUES (
    'Eylstore',
    'eylstore',
    'https://www.eylstore.cl',
    'https://www.eylstore.cl/EYL_Logo%20Horizontal.webp',
    true
)
ON CONFLICT (name) DO UPDATE SET
    url = EXCLUDED.url,
    logo_url = EXCLUDED.logo_url,
    is_active = EXCLUDED.is_active;
-- Ensure RLS allows service role to insert/update (though service role usually bypasses RLS, 
-- explicit policies for authenticated users might be needed if we were doing this from client)
-- The error "new row violates row-level security policy" suggests we might be using a client 
-- that respects RLS or the policy is too restrictive even for what we are doing.
-- However, the scraper uses the SERVICE_ROLE_KEY which bypasses RLS.
-- If the user is seeing RLS error, it might be because they are NOT using the service role key correctly
-- OR they are using the anon key.
-- BUT, just in case, let's add a policy for the service role if it wasn't implicit, 
-- although in Supabase service_role bypasses everything.

-- Wait, the previous error "new row violates row-level security policy" happened in the scraper worker.
-- This confirms the scraper is likely NOT using the service role key correctly or the client is initialized wrong.
-- But we fixed the .env to use SERVICE_ROLE_KEY.
-- If it still fails, it might be because the client initialization in `src/lib/supabase.ts` 
-- is not picking up the key correctly or the key in .env is actually an ANON key.

-- Regardless, seeding the store here is good practice.;
