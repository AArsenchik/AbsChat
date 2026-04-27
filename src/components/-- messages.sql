-- messages
alter table public.messages enable row level security;

drop policy if exists "public read" on public.messages;
drop policy if exists "public insert" on public.messages;

create policy "public read" on public.messages
for select using (true);

create policy "public insert" on public.messages
for insert with check (true);

-- profiles
alter table public.profiles enable row level security;

drop policy if exists "public read profiles" on public.profiles;
drop policy if exists "public insert profiles" on public.profiles;
drop policy if exists "public update profiles" on public.profiles;

create policy "public read profiles" on public.profiles
for select using (true);

create policy "public insert profiles" on public.profiles
for insert with check (true);

create policy "public update profiles" on public.profiles
for update using (true);

-- secret chats (если закрывали)
alter table public.secret_chats enable row level security;
drop policy if exists "public read secret chats" on public.secret_chats;
drop policy if exists "public insert secret chats" on public.secret_chats;
drop policy if exists "public delete secret chats" on public.secret_chats;

create policy "public read secret chats" on public.secret_chats
for select using (true);

create policy "public insert secret chats" on public.secret_chats
for insert with check (true);

create policy "public delete secret chats" on public.secret_chats
for delete using (true);

-- secret visibility (если закрывали)
alter table public.secret_visibility enable row level security;
drop policy if exists "public read secret visibility" on public.secret_visibility;
drop policy if exists "public insert secret visibility" on public.secret_visibility;
drop policy if exists "public update secret visibility" on public.secret_visibility;

create policy "public read secret visibility" on public.secret_visibility
for select using (true);

create policy "public insert secret visibility" on public.secret_visibility
for insert with check (true);

create policy "public update secret visibility" on public.secret_visibility
for update using (true);

-- backend-managed regular chat keys
alter table public.conversation_keys enable row level security;
