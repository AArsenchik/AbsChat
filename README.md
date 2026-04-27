# AbsChat

AbsChat is a wallet-based messenger built on Abstract.

Messages are sent as zero-value transactions with calldata, then mirrored into Supabase for fast history loading, multi-device sync, and UI features like previews, profiles, reactions, and pinned state.

## What the app does today

- Sign in with AGW
- Send regular chats on Abstract
- Use secret chats with shared-password E2EE
- Create local wallet sessions for faster sending
- Reply to messages
- Pin messages either `Only for me` or `For everyone`
- Add emoji reactions synced across devices and participants
- Show typing, online/offline, and seen state
- Open user profiles from avatars
- Detect and open links in messages
- Switch between `AbsChat` and `X Black` themes
- Use mobile-first gestures for chat cards and message actions

## Security model

AbsChat has two chat modes, and they are intentionally different:

- `Regular chats`
  - Encrypted payloads use backend-managed conversation secrets for new chats.
  - This is safer than the old deterministic client-only scheme.
  - It is not E2EE. The backend is part of the trust model.
- `Secret chats`
  - Shared-password E2EE.
  - The password stays on the current device and is never synced.

Important notes:

- New regular chats use the `conversation_keys` backend flow.
- Older regular chats can still be read through the legacy fallback so existing history does not break.
- On-chain activity such as wallet activity, timestamps, and tx hashes is still public.
- Supabase service-role access stays backend-only.

## Architecture

- `Frontend`: React + TypeScript + Vite
- `Wallet / chain`: AGW + wagmi + viem
- `Backend`: Vercel serverless functions in [`api/`](/Users/arseniy/Documents/Abstract%20Messenger/api)
- `Storage`: Supabase
- `Realtime`: Supabase Broadcast

High-level flow:

1. User signs in with AGW.
2. Frontend gets a short-lived backend JWT via [`api/auth.js`](/Users/arseniy/Documents/Abstract%20Messenger/api/auth.js).
3. Frontend reads and writes indexed data through backend routes.
4. Realtime signals sync typing, reactions, read state, pins, and visibility.
5. Polling and light chain scanning help recover when realtime misses something.

## API routes

- [`api/auth.js`](/Users/arseniy/Documents/Abstract%20Messenger/api/auth.js) - wallet signature to JWT
- [`api/messages.js`](/Users/arseniy/Documents/Abstract%20Messenger/api/messages.js) - indexed message history
- [`api/profiles.js`](/Users/arseniy/Documents/Abstract%20Messenger/api/profiles.js) - display names and avatars
- [`api/groups.js`](/Users/arseniy/Documents/Abstract%20Messenger/api/groups.js) - group chats and memberships
- [`api/conversation-keys.js`](/Users/arseniy/Documents/Abstract%20Messenger/api/conversation-keys.js) - managed regular-chat secrets
- [`api/secret-chats.js`](/Users/arseniy/Documents/Abstract%20Messenger/api/secret-chats.js) - secret chat registry
- [`api/secret-visibility.js`](/Users/arseniy/Documents/Abstract%20Messenger/api/secret-visibility.js) - per-device/account secret-chat visibility

## Local development

1. Install dependencies:

```bash
npm install
```

2. Copy envs:

```bash
cp .env.example .env
```

3. Fill in the required variables in [`.env.example`](/Users/arseniy/Documents/Abstract%20Messenger/.env.example).

4. Run the app:

```bash
npm run dev
```

5. Production build:

```bash
npm run build
```

## Environment variables

Frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Backend:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`

Notes:

- `SUPABASE_URL` can match `VITE_SUPABASE_URL`.
- `JWT_SECRET` is used for backend-issued auth tokens.
- The frontend never receives `SUPABASE_SERVICE_ROLE_KEY`.

## Supabase setup

Create a Supabase project, then run the SQL below in the SQL editor.

```sql
create extension if not exists pgcrypto;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  tx_hash text unique not null,
  from_address text not null,
  to_address text not null,
  text text not null,
  created_at timestamptz not null,
  chain_id integer not null
);

create index if not exists messages_to_address_idx
  on public.messages (to_address);

create index if not exists messages_from_address_idx
  on public.messages (from_address);

create index if not exists messages_chain_idx
  on public.messages (chain_id);

alter table public.messages enable row level security;

create table if not exists public.profiles (
  address text primary key not null,
  display_name text,
  avatar_url text,
  updated_at timestamptz
);

create index if not exists profiles_display_name_idx
  on public.profiles (display_name);

alter table public.profiles enable row level security;

create table if not exists public.groups (
  id text primary key not null,
  name text not null,
  avatar_url text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists groups_updated_at_idx
  on public.groups (updated_at desc);

alter table public.groups enable row level security;

create table if not exists public.group_members (
  group_id text not null references public.groups(id) on delete cascade,
  member_address text not null,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, member_address)
);

create index if not exists group_members_member_idx
  on public.group_members (member_address);

alter table public.group_members enable row level security;

create table if not exists public.conversation_keys (
  address_a text not null,
  address_b text not null,
  secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (address_a, address_b)
);

create index if not exists conversation_keys_address_a_idx
  on public.conversation_keys (address_a);

create index if not exists conversation_keys_address_b_idx
  on public.conversation_keys (address_b);

alter table public.conversation_keys enable row level security;

create table if not exists public.secret_chats (
  address_a text not null,
  address_b text not null,
  chain_id integer not null,
  created_at timestamptz not null,
  created_by text not null,
  primary key (address_a, address_b, chain_id)
);

create index if not exists secret_chats_address_a_idx
  on public.secret_chats (address_a);

create index if not exists secret_chats_address_b_idx
  on public.secret_chats (address_b);

create index if not exists secret_chats_chain_idx
  on public.secret_chats (chain_id);

alter table public.secret_chats enable row level security;

create table if not exists public.secret_visibility (
  owner_address text not null,
  peer_address text not null,
  hidden boolean not null default false,
  updated_at timestamptz not null,
  chain_id integer not null,
  primary key (owner_address, peer_address, chain_id)
);

create index if not exists secret_visibility_owner_idx
  on public.secret_visibility (owner_address);

create index if not exists secret_visibility_peer_idx
  on public.secret_visibility (peer_address);

create index if not exists secret_visibility_chain_idx
  on public.secret_visibility (chain_id);

alter table public.secret_visibility enable row level security;
```

## RLS and access notes

- Keep RLS enabled on all tables above.
- AbsChat uses backend service-role access for table operations.
- Do not expose service-role credentials to the browser.
- Public table policies are not required for the current architecture.
- The frontend uses Supabase anon credentials for realtime/broadcast auth only.

## Product behavior worth knowing

- Sent-message deletion is not part of the product. Only locally failed outgoing messages can be removed from the UI.
- Secret chat passwords are local to the current device.
- `Only for me` pins sync across the same account's devices.
- `For everyone` pins sync to both chat participants.
- Reactions sync across devices and participants.
- Chat list previews show the latest message and relative time.

## Public docs

The user-facing docs page lives at:

- [public/docs.html](/Users/arseniy/Documents/Abstract%20Messenger/public/docs.html)

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run preview
```
