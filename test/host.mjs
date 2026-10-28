// Offline tests for the Host half: route registration, the trust fence, query
// clamping, session indexing, and live `session/event` updates.
import assert from 'node:assert';
import { apply } from '../lib/index.js';

const DAY_MS = 86400000;

/** Provider usage report. */
function usage(inputTokens, outputTokens) {
  return { inputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 };
}

/** One assistant settlement. */
function message(seq, time, turn, reported) {
  return { type: 'assistant/message', seq, time, data: { turn, step: 1, usage: reported } };
}

/** Local day key under one fixed UTC offset. */
function dayKeyOf(time, offsetSeconds) {
  return new Date(Math.floor((time + offsetSeconds * 1000) / DAY_MS) * DAY_MS).toISOString().slice(0, 10);
}

/** Build a fake Host ctx with one injected capability context. */
function fakeHost(records, logs, credentials = null) {
  const routes = [];
  const listeners = [];
  const effects = [];
  let rejection = undefined;
  const ctx = {
    inject(deps, callback) {
      assert.deepEqual([...deps], ['webServer', 'connection', 'sessionQuery']);
      const cap = {
        effect(fn, label) {
          const dispose = fn();
          effects.push({ label, dispose });
          return dispose;
        },
        inject(nested, nestedCallback) {
          if (!nested.includes('credentials') || credentials === null) return;
          nestedCallback({
            credentials,
            effect(fn) {
              const dispose = fn();
              effects.push({ label: 'credentials binding', dispose });
              return dispose;
            },
          });
        },
        on(name, listener) {
          listeners.push({ name, listener });
        },
        webServer: {
          register(route) {
            routes.push(route);
            return () => {};
          },
        },
        connection: {
          requestRejection() {
            return rejection;
          },
        },
        sessionQuery: {
          async listSessions() {
            return records;
          },
          async readSession(id) {
            const log = logs.get(id);
            if (log === undefined) throw new Error('not found');
            return log;
          },
        },
      };
      callback(cap);
    },
  };
  return {
    ctx,
    routes,
    listeners,
    effects,
    setRejection(value) {
      rejection = value;
    },
  };
}

/** `fetch` response stub. */
function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

/** Account grant record stub. */
const accountCredentials = {
  async readRecord(ref) {
    if (ref !== 'deepseek-account-platform/default') return undefined;
    return { kind: 'grant', payload: { version: 1, token: 'test-token', issuer: 'https://platform.deepseek.com' } };
  },
};

/** Invoke the registered route and parse its JSON body. */
async function request(host, url, method = 'GET') {
  const route = host.routes[0];
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body) {
      this.body = body ?? '';
    },
  };
  await route.handler({ method, url, headers: {} }, res);
  return { status: res.statusCode, headers: res.headers, body: res.body === '' ? null : JSON.parse(res.body) };
}

const now = Date.now();
const offsetSeconds = -new Date().getTimezoneOffset() * 60;
const recent = now - 5 * 60 * 1000;
const older = now - 30 * 3600 * 1000;

const logs = new Map([
  ['s1', { inheritedEventCount: 0, events: [message(1, recent, 1, usage(100, 10))] }],
  ['s2', { inheritedEventCount: 0, events: [message(1, older, 1, usage(50, 5))] }],
]);
const records = [
  { header: { id: 's2', createdAt: older }, live: false, persisted: true },
  { header: { id: 's1', createdAt: recent }, live: true, persisted: true },
];

const host = fakeHost(records, logs);
apply(host.ctx);

assert.equal(host.routes.length, 1);
assert.equal(host.routes[0].kind, 'exact');
assert.equal(host.routes[0].path, '/dsh-balance/usage');
assert.equal(host.listeners.length, 1);
assert.equal(host.listeners[0].name, 'session/event');

// First read answers immediately and starts the background scan.
const first = await request(host, '/dsh-balance/usage?days=7&offset=' + offsetSeconds);
assert.equal(first.status, 200);
assert.equal(first.headers['content-type'], 'application/json; charset=utf-8');
assert.equal(first.headers['cache-control'], 'no-store');
assert.equal(first.body.rangeDays, 7);
assert.equal(first.body.scanning, true, 'the first answer reports the in-flight scan');

// Wait for the scan, then read the completed payload.
let payload = first.body;
for (let attempt = 0; attempt < 100 && payload.scanning === true; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 10));
  payload = (await request(host, '/dsh-balance/usage?days=7&offset=' + offsetSeconds)).body;
}
assert.equal(payload.scanning, false);
assert.equal(payload.partial, false);
assert.equal(payload.days.length, 7);
assert.equal(payload.hours.length, 24);
assert.equal(payload.total.requests, 2);
assert.equal(payload.total.total, 165);
assert.equal(payload.total.sessions, 2);

const recentDay = payload.days.find((entry) => entry.date === dayKeyOf(recent, offsetSeconds));
assert.ok(recentDay, 'the recent sample lands on its local day');
assert.equal(recentDay.total, 110);
const olderDay = payload.days.find((entry) => entry.date === dayKeyOf(older, offsetSeconds));
assert.ok(olderDay, 'the older sample is inside the seven-day window');
assert.equal(olderDay.total, 55);

// A live event updates the fold without re-reading the log.
const liveEvent = message(2, now - 60 * 1000, 2, usage(7, 3));
host.listeners[0].listener({ id: 's1' }, liveEvent);
payload = (await request(host, '/dsh-balance/usage?days=7&offset=' + offsetSeconds)).body;
assert.equal(payload.total.total, 175);
assert.equal(payload.total.requests, 3);

// Query options are clamped to the supported range.
assert.equal((await request(host, '/dsh-balance/usage?days=9999&offset=0')).body.rangeDays, 400);
assert.equal((await request(host, '/dsh-balance/usage?days=abc')).body.rangeDays, 14);

// The trust fence runs before method or query handling.
host.setRejection(401);
const rejected = await request(host, '/dsh-balance/usage');
assert.equal(rejected.status, 401);
assert.equal(rejected.body, null);
host.setRejection(undefined);

// Only GET is served.
const wrongMethod = await request(host, '/dsh-balance/usage', 'POST');
assert.equal(wrongMethod.status, 405);
assert.equal(wrongMethod.headers.allow, 'GET');

// A session that cannot be read never breaks the endpoint.
{
  const brokenLogs = new Map([['s1', undefined]]);
  const brokenHost = fakeHost([{ header: { id: 's1', createdAt: now }, live: true }], brokenLogs);
  apply(brokenHost.ctx);
  let answer = (await request(brokenHost, '/dsh-balance/usage')).body;
  for (let attempt = 0; attempt < 50 && answer.scanning === true; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    answer = (await request(brokenHost, '/dsh-balance/usage')).body;
  }
  assert.equal(answer.scanning, false);
  assert.equal(answer.partial, true);
  assert.equal(answer.total.requests, 0);
}

// Account source without a stored grant is a typed failure, not a 500.
{
  const hostWithoutGrant = fakeHost([], new Map());
  apply(hostWithoutGrant.ctx);
  const answer = await request(hostWithoutGrant, '/dsh-balance/usage?source=account');
  assert.equal(answer.status, 502);
  assert.deepEqual(answer.body, { error: 'account-unavailable', reason: 'missing' });
}

// Account source reads the platform months through the account grant.
{
  const todayUtc = new Date(Math.floor(Date.now() / 86400000) * 86400000).toISOString().slice(0, 10);
  const headersSeen = [];
  let calls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls += 1;
    headersSeen.push(init?.headers?.['x-dsh-auth-token'] ?? null);
    const parsed = new URL(String(url));
    if (parsed.pathname.endsWith('/amount')) {
      return jsonResponse({
        code: 0,
        msg: '',
        data: {
          biz_data: {
            days: [
              {
                date: todayUtc,
                data: [
                  {
                    model: 'deepseek-flash',
                    usage: [
                      { type: 'PROMPT_TOKEN', amount: '0' },
                      { type: 'PROMPT_CACHE_HIT_TOKEN', amount: '100' },
                      { type: 'PROMPT_CACHE_MISS_TOKEN', amount: '20' },
                      { type: 'RESPONSE_TOKEN', amount: '5' },
                      { type: 'REQUEST', amount: '3' },
                    ],
                  },
                ],
              },
            ],
          },
        },
      });
    }
    if (parsed.pathname.endsWith('/cost')) {
      return jsonResponse({
        code: 0,
        msg: '',
        data: {
          biz_data: [
            {
              currency: 'CNY',
              days: [
                {
                  date: todayUtc,
                  data: [
                    {
                      model: 'deepseek-flash',
                      usage: [
                        { type: 'PROMPT_CACHE_HIT_TOKEN', amount: '0.5' },
                        { type: 'PROMPT_CACHE_MISS_TOKEN', amount: '0.1' },
                        { type: 'RESPONSE_TOKEN', amount: '0.2' },
                        { type: 'REQUEST', amount: '0' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
    }
    throw new Error('unexpected fetch ' + url);
  };
  try {
    const accountHost = fakeHost([], new Map(), accountCredentials);
    apply(accountHost.ctx);
    const answer = await request(accountHost, '/dsh-balance/usage?source=account&days=371');
    assert.equal(answer.status, 200);
    const payload = answer.body;
    assert.equal(payload.source, 'account');
    assert.equal(payload.granularity, 'day');
    assert.equal(payload.dayBasis, 'utc');
    assert.equal(payload.hours.length, 0);
    assert.equal(payload.days.length, 371);
    assert.equal(payload.today.date, todayUtc);
    assert.equal(payload.today.total, 125);
    assert.equal(payload.today.input, 20);
    assert.equal(payload.today.cacheRead, 100);
    assert.equal(payload.today.output, 5);
    assert.equal(payload.today.requests, 3);
    assert.equal(payload.cost.currency, 'CNY');
    assert.equal(payload.cost.today, 0.8);
    assert.equal(payload.cost.month, 0.8);
    assert.equal(payload.total.total, 125);
    assert.ok(headersSeen.every((token) => token === 'test-token'), 'the grant header is used');

    // 13 months of amount plus the current month's cost.
    assert.equal(calls, 14);
    // A repeated read is served from the month cache.
    const again = await request(accountHost, '/dsh-balance/usage?source=account&days=371');
    assert.equal(again.status, 200);
    assert.equal(calls, 14);
  } finally {
    globalThis.fetch = realFetch;
  }
}

// An invalid grant surfaces as an auth failure.
{
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => jsonResponse({ code: 40003, msg: 'Authorization Failed (invalid token)', data: null });
  try {
    const accountHost = fakeHost([], new Map(), accountCredentials);
    apply(accountHost.ctx);
    const answer = await request(accountHost, '/dsh-balance/usage?source=account');
    assert.equal(answer.status, 502);
    assert.deepEqual(answer.body, { error: 'account-unavailable', reason: 'auth' });
  } finally {
    globalThis.fetch = realFetch;
  }
}

console.log('host test: ok');
