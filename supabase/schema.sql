-- Salomäki: one private JSON document per signed-in user and app area.
create table if not exists public.user_documents (
  user_id uuid not null references auth.users(id) on delete cascade,
  document_key text not null check (document_key in ('tasks', 'leads', 'personal', 'complaints')),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, document_key)
);

alter table public.user_documents enable row level security;

revoke all on table public.user_documents from anon, authenticated;
grant select, insert, update, delete on table public.user_documents to authenticated;

drop policy if exists "Users can read their own documents" on public.user_documents;
create policy "Users can read their own documents"
  on public.user_documents for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own documents" on public.user_documents;
create policy "Users can insert their own documents"
  on public.user_documents for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own documents" on public.user_documents;
create policy "Users can update their own documents"
  on public.user_documents for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own documents" on public.user_documents;
create policy "Users can delete their own documents"
  on public.user_documents for delete to authenticated
  using ((select auth.uid()) = user_id);
