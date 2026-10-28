// Host half of the sidebar balance plugin.
//
// It owns the usage route the browser row polls. Two sources back it:
//   - local   — the durable session logs through `ctx.sessionQuery`: every
//               session is read once per Host process, then kept current from
//               the live `session/event` feed. Exact timestamps, so the panel
//               can show an hourly breakdown.
//   - account — the DeepSeek platform's own usage endpoints, read with the
//               desktop account grant. Account-wide (any machine, any API key),
//               but only daily and bucketed by UTC.
// The account grant never leaves the Host.
import {
	ACCOUNT_CREDENTIAL,
	ACCOUNT_ORIGIN,
	AccountError,
	monthKeyOf,
	requestAccountMonth,
	summarizeAccount,
	windowMonthKeys
} from "./account.js";
import { USAGE_DEFAULT_DAYS, USAGE_MAX_DAYS, USAGE_ROUTE, clampInt, foldEvent, replayUsage, summarizeUsage } from "./usage.js";

/** Sessions read concurrently while indexing. */
const SCAN_CONCURRENCY = 3;

/** Read attempts before one session is treated as unreadable. */
const MAX_READ_ATTEMPTS = 3;

/** Account month cache lifetimes: the open month moves, closed ones rarely do. */
const ACCOUNT_CURRENT_TTL_MS = 5 * 60 * 1000;
const ACCOUNT_CLOSED_TTL_MS = 6 * 60 * 60 * 1000;

/** Concurrent platform month requests. */
const ACCOUNT_CONCURRENCY = 3;

/**
 * Answer one JSON response.
 * @param res - server response.
 * @param status - HTTP status code.
 * @param value - JSON-serializable body.
 */
function sendJson(res, status, value) {
	res.statusCode = status;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.setHeader("cache-control", "no-store");
	res.end(JSON.stringify(value));
}

/**
 * Run workers over items with a fixed concurrency; the first rejection wins.
 * @param items - work items.
 * @param limit - maximum in-flight workers.
 * @param worker - per-item work.
 */
async function mapLimit(items, limit, worker) {
	let cursor = 0;
	const run = async () => {
		for (;;) {
			const index = cursor;
			cursor += 1;
			if (index >= items.length) return;
			await worker(items[index]);
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, run));
}

/**
 * Register the usage route once the web server, the request trust fence, and
 * the session query service are all present. Without them the plugin keeps
 * serving the balance row but exposes no usage endpoint.
 * @param ctx - Host plugin context.
 */
export function apply(ctx) {
	ctx.inject(["webServer", "connection", "sessionQuery"], (cap) => {
		/** session id → fold state. */
		const folds = new Map();
		/** Sessions that published events before they were indexed. */
		const pending = new Set();
		/** session id → failed read attempts. */
		const failed = new Map();
		/** session ids with a read in flight. */
		const reading = new Set();
		let scanning = true;
		let started = false;
		let disposed = false;
		let scanPromise = null;

		/** The credentials service, once mounted. */
		let credentialReader = null;
		cap.inject(["credentials"], (creds) => {
			credentialReader = creds.credentials;
			creds.effect(() => () => {
				credentialReader = null;
			}, "balance: credentials binding");
		});

		/** month key → `{ token, at, ttl, result, inflight }`. */
		const accountMonths = new Map();
		let accountToken = null;

		cap.effect(() => () => {
			disposed = true;
		}, "balance: usage lifetime");

		/**
		 * Read one session and replace its fold with a full replay.
		 * A read re-runs once when events landed while it was in flight.
		 * @param id - session id.
		 */
		const indexSession = async (id) => {
			if (disposed || folds.has(id) || reading.has(id)) return;
			if ((failed.get(id) ?? 0) >= MAX_READ_ATTEMPTS) return;
			reading.add(id);
			try {
				for (let attempt = 0; attempt < 2; attempt += 1) {
					pending.delete(id);
					const loaded = await cap.sessionQuery.readSession(id);
					const fold = replayUsage(loaded?.events, loaded?.inheritedEventCount);
					folds.set(id, fold);
					failed.delete(id);
					if (!pending.has(id)) return;
				}
				// A live event landed after the second read: drop the fold so the next
				// request indexes this session again instead of missing that event.
				folds.delete(id);
			} catch (_error) {
				failed.set(id, (failed.get(id) ?? 0) + 1);
			} finally {
				reading.delete(id);
			}
		};

		/** Index every session that published events before its first read. */
		const indexPending = async () => {
			const queue = [...pending].filter((id) => !folds.has(id) && !reading.has(id) && (failed.get(id) ?? 0) < MAX_READ_ATTEMPTS);
			if (queue.length === 0) return;
			const worker = async () => {
				for (;;) {
					const id = queue.shift();
					if (id === undefined || disposed) return;
					await indexSession(id);
				}
			};
			await Promise.all(Array.from({ length: Math.min(SCAN_CONCURRENCY, queue.length) }, worker));
		};

		/** Index the whole corpus newest-first, live sessions ahead of stored ones. */
		const scan = () => {
			if (scanPromise !== null) return scanPromise;
			scanning = true;
			scanPromise = (async () => {
				try {
					const records = await cap.sessionQuery.listSessions();
					const ordered = Array.isArray(records) ? [...records] : [];
					ordered.sort((left, right) => {
						const live = Number(right?.live === true) - Number(left?.live === true);
						if (live !== 0) return live;
						return (right?.header?.createdAt ?? 0) - (left?.header?.createdAt ?? 0);
					});
					let cursor = 0;
					const worker = async () => {
						for (;;) {
							if (disposed) return;
							const index = cursor;
							cursor += 1;
							if (index >= ordered.length) return;
							const id = ordered[index]?.header?.id;
							if (typeof id !== "string" || id === "") continue;
							await indexSession(id);
						}
					};
					await Promise.all(Array.from({ length: Math.min(SCAN_CONCURRENCY, Math.max(ordered.length, 1)) }, worker));
				} catch (_error) {
					// A failing corpus listing leaves whatever is indexed in place.
				} finally {
					scanning = false;
					scanPromise = null;
				}
			})();
			return scanPromise;
		};

		// Every committed live event keeps its session's fold current. A session
		// seen for the first time here is indexed on the next request.
		cap.on("session/event", (session, event) => {
			if (disposed) return;
			const id = session?.id;
			if (typeof id !== "string" || id === "") return;
			const fold = folds.get(id);
			if (fold !== undefined) {
				foldEvent(fold, event);
				return;
			}
			pending.add(id);
		});

		/**
		 * Read the desktop account grant from DSH credentials.
		 * @returns `{ token, origin }`, or null when unavailable.
		 */
		const readAccountGrant = async () => {
			const reader = credentialReader;
			if (reader === null) return null;
			try {
				const record = await reader.readRecord(ACCOUNT_CREDENTIAL);
				if (record === null || record === undefined || record.kind !== "grant") return null;
				const token = record.payload?.token;
				if (typeof token !== "string" || token === "") return null;
				const issuer = record.payload?.issuer;
				const origin = typeof issuer === "string" && /^https:\/\/[^/]+$/.test(issuer) ? issuer : ACCOUNT_ORIGIN;
				return {
					token,
					origin
				};
			} catch (_error) {
				return null;
			}
		};

		/**
		 * Load one platform month through the TTL cache.
		 * @param grant - account grant.
		 * @param key - `YYYY-MM`.
		 * @param includeCost - whether the cost endpoint is needed.
		 * @returns the month result.
		 */
		const loadAccountMonth = (grant, key, includeCost) => {
			const now = Date.now();
			const cached = accountMonths.get(key);
			if (cached !== undefined && cached.token !== grant.token) accountMonths.clear();
			const entry = accountMonths.get(key);
			if (entry !== undefined) {
				if (entry.inflight !== null) return entry.inflight;
				if (now - entry.at < entry.ttl) return Promise.resolve(entry.result);
			}
			const created = {
				token: grant.token,
				at: 0,
				ttl: ACCOUNT_CLOSED_TTL_MS,
				result: null,
				inflight: null
			};
			const [year, month] = key.split("-").map(Number);
			created.inflight = requestAccountMonth({
				origin: grant.origin,
				token: grant.token,
				year,
				month,
				includeCost
			}).then((result) => {
				created.result = result;
				created.at = Date.now();
				created.ttl = key === monthKeyOf(Date.now()) ? ACCOUNT_CURRENT_TTL_MS : ACCOUNT_CLOSED_TTL_MS;
				return result;
			}).finally(() => {
				created.inflight = null;
			});
			accountMonths.set(key, created);
			return created.inflight;
		};

		/**
		 * Build the account-sourced payload.
		 * @param rangeDays - trailing day count.
		 * @returns the summary payload.
		 */
		const accountPayload = async (rangeDays) => {
			const grant = await readAccountGrant();
			if (grant === null) throw new AccountError("missing");
			if (accountToken !== grant.token) {
				accountMonths.clear();
				accountToken = grant.token;
			}
			const now = Date.now();
			const keys = windowMonthKeys(now, rangeDays);
			const currentKey = monthKeyOf(now);
			const results = new Map();
			let failures = 0;
			try {
				await mapLimit(keys, ACCOUNT_CONCURRENCY, async (key) => {
					try {
						results.set(key, await loadAccountMonth(grant, key, key === currentKey));
					} catch (error) {
						if (error instanceof AccountError && error.reason === "auth") throw error;
						failures += 1;
					}
				});
			} catch (error) {
				accountMonths.clear();
				throw error;
			}
			if (results.size === 0) throw new AccountError("network");
			const days = new Map();
			for (const result of results.values()) {
				for (const [date, entry] of result.days) days.set(date, entry);
			}
			const cost = results.get(currentKey)?.cost ?? null;
			const payload = summarizeAccount(days, cost, {
				now,
				rangeDays
			});
			payload.scanning = false;
			payload.partial = failures > 0;
			return payload;
		};

		/**
		 * Build the local-session payload.
		 * @param rangeDays - trailing day count.
		 * @param offsetSeconds - browser local offset.
		 * @returns the summary payload.
		 */
		const localPayload = async (rangeDays, offsetSeconds) => {
			if (!started) {
				started = true;
				scan();
			}
			await indexPending();
			const payload = summarizeUsage(folds, {
				now: Date.now(),
				offsetSeconds,
				days: rangeDays
			});
			payload.source = "local";
			payload.granularity = "hour";
			payload.dayBasis = "local";
			payload.scanning = scanning;
			payload.partial = failed.size > 0;
			return payload;
		};

		/**
		 * Serve the usage summary for one browser request.
		 * @param req - HTTP request.
		 * @param res - HTTP response.
		 */
		const handler = async (req, res) => {
			const rejection = cap.connection.requestRejection(req);
			if (rejection !== undefined) {
				res.statusCode = rejection;
				res.end();
				return;
			}
			if (req.method !== "GET") {
				res.statusCode = 405;
				res.setHeader("allow", "GET");
				res.end();
				return;
			}
			let url;
			try {
				url = new URL(String(req.url ?? USAGE_ROUTE), "http://localhost");
			} catch (_error) {
				sendJson(res, 400, { error: "bad-request" });
				return;
			}
			const days = clampInt(url.searchParams.get("days"), 1, USAGE_MAX_DAYS, USAGE_DEFAULT_DAYS);
			const offsetSeconds = clampInt(url.searchParams.get("offset"), -86400, 86400, 0);
			const source = url.searchParams.get("source") === "account" ? "account" : "local";
			try {
				const payload = source === "account" ? await accountPayload(days) : await localPayload(days, offsetSeconds);
				sendJson(res, 200, payload);
			} catch (error) {
				if (error instanceof AccountError) {
					sendJson(res, 502, {
						error: "account-unavailable",
						reason: error.reason
					});
					return;
				}
				sendJson(res, 500, { error: "usage-unavailable" });
			}
		};

		cap.effect(() => cap.webServer.register({
			kind: "exact",
			path: USAGE_ROUTE,
			handler
		}), `balance: GET ${USAGE_ROUTE}`);
	});
}
