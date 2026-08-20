import { readState, publicWorld } from './_lib/world-store.mjs';

export default async () => {
  try {
    const state = await readState();
    return Response.json({
      ok: true,
      service: 'bellweather-world-netlify',
      storage: 'netlify-blobs-strong',
      initialized: Boolean(state?.initialized),
      revision: state?.revision || 0,
      world: state?.initialized ? publicWorld(state, false) : undefined
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
};
