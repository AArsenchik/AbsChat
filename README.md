# Abstract Messenger

## Supabase setup

1. Create a new Supabase project.
2. Run the SQL below in the SQL editor.
3. Copy `.env.example` to `.env` and fill in your project values.

SQL schema:

```sql
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  tx_hash text unique not null,
  from_address text not null,
  to_address text not null,
  text text not null,
  created_at timestamptz not null,
  chain_id integer not null
);

create index if not exists messages_to_address_idx on public.messages (to_address);
create index if not exists messages_from_address_idx on public.messages (from_address);
create index if not exists messages_chain_idx on public.messages (chain_id);

alter table public.messages enable row level security;

create policy "public read" on public.messages
for select using (true);

create policy "public insert" on public.messages
for insert with check (true);

create table if not exists public.profiles (
  address text primary key not null,
  display_name text,
  avatar_url text,
  updated_at timestamptz
);

alter table public.profiles enable row level security;

create policy "public read profiles" on public.profiles
for select using (true);

create policy "public insert profiles" on public.profiles
for insert with check (true);

create policy "public update profiles" on public.profiles
for update using (true);
```

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
