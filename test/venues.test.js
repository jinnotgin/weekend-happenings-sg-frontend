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
let useSavedEventsStore;
let HomeView;
let SaveButton;
let pinia;
let storage;

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
  ({ useSavedEventsStore } = await server.ssrLoadModule('/src/stores/savedEvents.js'));
  ({ default: HomeView } = await server.ssrLoadModule('/src/views/HomeView.vue'));
  ({ default: SaveButton } = await server.ssrLoadModule('/src/components/SaveButton.vue'));
});
after(async () => { await server?.close(); delete globalThis.window; });
beforeEach(() => {
  storage = new Map();
  window.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  pinia = createPinia();
  setActivePinia(pinia);
});

const fixture = (id = 'e_a', title = 'Event') => ({ id, title, description: 'Details', datetime: '14–15 Nov 2026', opening_hours: '10am–6pm', category: [], daterange: ['01 Jan 2000', '31 Dec 2099'], source: [], locations: [{ venue_id: 'old', name: 'Gallery' }] });
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
  test(`venue metadata arriving ${order} events normalizes venue IDs without changing saved event identities`, async (t) => {
    let releaseVenues;
    let releaseEvents;
    const venueResult = new Promise((resolve) => { releaseVenues = resolve; });
    const eventResult = new Promise((resolve) => { releaseEvents = resolve; });
    t.mock.method(globalThis, 'fetch', async (url) => {
      if (url.includes('venues.json')) return venueResult;
      if (url.includes('events.json')) return eventResult;
      return response([]);
    });
    const saved = useSavedEventsStore();
    saved.save(fixture());
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
    assert.equal(saved.items[0].id, 'e_a');
    assert.equal(saved.items[0].event.title, 'Event');
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
  return renderHome('anywhere', '/saved', 'anyTime');
}

test('saved copies remain readable during errors and after leaving the feed', async () => {
  useSavedEventsStore().save(fixture());
  const events = useEventsStore();
  events.fetchEventsStatus = 'error';
  let html = await renderSaved();
  assert.match(html, /Details/);
  assert.match(html, /14–15 Nov 2026/);
  assert.match(html, /10am–6pm/);
  assert.match(html, /Gallery/);
  assert.match(html, /Retry/);
  assert.match(html, /role="alert"/);
  assert.doesNotMatch(html, /Not in the current listings/);
  events.fetchEventsStatus = 'fetching';
  assert.match(await renderSaved(), /Checking for updates/);
  events.fetchEventsStatus = 'success';
  html = await renderSaved();
  assert.match(html, /Not in the current listings/);
  assert.match(html, /Event/);
  assert.doesNotMatch(html, /Retry/);
});

test('retry handles failure and updates saved copies on recovery', async (t) => {
  const saved = useSavedEventsStore();
  saved.save(fixture());
  const events = useEventsStore();
  let setup;
  const capture = createSSRApp({
    setup() {
      setup = HomeView.setup({}, { expose() {} });
      return () => null;
    },
  });
  capture.use(pinia);
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: {} }] });
  capture.use(router);
  await router.push('/');
  await router.isReady();
  await renderToString(capture);
  t.mock.method(console, 'error', () => {});
  t.mock.method(console, 'warn', () => {});
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  await setup.retryFetchEvents();
  assert.equal(events.fetchEventsStatus, 'error');
  fetchMock.mock.mockImplementation(async (url) => {
    if (url.includes('venues.json')) return response({ venues: [], redirects: {} });
    return response(url.includes('events.json') ? [fixture('e_a', 'Updated Event')] : []);
  });
  await setup.retryFetchEvents();
  assert.equal(events.fetchEventsStatus, 'success');
  assert.equal(saved.items[0].event.title, 'Updated Event');
  assert.match(await renderSaved(), /Updated Event/);
  assert.doesNotMatch(await renderSaved(), /Not in the current listings/);
});

const savedKey = 'nowinsg:savedEvents:v1';
const savedIds = () => JSON.parse(storage.get(savedKey) || '[]').map(({ id }) => id).sort();
const storageEvent = (store, key = savedKey) => store.handleStorageChange({ key, storageArea: window.localStorage });

test('filter animations preserve errors and pending network requests', async (t) => {
  useSavedEventsStore().save(fixture());
  const events = useEventsStore();
  let finishAnimation;
  t.mock.method(globalThis, 'setTimeout', (callback) => { finishAnimation = callback; return 1; });
  t.mock.method(globalThis, 'clearTimeout', () => {});
  events.fetchEventsStatus = 'error';
  events.triggerFakeLoading();
  assert.equal(finishAnimation, undefined);
  assert.equal(events.displayEventsStatus, 'error');
  assert.match(await renderSaved(), /Retry/);
  assert.doesNotMatch(await renderSaved(), /No events listed right now/);
  events.fetchEventsStatus = 'success';
  events.triggerFakeLoading();
  assert.equal(events.fetchEventsStatus, 'success');
  assert.equal(events.displayEventsStatus, 'fetching');
  events.fetchEventsStatus = 'fetching';
  finishAnimation();
  assert.equal(events.fetchEventsStatus, 'fetching');
  assert.equal(events.displayEventsStatus, 'fetching');
  events.fetchEventsStatus = 'success';
  events.triggerFakeLoading();
  events.fetchEventsStatus = 'error';
  finishAnimation();
  assert.equal(events.displayEventsStatus, 'error');
  assert.match(await renderSaved(), /Retry/);
});

test('two tabs retain independent saves and removals before storage events arrive', () => {
  const a = useSavedEventsStore(createPinia());
  const b = useSavedEventsStore(createPinia());
  a.save(fixture('a', 'A'));
  b.save(fixture('b', 'B'));
  assert.deepEqual(savedIds(), ['a', 'b']);
  a.remove('a');
  b.save(fixture('c', 'C'));
  assert.deepEqual(savedIds(), ['b', 'c']);
  storageEvent(a);
  assert.deepEqual([...a.savedIds].sort(), ['b', 'c']);
  b.remove('c');
  storageEvent(a);
  assert.deepEqual([...a.savedIds], ['b']);
});

test('storage notifications use the latest snapshot, honor clear, and ignore other keys', () => {
  const a = useSavedEventsStore();
  a.save(fixture('a', 'A'));
  const b = useSavedEventsStore(createPinia());
  b.remove('a');
  a.handleStorageChange({ key: savedKey, newValue: JSON.stringify([{ id: 'a' }]) });
  assert.equal(a.count, 0);
  a.save(fixture('b', 'B'));
  storage.delete(savedKey);
  storageEvent(a, 'unrelated');
  assert.equal(a.count, 1);
  storageEvent(a, null);
  assert.equal(a.count, 0);
});

test('events at the same venue are saved independently and legacy venue saves are ignored', () => {
  storage.set('nowinsg:starredVenues:v1', JSON.stringify([{ id: 'old', name: 'Gallery' }]));
  const saved = useSavedEventsStore();
  assert.equal(saved.count, 0);
  saved.save(fixture('e_a', 'Exhibition A'));
  assert.equal(saved.isSaved('e_b'), false);
  saved.save(fixture('e_b', 'Exhibition B'));
  assert.equal(saved.count, 2);
  saved.toggle(fixture('e_a'));
  assert.deepEqual(savedIds(), ['e_b']);
  assert.ok(storage.has('nowinsg:starredVenues:v1'));
});

test('snapshots persist across reloads, refresh by event ID, and retain the original save time', () => {
  const saved = useSavedEventsStore();
  const event = fixture();
  saved.save(event);
  const savedAt = saved.items[0].savedAt;
  event.locations[0].name = 'Mutated';
  assert.equal(saved.items[0].event.locations[0].name, 'Gallery');
  saved.refreshSnapshots([fixture('e_a', 'Updated'), fixture('e_b', 'Other')]);
  saved.refreshSnapshots([]);
  const reloaded = useSavedEventsStore(createPinia());
  assert.equal(reloaded.count, 1);
  assert.equal(reloaded.items[0].event.title, 'Updated');
  assert.equal(reloaded.items[0].savedAt, savedAt);
  assert.equal('source' in reloaded.items[0].event, false);
  assert.equal('thumbnail' in reloaded.items[0].event, false);
});

test('background snapshot refresh cannot resurrect a removal from another tab', () => {
  const a = useSavedEventsStore();
  a.save(fixture());
  const b = useSavedEventsStore(createPinia());
  b.remove('e_a');
  a.refreshSnapshots([fixture('e_a', 'Updated')]);
  assert.equal(a.count, 0);
  assert.deepEqual(savedIds(), []);
});

test('missing IDs cannot be saved and invalid stored entries are discarded', () => {
  storage.set(savedKey, JSON.stringify([null, {}, { id: 'broken' }, { id: 'e_a', event: fixture() }, { id: 'e_a', event: fixture() }]));
  const saved = useSavedEventsStore();
  assert.equal(saved.count, 1);
  saved.save({ ...fixture(), id: null });
  saved.save({ ...fixture(), id: '  ' });
  assert.equal(saved.count, 1);
});

test('failed writes remain local and replay over other tabs without resurrecting removals', (t) => {
  const a = useSavedEventsStore();
  a.save(fixture('a', 'A'));
  const b = useSavedEventsStore(createPinia());
  t.mock.method(console, 'warn', () => {});
  const writer = t.mock.method(window.localStorage, 'setItem', () => { throw new Error('quota'); });
  a.remove('a');
  a.save(fixture('b', 'B'));
  assert.deepEqual([...a.savedIds], ['b']);
  writer.mock.restore();
  b.save(fixture('c', 'C'));
  storageEvent(a);
  assert.deepEqual([...a.savedIds].sort(), ['b', 'c']);
  a.save(fixture('d', 'D'));
  assert.deepEqual(savedIds(), ['b', 'c', 'd']);
});

test('malformed or unreadable storage keeps local saves usable', (t) => {
  const a = useSavedEventsStore();
  a.save(fixture('a', 'A'));
  t.mock.method(console, 'warn', () => {});
  storage.set(savedKey, '{');
  storageEvent(a);
  assert.equal(a.isSaved('a'), true);
  t.mock.method(window.localStorage, 'getItem', () => { throw new Error('denied'); });
  a.save(fixture('b', 'B'));
  assert.deepEqual([...a.savedIds].sort(), ['a', 'b']);
});

async function renderHome(activeLocation, path = '/', activeTimeRange = 'thisWeekend', activeCategory = 'all') {
  const app = createSSRApp(HomeView, { activeTimeRange, activeCategory, activeLocation });
  app.use(pinia);
  app.component('VMenu', { template: '<div><slot /></div>' });
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: {} }, { path: '/saved', component: {} }] });
  app.use(router);
  await router.push(path);
  await router.isReady();
  return renderToString(app);
}

test('saved feed filters by event identity, not shared venue, and cards have one save control', async () => {
  const events = useEventsStore();
  events.items = [fixture('e_a', 'Exhibition A'), fixture('e_b', 'Exhibition B')];
  events.fetchEventsStatus = 'success';
  useSavedEventsStore().save(events.items[0]);
  const html = await renderHome('anywhere', '/saved');
  assert.match(html, /Exhibition A/);
  assert.doesNotMatch(html, /Exhibition B/);
  assert.equal((html.match(/aria-label="Saved"/g) || []).length, 1);
  assert.doesNotMatch(html, /Star Gallery|saved venues|arrow-up-right|Open event in a new tab/i);
  const all = await renderHome('anywhere');
  assert.equal((all.match(/aria-label="Save"/g) || []).length, 1);
});

test('save button exposes short labels and disables saving without an event ID', async () => {
  const renderButton = async (event) => {
    const app = createSSRApp(SaveButton, { event });
    app.use(pinia);
    return renderToString(app);
  };
  assert.match(await renderButton(fixture()), /aria-label="Save"/);
  useSavedEventsStore().save(fixture());
  const html = await renderButton(fixture());
  assert.match(html, /aria-label="Saved"/);
  assert.match(html, /aria-pressed="true"/);
  const missing = await renderButton({ ...fixture(), id: null });
  assert.match(missing, /disabled/);
  assert.match(missing, /Save unavailable/);
});

test('saved list uses the same date, category, and area filters as the feed', async () => {
  const events = useEventsStore();
  const saved = useSavedEventsStore();
  const past = { ...fixture('e_past', 'Past exhibition'), category: ['Arts'], daterange: ['01 Jan 2001', '02 Jan 2001'] };
  const current = { ...fixture('e_now', 'Current exhibition'), category: ['Music'] };
  saved.save(past);
  saved.save(current);
  events.items = [current];
  events.fetchEventsStatus = 'success';
  const anyTime = await renderHome('anywhere', '/saved', 'anyTime');
  assert.match(anyTime, /data-event-card/);
  assert.match(anyTime, /Past exhibition/);
  assert.match(anyTime, /Current exhibition/);
  assert.match(anyTime, /Not in the current listings/);
  assert.doesNotMatch(anyTime, /Your list/);
  const weekend = await renderHome('anywhere', '/saved');
  assert.doesNotMatch(weekend, /Past exhibition/);
  assert.match(weekend, /Current exhibition/);
  const arts = await renderHome('anywhere', '/saved', 'anyTime', 'Arts');
  assert.match(arts, /Past exhibition/);
  assert.doesNotMatch(arts, /Current exhibition/);
  const region = await renderHome('East', '/saved', 'anyTime');
  assert.doesNotMatch(region, /data-event-card/);
  assert.match(region, /No saved events match these filters/);
});
