// Account-level token usage for the sidebar row.
//
// The platform's Web console exposes undocumented usage endpoints
// (`/api/v0/usage/amount`, `/api/v0/usage/cost`) that accept the DSH account
// grant in the `x-dsh-auth-token` header. This module holds the wire parsing and
// the aggregation only; credentials, caching, and the route live in the Host
// entry. Figures are UTC days, because that is how the platform buckets them.

/** Platform origin the desktop account grant is issued for. */
export const ACCOUNT_ORIGIN = "https://platform.deepseek.com";

/** Credentials record holding the account grant. */
export const ACCOUNT_CREDENTIAL = "deepseek-account-platform/default";

/** Longest look-back the endpoint client supports. */
export const ACCOUNT_MAX_DAYS = 400;

/** Request timeout for one usage month. */
const MONTH_TIMEOUT_MS = 8000;

/** Typed failure with a stable reason the route can expose. */
export class AccountError extends Error {
	/**
	 * @param reason - `auth`, `network`, or `response`.
	 * @param detail - optional HTTP status or platform code.
	 */
	constructor(reason, detail) {
		super("account: " + reason);
		this.reason = reason;
		this.detail = detail;
	}
}

/** @returns one zeroed account day. */
function zeroDay() {
	return {
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		total: 0,
		requests: 0
	};
}

/** @param value - candidate amount. @returns a finite non-negative number. */
function amountOf(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Sum one model's usage rows by type.
 * @param model - one `{ model, usage: [{ type, amount }] }` row.
 * @returns type → amount.
 */
function usageByType(model) {
	const buckets = {};
	const rows = Array.isArray(model?.usage) ? model.usage : [];
	for (const row of rows) {
		if (row === null || typeof row !== "object" || typeof row.type !== "string") continue;
		buckets[row.type] = (buckets[row.type] ?? 0) + amountOf(row.amount);
	}
	return buckets;
}

/**
 * Add one model's usage into a day bucket.
 * `PROMPT_TOKEN` is a legacy aggregate the platform currently reports as zero;
 * when it is the only prompt figure it is counted as uncached input.
 * @param day - accumulator.
 * @param buckets - type → amount.
 */
function addModelUsage(day, buckets) {
	const cacheRead = buckets.PROMPT_CACHE_HIT_TOKEN ?? 0;
	const cacheMiss = buckets.PROMPT_CACHE_MISS_TOKEN ?? 0;
	const prompt = buckets.PROMPT_TOKEN ?? 0;
	day.cacheRead += cacheRead;
	day.input += cacheMiss;
	if (prompt > 0 && cacheRead + cacheMiss === 0) day.input += prompt;
	day.output += buckets.RESPONSE_TOKEN ?? 0;
	day.requests += buckets.REQUEST ?? 0;
}

/** @param payload - an `amount` envelope's `data`. @returns date → day bucket. */
export function parseAccountAmount(payload) {
	const biz = payload?.biz_data ?? {};
	const days = new Map();
	for (const day of Array.isArray(biz.days) ? biz.days : []) {
		if (day === null || typeof day !== "object" || typeof day.date !== "string") continue;
		const entry = zeroDay();
		for (const model of Array.isArray(day.data) ? day.data : []) addModelUsage(entry, usageByType(model));
		entry.total = entry.input + entry.output + entry.cacheRead + entry.cacheWrite;
		days.set(day.date, entry);
	}
	return days;
}

/** @param payload - a `cost` envelope's `data`. @returns `{ currency, days }`. */
export function parseAccountCost(payload) {
	const raw = payload?.biz_data;
	const item = Array.isArray(raw) ? raw[0] : raw;
	const days = new Map();
	let total = 0;
	for (const day of Array.isArray(item?.days) ? item.days : []) {
		if (day === null || typeof day !== "object" || typeof day.date !== "string") continue;
		let amount = 0;
		for (const model of Array.isArray(day.data) ? day.data : []) {
			for (const row of Array.isArray(model?.usage) ? model.usage : []) {
				if (row?.type === "REQUEST") continue;
				amount += amountOf(row?.amount);
			}
		}
		days.set(day.date, amount);
		total += amount;
	}
	return {
		currency: typeof item?.currency === "string" && item.currency !== "" ? item.currency : "CNY",
		days,
		total
	};
}

/**
 * Unwrap one platform envelope.
 * @param body - parsed response body.
 * @returns `data`.
 * @throws {AccountError} for an auth or unexpected envelope.
 */
function unwrap(body) {
	if (body === null || typeof body !== "object") throw new AccountError("response");
	if (body.code !== 0) throw new AccountError(body.code === 40002 || body.code === 40003 ? "auth" : "response", body.code);
	return body.data;
}

/**
 * Request one JSON endpoint on the platform.
 * @param url - absolute URL.
 * @param token - account grant.
 * @param fetchImpl - fetch implementation.
 * @returns unwrapped envelope data.
 */
async function requestUsage(url, token, fetchImpl) {
	let response;
	try {
		response = await fetchImpl(url, {
			headers: {
				accept: "application/json",
				"x-dsh-auth-token": token,
				"user-agent": "dsh-plugin-balance"
			},
			signal: AbortSignal.timeout(MONTH_TIMEOUT_MS)
		});
	} catch (_error) {
		throw new AccountError("network");
	}
	if (response.status === 401 || response.status === 403) throw new AccountError("auth", response.status);
	if (!response.ok) throw new AccountError("network", response.status);
	let body;
	try {
		body = await response.json();
	} catch (_error) {
		throw new AccountError("response");
	}
	return unwrap(body);
}

/**
 * Fetch one calendar month of account usage.
 * @param options - origin, token, year, month, whether cost is needed, fetch.
 * @returns `{ days, cost }` where cost is null when not requested.
 */
export async function requestAccountMonth(options) {
	const origin = options.origin ?? ACCOUNT_ORIGIN;
	const base = origin + "/api/v0/usage";
	const query = "?month=" + options.month + "&year=" + options.year;
	const fetchImpl = options.fetchImpl ?? fetch;
	const amount = requestUsage(base + "/amount" + query, options.token, fetchImpl);
	const cost = options.includeCost === true ? requestUsage(base + "/cost" + query, options.token, fetchImpl) : null;
	const [amountData, costData] = await Promise.all([amount, cost]);
	return {
		days: parseAccountAmount(amountData),
		cost: costData === null ? null : parseAccountCost(costData)
	};
}

/**
 * @param time - epoch milliseconds.
 * @returns the UTC calendar month key, `YYYY-MM`.
 */
export function monthKeyOf(time) {
	const date = new Date(time);
	return String(date.getUTCFullYear()) + "-" + String(date.getUTCMonth() + 1).padStart(2, "0");
}

/**
 * List the month keys covering a trailing day window ending today (UTC).
 * @param now - epoch milliseconds.
 * @param rangeDays - window length in days.
 * @returns ascending `YYYY-MM` keys.
 */
export function windowMonthKeys(now, rangeDays) {
	const day = 86400000;
	const first = Math.floor(now / day) - rangeDays + 1;
	const last = Math.floor(now / day);
	const keys = [];
	const cursor = new Date(first * day);
	const end = new Date(last * day);
	cursor.setUTCDate(1);
	end.setUTCDate(1);
	while (cursor.getTime() <= end.getTime()) {
		keys.push(monthKeyOf(cursor.getTime()));
		cursor.setUTCMonth(cursor.getUTCMonth() + 1);
	}
	return keys;
}

/**
 * @param value - day bucket or undefined.
 * @returns the public numeric fields.
 */
function dayNumbers(value) {
	if (value === undefined) return zeroDay();
	return {
		input: Math.round(value.input),
		output: Math.round(value.output),
		cacheRead: Math.round(value.cacheRead),
		cacheWrite: Math.round(value.cacheWrite),
		total: Math.round(value.total),
		requests: Math.round(value.requests)
	};
}

/**
 * Aggregate account day buckets into the shared row payload.
 * @param days - `YYYY-MM-DD` → day bucket.
 * @param cost - `{ currency, days, total }` for the current month, or null.
 * @param options - `now` and `rangeDays`.
 * @returns the account payload: day series, today/yesterday, windows, cost.
 */
export function summarizeAccount(days, cost, options = {}) {
	const now = Number.isFinite(options.now) ? options.now : Date.now();
	const rangeDays = Math.min(ACCOUNT_MAX_DAYS, Math.max(1, Math.trunc(options.rangeDays ?? 371)));
	const day = 86400000;
	const todayIndex = Math.floor(now / day);
	const todayDate = new Date(todayIndex * day).toISOString().slice(0, 10);
	const yesterdayDate = new Date((todayIndex - 1) * day).toISOString().slice(0, 10);
	const entryOf = (date) => days.get(date) ?? zeroDay();

	const series = [];
	for (let index = todayIndex - rangeDays + 1; index <= todayIndex; index += 1) {
		const date = new Date(index * day).toISOString().slice(0, 10);
		series.push({
			date,
			...dayNumbers(days.get(date))
		});
	}

	const sumTail = (count) => {
		const total = zeroDay();
		for (const entry of series.slice(-count)) {
			total.input += entry.input;
			total.output += entry.output;
			total.cacheRead += entry.cacheRead;
			total.cacheWrite += entry.cacheWrite;
			total.total += entry.total;
			total.requests += entry.requests;
		}
		return dayNumbers(total);
	};

	const currentMonth = todayDate.slice(0, 7);
	let monthCost = 0;
	if (cost !== null && cost !== undefined) {
		for (const [date, amount] of cost.days) {
			if (date.slice(0, 7) === currentMonth) monthCost += amount;
		}
	}
	const todayCost = cost === null || cost === undefined ? 0 : cost.days.get(todayDate) ?? 0;

	return {
		source: "account",
		granularity: "day",
		dayBasis: "utc",
		generatedAt: now,
		rangeDays,
		today: {
			date: todayDate,
			...dayNumbers(entryOf(todayDate))
		},
		yesterday: {
			date: yesterdayDate,
			...dayNumbers(entryOf(yesterdayDate))
		},
		days: series,
		hours: [],
		week: sumTail(7),
		month: sumTail(30),
		total: sumTail(series.length),
		cost: {
			currency: cost?.currency ?? "CNY",
			today: Math.round(todayCost * 10000) / 10000,
			month: Math.round(monthCost * 10000) / 10000
		}
	};
}
