-- Drop existing policy if it exists
drop policy if exists "Service role has full access to raw_feed" on public.raw_feed;

-- Re-create explicit policies for Service Role

create policy "Service_Role_Select_Raw_Feed"
on public.raw_feed
for select
using (
    (select auth.role()) = 'service_role' OR current_user = 'service_role'
);

create policy "Service_Role_Insert_Raw_Feed"
on public.raw_feed
for insert
with check (
    (select auth.role()) = 'service_role' OR current_user = 'service_role'
);

create policy "Service_Role_Update_Raw_Feed"
on public.raw_feed
for update
using (
    (select auth.role()) = 'service_role' OR current_user = 'service_role'
)
with check (
    (select auth.role()) = 'service_role' OR current_user = 'service_role'
);

create policy "Service_Role_Delete_Raw_Feed"
on public.raw_feed
for delete
using (
    (select auth.role()) = 'service_role' OR current_user = 'service_role'
);
