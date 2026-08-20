import { adminOk, bootstrapWorld, getAdvancedWorld, publicWorld, resetWorld, setWorldTimeMultiplier } from './_lib/world-store.mjs';

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}

function bearer(req) {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  try {
    const url = new URL(req.url);
    if (req.method === 'GET') {
      const viewerId = url.searchParams.get('viewer') || '';
      const result = await getAdvancedWorld({ viewerId, allowDeep: true });
      if (!result.state?.initialized) return json({ initialized: false }, 200);
      const state = publicWorld(result.state, true);
      return json({ initialized: true, state });
    }

    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const body = await req.json().catch(() => ({}));
    const action = body.action || '';

    if (action === 'bootstrap') {
      if (!adminOk(body.adminToken || bearer(req))) return json({ error: 'unauthorized' }, 401);
      const result = await bootstrapWorld(body.state || {});
      return json({ ok: true, state: publicWorld(result.state, true) });
    }

    if (action === 'time') {
      if (!adminOk(body.adminToken || bearer(req))) return json({ error: 'unauthorized' }, 401);
      const result = await setWorldTimeMultiplier(body.multiplier);
      if (!result.state) return json({ error: 'not_initialized' }, 409);
      return json({ ok: true, state: publicWorld(result.state, true) });
    }

    if (action === 'reset') {
      if (!adminOk(body.adminToken || bearer(req))) return json({ error: 'unauthorized' }, 401);
      await resetWorld();
      return json({ ok: true });
    }

    return json({ error: 'unknown_action' }, 400);
  } catch (error) {
    console.error('world function failed', error);
    return json({ error: 'world_error', message: String(error?.message || error) }, 500);
  }
};
