// Pure token-usage fold and aggregation for the sidebar usage row.
//
// Host-only: this module never touches the DOM, `fetch`, or any Node builtin,
// so the same code runs in the Host plugin and in offline tests. It mirrors
// `@deepseek-ai/dsh-token-meter`'s `tokenUsage` projection: one billed sample
// per settled attempt, and a final sample replaces an earlier streaming sample
// of the same turn/step (`llm/retry-started` reopens the slot).

/** Route the Host registers and the browser polls. */
export const USAGE_ROUTE = "/dsh-balance/usage";

/** Longest day range a client may request (a 53-week calendar plus slack). */
export const USAGE_MAX_DAYS = 400;

/** Day range used when the query names none. */
export const USAGE_DEFAULT_DAYS = 14;

const DAY_MS = 86400000;

/**
 * @returns a fresh fold state for one session log.
 */
export function createUsageFold() {
	return {
		/** Flat samples: `{ t, input, output, cacheRead, cacheWrite }`. */
		samples: [],
		/** Turn/step owning the newest sample, for in-step replacement. */
		lastTurn: null,
		lastStep: null,
		/** Index in `samples` of that newest sample. */
		lastIndex: -1,
		/** Highest event seq folded so far. */
		tailSeq: -1
	};
}

/**
 * @param value - candidate token count.
 * @returns whether the value is a usable non-negative finite number.
 */
function isCount(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * @param usage - provider-reported usage object.
 * @returns normalized buckets, or null when the sample is unusable.
 */
export function normalizeUsage(usage) {
	if (usage === null || typeof usage !== "object") return null;
	if (!isCount(usage.inputTokens) || !isCount(usage.outputTokens)) return null;
	const input = usage.inputTokens;
	const output = usage.outputTokens;
	const cacheRead = isCount(usage.cacheReadTokens) ? usage.cacheReadTokens : 0;
	const cacheWrite = isCount(usage.cacheWriteTokens) ? usage.cacheWriteTokens : 0;
	return {
		input,
		output,
		cacheRead,
		cacheWrite,
		total: input + output + cacheRead + cacheWrite
	};
}

/**
 * Read the last provider usage sample embedded in an assistant stream.
 * @param stream - the event's compact stream rows.
 * @returns the usage object, or undefined.
 */
function streamUsage(stream) {
	if (!Array.isArray(stream)) return undefined;
	for (let index = stream.length - 1; index >= 0; index -= 1) {
		const chunk = stream[index]?.chunk;
		if (chunk !== null && typeof chunk === "object" && chunk.type === "usage" && chunk.usage !== undefined) return chunk.usage;
	}
	return undefined;
}

/**
 * The billed usage one durable event reports, if any.
 * @param event - one session event.
 * @returns the raw usage object, or undefined.
 */
export function usageOf(event) {
	if (event === null || typeof event !== "object") return undefined;
	const data = event.data;
	if (data === null || typeof data !== "object") return undefined;
	if (event.type === "assistant/message" && data.usage !== undefined) return data.usage;
	if (event.type === "compaction/summary" && data.usage !== undefined) return data.usage;
	if (event.type !== "assistant/message" && event.type !== "assistant/attempt") return undefined;
	return streamUsage(data.stream);
}

/**
 * Fold one committed event into a session's usage samples.
 * @param fold - state from {@link createUsageFold}.
 * @param event - one session event.
 */
export function foldEvent(fold, event) {
	if (fold === null || typeof fold !== "object" || event === null || typeof event !== "object") return;
	const seq = Number.isInteger(event.seq) ? event.seq : null;
	if (seq !== null && seq > fold.tailSeq) fold.tailSeq = seq;
	if (event.type === "llm/retry-started") {
		const data = event.data;
		if (fold.lastTurn !== null && data !== null && typeof data === "object" && data.turn === fold.lastTurn && data.step === fold.lastStep) {
			fold.lastTurn = null;
			fold.lastStep = null;
			fold.lastIndex = -1;
		}
		return;
	}
	const buckets = normalizeUsage(usageOf(event));
	if (buckets === null) return;
	const time = Number.isFinite(event.time) ? event.time : null;
	if (time === null) return;
	const compaction = event.type === "compaction/summary";
	const turn = compaction ? null : event.data?.turn;
	const step = compaction ? null : event.data?.step;
	const current = fold.lastIndex >= 0 ? fold.samples[fold.lastIndex] : undefined;
	const sameAttempt = !compaction && current !== undefined && turn !== null && turn !== undefined && fold.lastTurn === turn && fold.lastStep === step;
	if (sameAttempt) {
		if (current.input === buckets.input && current.output === buckets.output && current.cacheRead === buckets.cacheRead && current.cacheWrite === buckets.cacheWrite) return;
		current.t = time;
		current.input = buckets.input;
		current.output = buckets.output;
		current.cacheRead = buckets.cacheRead;
		current.cacheWrite = buckets.cacheWrite;
		current.total = buckets.total;
		return;
	}
	fold.samples.push({
		t: time,
		input: buckets.input,
		output: buckets.output,
		cacheRead: buckets.cacheRead,
		cacheWrite: buckets.cacheWrite,
		total: buckets.total
	});
	fold.lastTurn = compaction ? null : turn;
	fold.lastStep = compaction ? null : step;
	fold.lastIndex = fold.samples.length - 1;
}

/**
 * Replay a whole session log into a fresh fold.
 * Inherited events belong to the parent session and are skipped so a fork or
 * subagent seed never counts the same request twice.
 * @param events - the session's raw event log.
 * @param inheritedEventCount - leading inherited events to skip.
 * @returns the fold state.
 */
export function replayUsage(events, inheritedEventCount = 0) {
	const fold = createUsageFold();
	if (!Array.isArray(events)) return fold;
	const start = clampInt(inheritedEventCount, 0, events.length, 0);
	for (let index = start; index < events.length; index += 1) foldEvent(fold, events[index]);
	return fold;
}

/** @returns a zeroed bucket. */
function zeroTotals() {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		total: 0,
		requests: 0
	};
}

/**
 * Add one sample into a bucket.
 * @param bucket - accumulator in the zeroTotals shape.
 * @param sample - a folded usage sample.
 */
function addSample(bucket, sample) {
	bucket.input += sample.input;
	bucket.output += sample.output;
	bucket.cacheRead += sample.cacheRead;
	bucket.cacheWrite += sample.cacheWrite;
	bucket.total += sample.total;
	bucket.requests += 1;
}

/**
 * Add every numeric field of one bucket into another.
 * @param target - destination bucket.
 * @param source - bucket to add.
 */
function addTotals(target, source) {
	target.input += source.input;
	target.output += source.output;
	target.cacheRead += source.cacheRead;
	target.cacheWrite += source.cacheWrite;
	target.total += source.total;
	target.requests += source.requests;
}

/**
 * @param bucket - bucket or undefined.
 * @returns the public numeric fields, or zeros.
 */
function numbers(bucket) {
	if (bucket === undefined) return zeroTotals();
	return {
		input: Math.round(bucket.input),
		output: Math.round(bucket.output),
		cacheRead: Math.round(bucket.cacheRead),
		cacheWrite: Math.round(bucket.cacheWrite),
		total: Math.round(bucket.total),
		requests: bucket.requests
	};
}

/**
 * @param index - local day index.
 * @returns `YYYY-MM-DD` of that local day.
 */
function dateKey(index) {
	return new Date(index * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Clamp an integer option.
 * @param value - raw value.
 * @param min - inclusive lower bound.
 * @param max - inclusive upper bound.
 * @param fallback - value for absent or unusable input.
 * @returns a safe integer.
 */
export function clampInt(value, min, max, fallback) {
	if (value === null || value === undefined || value === "") return fallback;
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

/**
 * Aggregate folded samples into the row payload.
 * @param folds - session id → fold state.
 * @param options - `now`, `offsetSeconds` (client local offset), `days`.
 * @returns JSON-ready summary: today/yesterday, the day series, today's hours,
 * the 7-day and 30-day windows, and the all-time total.
 */
export function summarizeUsage(folds, options = {}) {
	const now = Number.isFinite(options.now) ? options.now : Date.now();
	const offsetSeconds = clampInt(options.offsetSeconds, -86400, 86400, 0);
	const rangeDays = clampInt(options.days, 1, USAGE_MAX_DAYS, USAGE_DEFAULT_DAYS);
	const offsetMs = offsetSeconds * 1000;
	const todayIndex = Math.floor((now + offsetMs) / DAY_MS);
	const windowDays = Math.max(rangeDays, 30);
	const firstIndex = todayIndex - windowDays + 1;

	const days = new Map();
	const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, ...zeroTotals() }));
	const all = { ...zeroTotals(), sessions: new Set(), from: 0, to: 0 };

	for (const [sessionId, fold] of folds) {
		const samples = fold?.samples;
		if (!Array.isArray(samples)) continue;
		for (const sample of samples) {
			if (sample === null || typeof sample !== "object" || !Number.isFinite(sample.t)) continue;
			const time = sample.t;
			addSample(all, sample);
			all.sessions.add(sessionId);
			if (all.from === 0 || time < all.from) all.from = time;
			if (time > all.to) all.to = time;
			const index = Math.floor((time + offsetMs) / DAY_MS);
			if (index < firstIndex || index > todayIndex) continue;
			let bucket = days.get(index);
			if (bucket === undefined) {
				bucket = { ...zeroTotals(), sessions: new Set() };
				days.set(index, bucket);
			}
			addSample(bucket, sample);
			bucket.sessions.add(sessionId);
			if (index === todayIndex) {
				const hour = new Date(time + offsetMs).getUTCHours();
				addSample(hours[hour], sample);
			}
		}
	}

	/** @param index - local day index. @returns one day entry. */
	const dayEntry = (index) => {
		const bucket = days.get(index);
		return {
			date: dateKey(index),
			...numbers(bucket),
			sessions: bucket === undefined ? 0 : bucket.sessions.size
		};
	};

	/** @param count - trailing local days to sum. @returns window totals. */
	const windowTotals = (count) => {
		const total = { ...zeroTotals(), sessions: new Set() };
		for (let index = todayIndex - count + 1; index <= todayIndex; index += 1) {
			const bucket = days.get(index);
			if (bucket === undefined) continue;
			addTotals(total, bucket);
			for (const sessionId of bucket.sessions) total.sessions.add(sessionId);
		}
		return {
			...numbers(total),
			sessions: total.sessions.size
		};
	};

	const series = [];
	for (let index = todayIndex - rangeDays + 1; index <= todayIndex; index += 1) series.push(dayEntry(index));

	return {
		generatedAt: now,
		offsetSeconds,
		rangeDays,
		today: dayEntry(todayIndex),
		yesterday: dayEntry(todayIndex - 1),
		days: series,
		hours: hours.map((bucket) => ({
			hour: bucket.hour,
			...numbers(bucket)
		})),
		week: windowTotals(7),
		month: windowTotals(30),
		total: {
			...numbers(all),
			sessions: all.sessions.size,
			from: all.from,
			to: all.to
		}
	};
}
