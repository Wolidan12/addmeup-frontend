# Danqel Social Boost
Premium social discovery & promotion platform. React + Vite + Tailwind + Supabase (complete backend) + Render Static Site + PWA.
## Run: npm install; npm run dev | npm run build
## Supabase setup: create project → SQL Editor → run supabase/migrations/001,002,003 in order → copy .env.example to .env with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (publishable key only, NEVER service-role) → Auth settings: Site URL = your domain, add /reset-password + /login redirects.
## Without env vars the app runs in clearly-labelled DEMO mode (sample profiles, no fake stats/balances).
## Tests: node tests/validation.test.mjs ; npm run build

## Hosting: Render Static Site (see RENDER_DEPLOY.md). Supabase is the entire backend - no separate server.
