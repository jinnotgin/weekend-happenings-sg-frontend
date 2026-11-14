import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp } from 'vue';
import { createRouter, createMemoryHistory } from 'vue-router';
import { renderToString } from 'vue/server-renderer';

let server;
let useEventsStore;
let useStarredVenuesStore;
let SavedVenuesView;
let pinia;

before(async () => {
  globalThis.window = { localStorage: { getItem: () => null, setItem() {} } };
  server = await createServer({
    configFile: false,
    plugins: [vue()],
    resolve: { alias: { '@': new URL('../src', import.meta.url).pathname } },
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
  });
  ({ useEventsStore } = await server.ssrLoadModule('/src/stores/events.js'));
  ({ useStarredVenuesStore } = await server.ssrLoadModule('/src/stores/starredVenues.js'));
  ({ default: SavedVenuesView } = await server.ssrLoadModule('/src/views/SavedVenuesView.vue'));
});
after(async () => { await server?.close(); delete globalThis.window; });
beforeEach(() => { pinia = createPinia(); setActivePinia(pinia); });

const fixture = () => ({ title: 'Event', category: [], locations: [{ venue_id: 'old' }] });
const response = (data) => ({ ok: true, json: async () => data });
function mockFeed(t, venueFetch) {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.includes('venues.json')) return venueFetch(options);
    if (url.includes('events.json')) return response([fixture()]);
    return response([]);
  });
  t.mock.method(console, 'warn', () => {});
}

function trackBackground(t, events) {
  const original = events.fetchVenues.bind(events);
  let pending;
  t.mock.method(events, 'fetchVenues', (...args) => {
    pending = original(...args);
    return pending;
  });
  return () => pending;
}

for (const stage of ['request', 'body']) {
  test(`the feed completes before a stalled venue ${stage} reaches its 15s deadline`, async (t) => {
    let expire;
    let signal;
    let finishLate;
    let timerCleared = false;
    t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
      assert.equal(delay, 15000);
      expire = callback;
      return 123;
    });
    t.mock.method(globalThis, 'clearTimeout', (timer) => {
      assert.equal(timer, 123);
      timerCleared = true;
    });
    const pending = new Promise((resolve) => { finishLate = resolve; });
    mockFeed(t, (options) => {
      signal = options.signal;
      return stage === 'request' ? pending : { ok: true, json: () => pending };
    });
    const events = useEventsStore();
    const background = trackBackground(t, events);
    events.venueRedirects = { old: 'current' };
    events.venues = [{ id: 'current', name: 'Current Venue' }];
    await events.fetchEvents();
    assert.equal(signal.aborted, false);
    assert.equal(timerCleared, false);
    assert.equal(events.fetchEventsStatus, 'success');
    assert.equal(events.items[0].locations[0].venue_id, 'current');
    expire();
    await background();
    assert.equal(signal.aborted, true);
    assert.equal(timerCleared, true);
    assert.equal(events.fetchEventsStatus, 'success');
    assert.equal(events.venues[0].name, 'Current Venue');
    // An endpoint ignoring abort must not overwrite the fallback after timeout.
    const lateData = { venues: [{ id: 'late', name: 'Late' }], redirects: {} };
    finishLate(stage === 'request' ? response(lateData) : lateData);
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(events.venues[0].id, 'current');
  });
}

for (const order of ['before', 'after']) {
  test(`venue metadata arriving ${order} events normalizes event and saved IDs`, async (t) => {
    let releaseVenues;
    let releaseEvents;
    const venueResult = new Promise((resolve) => { releaseVenues = resolve; });
    const eventResult = new Promise((resolve) => { releaseEvents = resolve; });
    t.mock.method(globalThis, 'fetch', async (url) => {
      if (url.includes('venues.json')) return venueResult;
      if (url.includes('events.json')) return eventResult;
      return response([]);
    });
    const saved = useStarredVenuesStore();
    saved.star('old', 'Old');
    const events = useEventsStore();
    const background = trackBackground(t, events);
    const loading = events.fetchEvents();
    const metadata = response({ venues: [{ id: 'current', name: 'Current' }], redirects: { old: 'current' } });
    if (order === 'before') {
      releaseVenues(metadata);
      await background();
      releaseEvents(response([fixture()]));
      await loading;
    } else {
      releaseEvents(response([fixture()]));
      await loading;
      assert.equal(events.fetchEventsStatus, 'success');
      assert.equal(events.items[0].locations[0].venue_id, 'old');
      releaseVenues(metadata);
      await background();
    }
    assert.equal(events.items[0].locations[0].venue_id, 'current');
    assert.equal(events.eventCountsByVenueId.get('current'), 1);
    assert.equal(saved.items[0].id, 'current');
    assert.equal(saved.items[0].name, 'Current');
  });
}

test('an older optional refresh cannot overwrite a newer registry', async (t) => {
  let releaseOld;
  let oldSignal;
  const oldResult = new Promise((resolve) => { releaseOld = resolve; });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (++calls === 1) {
      oldSignal = options.signal;
      return oldResult;
    }
    return response({ venues: [{ id: 'current', name: 'Current' }], redirects: { old: 'current' } });
  });
  const events = useEventsStore();
  const older = events.fetchVenues('fixture', 1);
  await events.fetchVenues('fixture', 2);
  assert.equal(oldSignal.aborted, true);
  releaseOld(response({ venues: [{ id: 'stale', name: 'Stale' }], redirects: {} }));
  await older;
  assert.equal(events.venues[0].id, 'current');
  assert.equal(events.venueRedirects.old, 'current');
});

async function renderSaved() {
  const app = createSSRApp(SavedVenuesView);
  app.use(pinia);
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: {} }] });
  app.use(router);
  await router.push('/');
  await router.isReady();
  return renderToString(app);
}

test('saved venues distinguish fetch errors from confirmed empty results and expose retry', async () => {
  useStarredVenuesStore().star('old', 'Saved Venue');
  const events = useEventsStore();
  events.fetchEventsStatus = 'error';
  let html = await renderSaved();
  assert.match(html, /Event counts unavailable/);
  assert.match(html, /Retry/);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /No events listed right now/);
  events.fetchEventsStatus = 'success';
  html = await renderSaved();
  assert.match(html, /No events listed right now/);
  assert.doesNotMatch(html, /Event counts unavailable/);
});

test('retry action handles failure and can recover to real counts', async (t) => {
  useStarredVenuesStore().star('old', 'Saved Venue');
  const events = useEventsStore();
  // SSR compilation exposes script setup bindings; exercise the real click handler.
  let setup;
  const capture = createSSRApp({
    setup() {
      setup = SavedVenuesView.setup({}, { expose() {} });
      return () => null;
    },
  });
  capture.use(pinia);
  await renderToString(capture);
  t.mock.method(console, 'error', () => {});
  t.mock.method(console, 'warn', () => {});
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  await setup.retryFetchEvents();
  assert.equal(events.fetchEventsStatus, 'error');
  fetchMock.mock.mockImplementation(async (url) => {
    if (url.includes('venues.json')) return response({ venues: [], redirects: {} });
    return response(url.includes('events.json') ? [fixture()] : []);
  });
  await setup.retryFetchEvents();
  assert.equal(events.fetchEventsStatus, 'success');
  assert.equal(events.eventCountsByVenueId.get('old'), 1);
  assert.match(await renderSaved(), /1 event/);
});
