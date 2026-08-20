# Bellweather V15 — Shared World Backend

This repository contains the server-authoritative backend for Bellweather/Greyhaven.

## Architecture

- Cloudflare Worker + SQLite-backed Durable Object (`BellweatherWorld`)
- One authoritative world instance: `bellweather-main`
- Durable Object alarms advance the civilisation when no viewers are connected
- WebSockets broadcast one shared timeline to every connected viewer
- Five global DeepSeek conversation slots; all other NPC cognition continues through the server-side local-brain layer
- DeepSeek credentials and the owner/admin token are Cloudflare secrets and are never placed in the public HTML

## Cloudflare deployment

Import this repository in Cloudflare Workers Builds and use the `cloudflare` directory as the project root.

Required secrets:

- `DEEPSEEK_API_KEY_1`
- `DEEPSEEK_API_KEY_2`
- `DEEPSEEK_API_KEY_3`
- `ADMIN_TOKEN`

After deployment, copy the Worker URL. The Netlify observer client will use that URL for `/ws`, `/snapshot`, `/events`, and owner initialization.

Before the public launch, change `ALLOWED_ORIGIN` in `cloudflare/wrangler.jsonc` from `*` to the final Netlify origin and redeploy.

## World initialization

The first world initialization requires the owner `ADMIN_TOKEN`. Once initialized, ordinary viewers cannot create or replace the authoritative timeline.
