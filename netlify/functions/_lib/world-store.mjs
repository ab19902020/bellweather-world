import { getStore } from '@netlify/blobs';
import { bootstrap, move, strategies, projects, spies, daily, publicState } from '../../../cloudflare/src/sim.js';
import { ensureConversations, localLine, deepLine, remember } from '../../../cloudflare/src/brain.js';
import { clean, day, MAX_EVENTS } from '../../../cloudflare/src/util.js';

const STORE_NAME = 'bellweather-world';
const STATE_KEY = 'authoritative-state-v16';
const STEP_MS = 5000;
const VIEWER_TTL_MS = 20000;
const MAX_CAS_RETRIES = 7;

function store() {
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

function serverEnv() {
  return {
    DEEPSEEK_API_KEY_1: process.env.DEEPSEEK_API_KEY_1 || '',
    DEEPSEEK_API_KEY_2: process.env.DEEPSEEK_API_KEY_2 || '',
    DEEPSEEK_API_KEY_3: process.env.DEEPSEEK_API_KEY_3 || '',
    ADMIN_TOKEN: process.env.ADMIN_TOKEN || ''
  };
}

export function adminOk(token) {
  const expected = process.env.ADMIN_TOKEN || '';
  return Boolean(expected && token && token === expected);
}

function ensureRuntime(state) {
  state.recentEvents ||= [];
  state.globalRecent ||= [];
  state.conversations ||= [];
  state.projects ||= [];
  state.spies ||= [];
  state.stats ||= { deepTurns: 0, localTurns: 0, spiesSent: 0, spiesCaught: 0, wars: 0 };
  state.viewerHeartbeats ||= {};
  state.lastDeepAt ||= 0;
  state.lastStepMs ||= Date.now();
  state.revision ||= 1;
  return state;
}

function pruneViewers(state, now) {
  ensureRuntime(state);
  for (const [id, ts] of Object.entries(state.viewerHeartbeats)) {
    if (now - Number(ts || 0) > VIEWER_TTL_MS) delete state.viewerHeartbeats[id];
  }
}

function viewerCount(state) {
  return Object.keys(state.viewerHeartbeats || {}).length;
}

function emit(state, kind, text, payload = null) {
  const e = {
    id: `${Date.now()}-${state.revision}-${Math.floor(Math.random() * 9999)}`,
    ts: Date.now(),
    day: day(state),
    kind,
    text: clean(text, 500),
    payload
  };
  state.recentEvents.push(e);
  state.recentEvents = state.recentEvents.slice(-MAX_EVENTS);
  return e;
}

async function progressConversations(state, now, allowDeep = true) {
  let deepCalls = 0;
  const env = serverEnv();
  const hasDeep = [env.DEEPSEEK_API_KEY_1, env.DEEPSEEK_API_KEY_2, env.DEEPSEEK_API_KEY_3].some(Boolean);

  for (const c of state.conversations) {
    if (c.status !== 'active' || now < Number(c.nextTurnAt || 0)) continue;
    const a = state.agents.find(x => x.id === (c.turn % 2 ? c.bId : c.aId));
    const b = state.agents.find(x => x.id === (c.turn % 2 ? c.aId : c.bId));
    if (!a || !b) {
      c.status = 'ended';
      c.endedAt = now;
      continue;
    }

    let line;
    const deepAllowedNow = allowDeep && hasDeep && now - Number(state.lastDeepAt || 0) >= 5000;
    if (c.mode === 'deep' && deepCalls < 1 && deepAllowedNow) {
      deepCalls++;
      try {
        line = await deepLine(env, state.stats.deepTurns || 0, state, a, b, c);
        state.stats.deepTurns++;
        state.lastDeepAt = now;
      } catch {
        line = localLine(state, a, b, c);
        state.stats.localTurns++;
      }
    } else {
      line = localLine(state, a, b, c);
      state.stats.localTurns++;
    }

    c.lines.push({ speakerId: a.id, speaker: a.name, text: line, at: now });
    c.lines = c.lines.slice(-18);
    c.turn++;
    c.nextTurnAt = now + 5000 + Math.floor(Math.random() * 7000);
    remember(state, a, b, c, line);
    emit(state, 'conversation', `${a.name}: ${line}`, {
      conversationId: c.id,
      speakerId: a.id,
      listenerId: b.id,
      mode: c.mode,
      topic: c.topic
    });
    if (c.turn >= c.maxTurns) {
      c.status = 'ended';
      c.endedAt = now;
    }
  }
}

export async function advanceState(state, { now = Date.now(), viewerId = '', allowDeep = true, force = false } = {}) {
  if (!state?.initialized) return state;
  ensureRuntime(state);
  pruneViewers(state, now);
  if (viewerId) state.viewerHeartbeats[clean(viewerId, 100)] = now;

  const elapsedMs = Math.max(0, now - Number(state.lastStepMs || now));
  if (!force && elapsedMs < STEP_MS) return state;

  // Netlify Functions are ephemeral. The canonical world therefore catches up
  // from the last saved timestamp every time a viewer or scheduled heartbeat arrives.
  const elapsedRealSec = Math.min(elapsedMs / 1000, 7 * 24 * 3600);
  const oldDay = day(state);
  const worldSec = elapsedRealSec * 20 * (state.timeMultiplier || 1);

  state.lastStepMs = now;
  state.worldTimeSec += worldSec;
  state.revision++;

  move(state, worldSec);
  projects(state, elapsedRealSec, (k, t, p) => emit(state, k, t, p));
  strategies(state, (k, t, p) => emit(state, k, t, p));
  spies(state, worldSec, (k, t, p) => emit(state, k, t, p));
  ensureConversations(state);
  await progressConversations(state, now, allowDeep);

  const newDay = day(state);
  const maxDailyCatchup = Math.min(newDay, oldDay + 3650);
  for (let d = oldDay + 1; d <= maxDailyCatchup; d++) {
    daily(state, d, (k, t, p) => emit(state, k, t, p));
  }
  return state;
}

export async function readState() {
  const entry = await store().getWithMetadata(STATE_KEY, { type: 'json' });
  return entry?.data || null;
}

export async function mutateState(mutator) {
  const s = store();
  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
    const entry = await s.getWithMetadata(STATE_KEY, { type: 'json' });
    const current = entry?.data || null;
    const result = await mutator(current);
    if (result?.skipWrite) return result;
    const next = result?.state ?? result;
    if (!next) return { state: current, modified: false };

    const write = entry
      ? await s.setJSON(STATE_KEY, next, { onlyIfMatch: entry.etag })
      : await s.setJSON(STATE_KEY, next, { onlyIfNew: true });
    if (write.modified) return { state: next, modified: true, etag: write.etag };
  }
  throw new Error('World state was busy; retry the request.');
}

export async function bootstrapWorld(input) {
  return mutateState(async current => {
    if (current?.initialized) return { skipWrite: true, state: current };
    const state = ensureRuntime(bootstrap(input || {}));
    state.viewerHeartbeats = {};
    state.lastStepMs = Date.now();
    emit(state, 'world', `The shared world came online with ${state.agents.length} residents.`);
    return { state };
  });
}

export async function getAdvancedWorld({ viewerId = '', allowDeep = true, force = false } = {}) {
  return mutateState(async current => {
    if (!current?.initialized) return { skipWrite: true, state: null };
    const beforeRevision = current.revision || 0;
    const beforeViewer = viewerId && current.viewerHeartbeats?.[viewerId];
    const state = await advanceState(current, { viewerId, allowDeep, force });
    const viewerChanged = Boolean(viewerId && beforeViewer !== state.viewerHeartbeats?.[viewerId]);
    if (!force && state.revision === beforeRevision && !viewerChanged) {
      return { skipWrite: true, state };
    }
    return { state };
  });
}

export function publicWorld(state, full = false) {
  if (!state?.initialized) return { initialized: false };
  pruneViewers(state, Date.now());
  return publicState(state, viewerCount(state), full);
}

export async function resetWorld() {
  const s = store();
  await s.delete(STATE_KEY);
}

export async function setWorldTimeMultiplier(multiplier) {
  const m = [1, 5, 20, 100].includes(Number(multiplier)) ? Number(multiplier) : 1;
  return mutateState(async current => {
    if (!current?.initialized) return { skipWrite: true, state: null };
    const state = ensureRuntime(current);
    state.timeMultiplier = m;
    state.revision++;
    emit(state, 'world', `World speed changed to ${m}×.`, { multiplier: m });
    return { state };
  });
}
