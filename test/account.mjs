// Offline tests for the account-source wire parsing and aggregation.
import assert from 'node:assert';
import {
  parseAccountAmount,
  parseAccountCost,
  summarizeAccount,
  windowMonthKeys,
  monthKeyOf,
} from '../lib/account.js';

const DAY = 86400000;

// Type mapping: cache hit/miss split, response, requests, and the legacy
// PROMPT_TOKEN aggregate only when it carries the prompt by itself.
{
  const days = parseAccountAmount({
    biz_data: {
      days: [
        {
          date: '2026-10-28',
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
            {
              model: 'legacy',
              usage: [
                { type: 'PROMPT_TOKEN', amount: '40' },
                { type: 'RESPONSE_TOKEN', amount: '10' },
              ],
            },
          ],
        },
      ],
    },
  });
  const day = days.get('2026-10-28');
  assert.deepEqual(day, { input: 60, output: 15, cacheRead: 100, cacheWrite: 0, total: 175, requests: 3 });
  assert.equal(days.size, 1);
}

// Malformed rows and days are skipped instead of poisoning the totals.
{
  const days = parseAccountAmount({
    biz_data: {
      days: [
        null,
        { date: 7, data: [] },
        { date: '2026-10-27', data: [null, { usage: [null, { type: 1, amount: '5' }, { type: 'REQUEST', amount: 'x' }] }] },
      ],
    },
  });
  assert.deepEqual(days.get('2026-10-27'), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, requests: 0 });
  assert.equal(days.size, 1);
  assert.equal(parseAccountAmount({}).size, 0);
}

// Cost envelopes carry currency and per-day amounts; REQUEST rows are free.
{
  const cost = parseAccountCost({
    biz_data: [
      {
        currency: 'USD',
        days: [
          {
            date: '2026-10-28',
            data: [
              {
                model: 'deepseek-flash',
                usage: [
                  { type: 'PROMPT_CACHE_HIT_TOKEN', amount: '0.5' },
                  { type: 'PROMPT_CACHE_MISS_TOKEN', amount: '0.25' },
                  { type: 'RESPONSE_TOKEN', amount: '0.125' },
                  { type: 'REQUEST', amount: '0' },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  assert.equal(cost.currency, 'USD');
  assert.equal(cost.days.get('2026-10-28'), 0.875);
  assert.equal(cost.total, 0.875);
  assert.equal(parseAccountCost({}).currency, 'CNY');
}

// The month window covers every month a trailing range touches.
{
  const now = Date.parse('2026-10-28T12:00:00Z');
  const keys = windowMonthKeys(now, 371);
  assert.equal(keys.length, 13);
  assert.equal(keys[0], '2025-10');
  assert.equal(keys[keys.length - 1], '2026-10');
  assert.equal(monthKeyOf(now), '2026-10');
  assert.deepEqual(windowMonthKeys(Date.parse('2026-01-01T00:00:00Z'), 7), ['2025-12', '2026-01']);
}

// UTC day series, today/yesterday, windows, and cost.
{
  const now = Date.parse('2026-10-28T12:00:00Z');
  const days = new Map([
    ['2026-10-28', { input: 100, output: 10, cacheRead: 50, cacheWrite: 0, total: 160, requests: 2 }],
    ['2026-10-27', { input: 50, output: 5, cacheRead: 0, cacheWrite: 0, total: 55, requests: 1 }],
    ['2026-10-01', { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, total: 2, requests: 1 }],
    ['2026-09-30', { input: 7, output: 7, cacheRead: 0, cacheWrite: 0, total: 14, requests: 1 }],
    ['2025-10-23', { input: 3, output: 3, cacheRead: 0, cacheWrite: 0, total: 6, requests: 1 }],
  ]);
  const cost = {
    currency: 'CNY',
    days: new Map([
      ['2026-09-30', 2],
      ['2026-10-01', 1.5],
      ['2026-10-27', 0.5],
      ['2026-10-28', 0.8],
    ]),
    total: 4.8,
  };
  const summary = summarizeAccount(days, cost, { now, rangeDays: 371 });

  assert.equal(summary.source, 'account');
  assert.equal(summary.granularity, 'day');
  assert.equal(summary.dayBasis, 'utc');
  assert.equal(summary.hours.length, 0);
  assert.equal(summary.days.length, 371);
  assert.equal(summary.days[0].date, '2025-10-23');
  assert.equal(summary.days[summary.days.length - 1].date, '2026-10-28');

  assert.equal(summary.today.date, '2026-10-28');
  assert.equal(summary.today.total, 160);
  assert.equal(summary.yesterday.total, 55);
  assert.equal(summary.week.total, 215);
  assert.equal(summary.month.total, 231);
  assert.equal(summary.total.total, 237);

  assert.equal(summary.cost.currency, 'CNY');
  assert.equal(summary.cost.today, 0.8);
  assert.equal(summary.cost.month, 2.8);
}

// No cost payload still yields a usable summary.
{
  const summary = summarizeAccount(new Map(), null, { now: Date.parse('2026-10-28T12:00:00Z'), rangeDays: 7 });
  assert.equal(summary.days.length, 7);
  assert.equal(summary.today.total, 0);
  assert.equal(summary.cost.today, 0);
  assert.equal(summary.cost.month, 0);
  assert.equal(summary.cost.currency, 'CNY');
}

// UTC bucketing ignores the client's offset entirely.
{
  const now = Date.parse('2026-10-28T00:30:00Z');
  const days = new Map([
    ['2026-10-28', { input: 10, output: 0, cacheRead: 0, cacheWrite: 0, total: 10, requests: 1 }],
    ['2026-10-27', { input: 20, output: 0, cacheRead: 0, cacheWrite: 0, total: 20, requests: 1 }],
  ]);
  const summary = summarizeAccount(days, null, { now, rangeDays: 2 });
  assert.equal(summary.today.date, '2026-10-28');
  assert.equal(summary.today.total, 10);
  assert.equal(summary.yesterday.total, 20);
  assert.equal(summary.days.length, 2);
  assert.equal(summary.days[0].date, new Date(Math.floor(now / DAY) * DAY - DAY).toISOString().slice(0, 10));
}

console.log('account test: ok');
