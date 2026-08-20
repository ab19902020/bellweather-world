# Bellweather V15 — Shared World Backend

This repository contains the server-authoritative backend for Bellweather/Greyhaven.

## Architecture

- Cloudflare Worker + SQLite-backed Durable Object (`BellweatherWorld`)
- One authoritative world instance: `bellweather-main`
- Durable Object alarms advance the civilisation when no viewers are connected
- WebSockets broadcast one shared timeline to every connected viewer
- Five global DeepSeek conversation slots; all other NPC cognition continues through the server-side local-brain layer
- DeepSeek credentials and the owner/admin token are Cloudflare secrets and are never placed in public client code

## Cloudflare deployment

The repository is now deployable from **either** the repository root **or** the existing `cloudflare` directory. This removes the root-directory problem that was blocking the mobile Cloudflare setup.

Recommended Workers Builds settings:

- Repository: `ab19902020/bellweather-world`
- Production branch: `main`
- Root directory: leave blank / repository root
- Build command: leave blank
- Deploy command: `npx wrangler deploy`

The root `wrangler.jsonc` points directly at `cloudflare/src/index.js`, so Cloudflare does not need a special monorepo root setting. If an existing Cloudflare project is already configured with root directory `cloudflare`, that also continues to work because the original Cloudflare config remains in place.

Required Cloudflare secrets:

- `DEEPSEEK_API_KEY_1`
- `DEEPSEEK_API_KEY_2`
- `DEEPSEEK_API_KEY_3`
- `ADMIN_TOKEN`

Do not commit those values to GitHub.

## Endpoints

After a successful deployment the Worker exposes:

- `/health` — deployment health check
- `/ws` — shared-world WebSocket
- `/snapshot` — current authoritative state
- `/events` — recent world events
- `/admin/time` — owner-only world-speed control
- `/admin/reset` — owner-only world reset

## Frontend integration

The Bellweather V15 observer client connects to the Worker URL for `/ws`, `/snapshot`, `/events`, and the one-time owner bootstrap. Keep `ALLOWED_ORIGIN` as `*` while connecting/testing the existing browser build; once the final public frontend origin is fixed, it can be restricted and redeployed.

## World initialization

The first world initialization requires the owner `ADMIN_TOKEN`. Once initialized, ordinary viewers cannot create or replace the authoritative timeline.
