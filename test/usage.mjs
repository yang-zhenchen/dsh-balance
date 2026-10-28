// Offline tests for the host-side token-usage fold and aggregation.
import assert from 'node:assert';
import { clampInt, createUsageFold, foldEvent, replayUsage, summarizeUsage } from '../lib/usage.js';

/** One session event. */
function event(type, seq, time, data) {
  return { type, seq, time, data };
}

/** One provider usage report. */
function usage(inputTokens, outputTokens, cacheReadTokens = 0, cacheWriteTokens = 0) {
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens: inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens,
  };
}

/** One settled assistant message. */
function message(seq, time, turn, step, reported) {
  return event('assistant/message', seq, time, { turn, step, usage: reported });
}

/** The public numbers of one folded sample. */
function pick(sample) {
  return {
    input: sample.input,
    output: sample.output,
    cacheRead: sample.cacheRead,
    cacheWrite: sample.cacheWrite,
    total: sample.total,
  };
}

const T1 = Date.parse('2026-10-28T09:30:00+08:00');
const T2 = Date.parse('2026-10-28T09:31:00+08:00');
const T3 = Date.parse('2026-10-28T09:32:00+08:00');
const T4 = Date.parse('2026-10-28T09:33:00+08:00');
const T5 = Date.parse('2026-10-28T09:34:00+08:00');
const T6 = Date.parse('2026-10-28T09:35:00+08:00');

// A final settlement replaces the streaming sample of the same attempt.
{
  const fold = createUsageFold();
  foldEvent(fold, event('assistant/attempt', 1, T1, {
    turn: 1,
    step: 1,
    stream: [{ type: 'chunk', time: T1, chunk: { type: 'usage', usage: usage(100, 10) } }],
  }));
  assert.equal(fold.samples.length, 1);
  foldEvent(fold, message(2, T2, 1, 1, usage(120, 12)));
  assert.equal(fold.samples.length, 1);
  assert.deepEqual(pick(fold.samples[0]), { input: 120, output: 12, cacheRead: 0, cacheWrite: 0, total: 132 });
  assert.equal(fold.samples[0].t, T2, 'a replacement carries the later sample time');
}

// A retry reopens the slot, so the retried attempt adds its own sample.
{
  const fold = createUsageFold();
  foldEvent(fold, message(1, T1, 1, 1, usage(100, 10)));
  foldEvent(fold, event('llm/retry-started', 2, T2, { turn: 1, step: 1 }));
  foldEvent(fold, message(3, T3, 1, 1, usage(200, 20)));
  assert.equal(fold.samples.length, 2);
  assert.equal(fold.samples[1].input, 200);
}

// A retry of a different step leaves the slot alone.
{
  const fold = createUsageFold();
  foldEvent(fold, message(1, T1, 1, 1, usage(100, 10)));
  foldEvent(fold, event('llm/retry-started', 2, T2, { turn: 1, step: 2 }));
  foldEvent(fold, message(3, T3, 1, 2, usage(200, 20)));
  assert.equal(fold.samples.length, 2);
}

// Compaction summaries are billed requests too and never replace a step.
{
  const fold = createUsageFold();
  foldEvent(fold, message(1, T1, 1, 1, usage(100, 10)));
  foldEvent(fold, event('compaction/summary', 2, T2, { compactionId: 'c1', usage: usage(1000, 50, 10, 0) }));
  foldEvent(fold, message(3, T3, 2, 1, usage(200, 20)));
  assert.equal(fold.samples.length, 3);
  assert.deepEqual(pick(fold.samples[1]), { input: 1000, output: 50, cacheRead: 10, cacheWrite: 0, total: 1060 });
}

// Unusable samples are ignored, not rendered as zeros.
{
  const fold = createUsageFold();
  foldEvent(fold, event('assistant/message', 1, T1, { turn: 1, step: 1, usage: { inputTokens: 'x', outputTokens: 1 } }));
  foldEvent(fold, event('assistant/message', 2, T2, { turn: 1, step: 1, usage: { outputTokens: 1 } }));
  foldEvent(fold, message(3, Number.NaN, 2, 1, usage(10, 1)));
  assert.equal(fold.samples.length, 0);
}

// Inherited fork history is skipped so parent usage is never double-counted.
{
  const events = [
    message(0, T1, 1, 1, usage(1000, 100)),
    message(1, T2, 2, 1, usage(10, 1)),
  ];
  const fold = replayUsage(events, 1);
  assert.equal(fold.samples.length, 1);
  assert.equal(fold.samples[0].input, 10);
  assert.equal(replayUsage(events, 0).samples.length, 2);
  assert.equal(replayUsage(events, 5).samples.length, 0);
}

// Day/hour bucketing, trailing windows, and the all-time total.
{
  const NOW = Date.parse('2026-10-28T12:00:00+08:00');
  const session = replayUsage([
    message(1, Date.parse('2026-10-28T09:30:00+08:00'), 1, 1, usage(10, 1)),
    message(2, Date.parse('2026-10-28T23:10:00+08:00'), 2, 1, usage(20, 2, 5, 0)),
    message(3, Date.parse('2026-10-27T23:10:00+08:00'), 3, 1, usage(5, 1)),
  ]);
  const older = replayUsage([
    message(1, Date.parse('2026-09-01T10:00:00+08:00'), 1, 1, usage(100, 10)),
  ]);
  const folds = new Map([
    ['s1', session],
    ['s2', older],
  ]);
  const summary = summarizeUsage(folds, { now: NOW, offsetSeconds: 28800, days: 14 });

  assert.equal(summary.rangeDays, 14);
  assert.equal(summary.days.length, 14);
  assert.equal(summary.days[0].date, '2026-10-15');
  assert.equal(summary.days.at(-1).date, '2026-10-28');

  assert.equal(summary.today.total, 38);
  assert.equal(summary.today.input, 30);
  assert.equal(summary.today.output, 3);
  assert.equal(summary.today.cacheRead, 5);
  assert.equal(summary.today.requests, 2);
  assert.equal(summary.today.sessions, 1);
  assert.equal(summary.hours[9].total, 11);
  assert.equal(summary.hours[9].requests, 1);
  assert.equal(summary.hours[23].total, 27);

  assert.equal(summary.yesterday.total, 6);
  assert.equal(summary.yesterday.date, '2026-10-27');
  assert.equal(summary.week.total, 44);
  assert.equal(summary.month.total, 44);
  assert.equal(summary.total.total, 154);
  assert.equal(summary.total.sessions, 2);
  assert.equal(summary.total.from, Date.parse('2026-09-01T10:00:00+08:00'));
  assert.equal(summary.total.to, Date.parse('2026-10-28T23:10:00+08:00'));
}

// The client's UTC offset decides which local day an event belongs to.
{
  const NOW = Date.parse('2026-10-28T12:00:00+08:00');
  const sampleTime = Date.parse('2026-10-28T00:30:00+08:00');
  const folds = new Map([['s1', replayUsage([message(1, sampleTime, 1, 1, usage(10, 1))])]]);

  const east = summarizeUsage(folds, { now: NOW, offsetSeconds: 28800, days: 7 });
  assert.equal(east.today.total, 11);
  assert.equal(east.hours[0].total, 11);

  const utc = summarizeUsage(folds, { now: NOW, offsetSeconds: 0, days: 7 });
  assert.equal(utc.today.total, 0);
  assert.equal(utc.yesterday.total, 11);
  // The hourly series covers today only, so a yesterday sample leaves it empty.
  assert.equal(utc.hours[16].total, 0);
}

// Empty input still answers a complete, zeroed payload.
{
  const summary = summarizeUsage(new Map(), { now: T1, offsetSeconds: 0, days: 7 });
  assert.equal(summary.days.length, 7);
  assert.equal(summary.hours.length, 24);
  assert.equal(summary.today.total, 0);
  assert.equal(summary.week.sessions, 0);
  assert.equal(summary.total.requests, 0);
}

// Query options are clamped, never trusted.
assert.equal(clampInt('999', 1, 60, 14), 60);
assert.equal(clampInt('-5', 1, 60, 14), 1);
assert.equal(clampInt('abc', 1, 60, 14), 14);
assert.equal(clampInt(null, 1, 60, 14), 14);
assert.equal(clampInt('12.9', 1, 60, 14), 12);

console.log('usage test: ok');
