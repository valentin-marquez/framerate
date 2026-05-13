-- Drop existing policy if it exists (names must match exactly what was created before)
drop policy if exists "Service role has full access to products_canonical" on public.products_canonical;

-- Re-create explicit policies for Service Role
-- We use both auth.role() (JWT) and current_user (Session) to be safe.

create policy "Service_Role_Select_Products_Canonical"
on public.products_canonical
for select
using (
    (select auth.role()) = 'service_role' OR current_user = 'service_role'
);

create policy "Service_Role_Insert_Products_Canonical"
on public.products_canonical
for insert
with check (
    (select auth.role()) = 'service_role' OR current_user = 'service_role'
);

create policy "Service_Role_Update_Products_Canonical"
on public.products_canonical
for update
using (
    (select auth.role()) = 'service_role' OR current_user = 'service_role'
)
with check (
    (select auth.role()) = 'service_role' OR current_user = 'service_role'
);

create policy "Service_Role_Delete_Products_Canonical"
on public.products_canonical
for delete
using (
    (select auth.role()) = 'service_role' OR current_user = 'service_role'
);
