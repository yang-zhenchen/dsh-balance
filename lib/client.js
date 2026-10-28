window.__ModuleLoader__.load({
	id: "dsh-plugin-balance",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var React = require("react");
		// `react-dom` is a platform seed word, but the row must survive a shell
		// that does not seed it: the panel then renders inline instead of portaled.
		var ReactDOM = null;
		try {
			ReactDOM = require("react-dom");
		} catch (_error) {
			ReactDOM = null;
		}
		/** Dictionary namespace owned by this plugin. */
		const NS = "balance";
		/** Sidebar seat rendered directly above the account/avatar row. */
		const SLOT = "sidebar.footer.action";
		/** Balance poll interval while the page is visible. */
		const POLL_MS = 15000;
		/** Usage poll interval while the page is visible. */
		const USAGE_POLL_MS = 60000;
		/** Usage route, relative to the page so a mounted sub-path still resolves. */
		const USAGE_ROUTE = "dsh-balance/usage";
		/** Days the Host aggregates: 53 calendar weeks. */
		const USAGE_DAYS = 371;
		/** Data source persistence key. */
		const SOURCE_STORAGE_KEY = "dsh-balance/usage-source";
		/** Calendar columns: 52 completed weeks plus the current one. */
		const CALENDAR_WEEKS = 53;
		/** Retry cadence while the Host is still indexing history. */
		const USAGE_SCAN_RETRY_MS = 2000;
		/** Maximum background retries while the Host reports `scanning`. */
		const USAGE_SCAN_RETRIES = 20;
		/** Hour strip height in CSS pixels. */
		const HOUR_CHART_HEIGHT = 44;
		/** Viewport margin and trigger gap for the floating panel. */
		const PANEL_MARGIN = 12;
		const PANEL_GAP = 8;
		const zh = {
			label: "余额",
			bonus: "赠金",
			recharge: "充值余额",
			loading: "—",
			signedOut: "未登录",
			retry: "点击重试",
			refresh: "点击刷新余额",
			updated: "更新于",
			failed: "余额读取失败",
			signedOutHint: "登录 DeepSeek 账号后可查看余额",
			usageLabel: "Token 用量",
			usageTitle: "Token 活动",
			usageToday: "今日",
			usageYesterday: "昨日",
			usageVsYesterday: "较昨日",
			usageHours: "今日时段",
			usageLastMonths: "近 12 个月",
			usageLast7: "近 7 天",
			usageLast30: "近 30 天",
			usageTotal: "总计",
			usageSum: "合计",
			usageLess: "少",
			usageMore: "多",
			usageModeDay: "每天",
			usageModeWeek: "每周",
			usageModeTotal: "累计总量",
			usageInput: "输入",
			usageOutput: "输出",
			usageCacheRead: "缓存读取",
			usageCacheWrite: "缓存写入",
			usageRequestsLabel: "请求",
			usageSessionsLabel: "会话",
			usageRequests: "{count} 次",
			usageSessions: "{count} 个",
			usageHint: "点击查看 Token 活动",
			usageRefresh: "刷新用量",
			usageClose: "关闭",
			usageScanning: "正在统计…",
			usageFailed: "用量读取失败",
			usageRetry: "点击重试",
			usageEmpty: "暂无用量数据",
			usageRefreshFailed: "刷新失败，显示上次结果",
			usageSourceLocal: "本机",
			usageSourceAccount: "账号",
			usageTodayUtc: "今日（UTC）",
			usageAccountMonth: "本月",
			usageAccountCostToday: "今日费用",
			usageAccountCostMonth: "本月费用",
			usageAccountNote: "账号口径 · 平台按 UTC 日统计 · 无小时数据",
			usageAccountPartial: "部分月份读取失败",
			usageAccountMissing: "未登录 DeepSeek 账号，读不到账号用量",
			usageAccountAuth: "登录已失效，请重新登录 DeepSeek 账号",
			usageAccountNetwork: "账号用量读取失败"
		};
		const en = {
			label: "Balance",
			bonus: "Bonus",
			recharge: "Balance",
			loading: "—",
			signedOut: "Signed out",
			retry: "Retry",
			refresh: "Refresh balance",
			updated: "Updated",
			failed: "Balance unavailable",
			signedOutHint: "Sign in to your DeepSeek account to see your balance",
			usageLabel: "Token usage",
			usageTitle: "Token activity",
			usageToday: "Today",
			usageYesterday: "Yesterday",
			usageVsYesterday: "vs yesterday",
			usageHours: "Today by hour",
			usageLastMonths: "Last 12 months",
			usageLast7: "7 days",
			usageLast30: "30 days",
			usageTotal: "All time",
			usageSum: "Total",
			usageLess: "Less",
			usageMore: "More",
			usageModeDay: "Daily",
			usageModeWeek: "Weekly",
			usageModeTotal: "Cumulative",
			usageInput: "Input",
			usageOutput: "Output",
			usageCacheRead: "Cache read",
			usageCacheWrite: "Cache write",
			usageRequestsLabel: "Requests",
			usageSessionsLabel: "Sessions",
			usageRequests: "{count}",
			usageSessions: "{count}",
			usageHint: "Click for token activity",
			usageRefresh: "Refresh usage",
			usageClose: "Close",
			usageScanning: "Counting…",
			usageFailed: "Usage unavailable",
			usageRetry: "Retry",
			usageEmpty: "No usage yet",
			usageRefreshFailed: "Refresh failed; showing the last result",
			usageSourceLocal: "This PC",
			usageSourceAccount: "Account",
			usageTodayUtc: "Today (UTC)",
			usageAccountMonth: "This month",
			usageAccountCostToday: "Today cost",
			usageAccountCostMonth: "This month cost",
			usageAccountNote: "Account data · platform days are UTC · no hourly breakdown",
			usageAccountPartial: "some months could not be read",
			usageAccountMissing: "Sign in to your DeepSeek account to read account usage",
			usageAccountAuth: "Sign-in expired; sign in to your DeepSeek account again",
			usageAccountNetwork: "Account usage unavailable"
		};
		const styleText = [
			".dsb_row{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;height:30px;box-sizing:border-box;padding:0 8px;border:0;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;text-align:left;cursor:pointer;-webkit-app-region:no-drag}",
			".dsb_row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsb_row:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}",
			".dsb_label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dsb_amounts{flex:0 0 auto;display:flex;align-items:baseline;gap:5px;white-space:nowrap;font-variant-numeric:tabular-nums}",
			".dsb_value{color:var(--dsw-alias-label-primary);font-weight:500}",
			".dsb_value[data-phase=loading],.dsb_value[data-phase=failed],.dsb_value[data-phase=signed-out]{color:var(--dsw-alias-label-tertiary);font-weight:400}",
			".dsb_bonus{color:var(--dsw-alias-label-tertiary);font-size:11px}",
			".dsb_row[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsb_rows{display:flex;flex-direction:column;width:100%;min-width:0}",
			".dsu_panel{position:fixed;z-index:1100;box-sizing:border-box;width:min(680px,calc(100vw - 24px));padding:14px 16px 12px;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));box-shadow:var(--dsw-elevation-prominent,0 8px 24px rgba(0,0,0,.16));backdrop-filter:var(--dsw-menu-backdrop-filter,blur(20px));color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;overflow:auto;overscroll-behavior:contain}",
			".dsu_header{display:flex;align-items:center;gap:4px}",
			".dsu_title{flex:1 1 auto;min-width:0;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:500}",
			".dsu_modes{display:inline-flex;align-items:center;gap:2px;margin-right:6px}",
			".dsu_mode{padding:2px 7px;border:0;border-radius:var(--dsw-radius-xs);background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;line-height:16px;white-space:nowrap;cursor:pointer}",
			".dsu_mode:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
			".dsu_mode[data-active=true]{color:var(--dsw-alias-label-primary);font-weight:500}",
			".dsu_mode:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-1px}",
			".dsu_divider{width:1px;height:14px;margin:0 6px;background:var(--dsw-alias-border-l2)}",
			".dsu_accountBody{display:flex;flex-direction:column;gap:8px;margin-top:12px;padding-top:12px;border-top:.5px solid var(--dsw-alias-border-l2)}",
			".dsu_statGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 16px}",
			".dsu_accountCell{display:flex;flex-direction:column;gap:2px;min-width:0}",
			".dsu_accountCell span{color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dsu_accountCell b{color:var(--dsw-alias-label-secondary);font-size:14px;font-weight:600;line-height:20px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dsu_accountCell[data-emphasis=true] b{color:var(--dsw-alias-label-primary);font-size:18px;line-height:24px}",
			".dsu_icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer}",
			".dsu_icon:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
			".dsu_icon:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}",
			".dsu_icon[data-busy=true] svg{animation:dsu-spin 900ms linear infinite}",
			"@keyframes dsu-spin{to{transform:rotate(360deg)}}",
			".dsu_caption{display:flex;justify-content:space-between;gap:8px;margin-top:6px;color:var(--dsw-alias-label-tertiary);font-size:11px;font-variant-numeric:tabular-nums;min-height:16px}",
			".dsu_caption b{color:var(--dsw-alias-label-secondary);font-weight:500}",
			".dsu_calendar{display:grid;grid-auto-flow:column;gap:2px;margin-top:2px}",
			".dsu_cell{width:100%;height:100%;border-radius:2px;background:var(--dsw-alias-bg-mask-2,var(--dsw-alias-bg-layer-3));cursor:default}",
			".dsu_cell[data-empty=true]{visibility:hidden}",
			".dsu_cell[data-level]{background:var(--dsw-alias-state-business-primary)}",
			".dsu_cell[data-level='1']{opacity:.28}",
			".dsu_cell[data-level='2']{opacity:.5}",
			".dsu_cell[data-level='3']{opacity:.72}",
			".dsu_cell[data-level='4']{opacity:1}",
			".dsu_cell:hover{outline:1px solid var(--dsw-alias-label-tertiary);outline-offset:0}",
			".dsu_months{display:grid;margin-top:4px;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:14px}",
			".dsu_months span{white-space:nowrap}",
			".dsu_legendRow{display:flex;justify-content:flex-end;margin-top:2px}",
			".dsu_legend{display:inline-flex;align-items:center;gap:3px;color:var(--dsw-alias-label-tertiary);font-size:10px}",
			".dsu_swatch{width:9px;height:9px;border-radius:2px;background:var(--dsw-alias-bg-mask-2,var(--dsw-alias-bg-layer-3))}",
			".dsu_swatch[data-level]{background:var(--dsw-alias-state-business-primary)}",
			".dsu_swatch[data-level='1']{opacity:.28}",
			".dsu_swatch[data-level='2']{opacity:.5}",
			".dsu_swatch[data-level='3']{opacity:.72}",
			".dsu_swatch[data-level='4']{opacity:1}",
			".dsu_body{display:flex;gap:20px;margin-top:12px;padding-top:12px;border-top:.5px solid var(--dsw-alias-border-l2)}",
			".dsu_left{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}",
			".dsu_right{flex:0 0 230px;min-width:0;display:flex;flex-direction:column;gap:6px}",
			".dsu_headline{display:flex;align-items:baseline;gap:6px}",
			".dsu_big{color:var(--dsw-alias-label-primary);font-size:22px;font-weight:600;line-height:28px;letter-spacing:-.01em;font-variant-numeric:tabular-nums}",
			".dsu_unit{color:var(--dsw-alias-label-tertiary);font-size:11px}",
			".dsu_delta{color:var(--dsw-alias-label-tertiary);font-size:11px;white-space:nowrap}",
			".dsu_delta[data-dir=up]{color:var(--dsw-alias-state-warn-label,var(--dsw-alias-label-tertiary))}",
			".dsu_chart{display:flex;align-items:flex-end;gap:3px;height:var(--dsu-chart-height);padding-top:2px;border-bottom:1px solid var(--dsw-alias-border-l1)}",
			".dsu_col{flex:1 1 0;min-width:0;height:100%;display:flex;align-items:flex-end;cursor:default}",
			".dsu_bar{width:100%;min-height:0;border-radius:2px 2px 0 0;background:var(--dsw-alias-state-business-primary);opacity:.55;transition:opacity 120ms ease}",
			".dsu_bar[data-peak=true]{opacity:.95}",
			".dsu_col:hover .dsu_bar{opacity:.95}",
			".dsu_axis{display:flex;justify-content:space-between;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:14px;font-variant-numeric:tabular-nums}",
			".dsu_grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 16px}",
			".dsu_pair{display:flex;align-items:baseline;justify-content:space-between;gap:8px;color:var(--dsw-alias-label-tertiary);font-size:11px}",
			".dsu_pair b{color:var(--dsw-alias-label-secondary);font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}",
			".dsu_footer{display:flex;flex-wrap:wrap;gap:2px 14px;margin-top:10px;color:var(--dsw-alias-label-tertiary);font-size:11px}",
			".dsu_footer b{color:var(--dsw-alias-label-secondary);font-weight:500;font-variant-numeric:tabular-nums}",
			".dsu_note{margin-top:6px;color:var(--dsw-alias-label-tertiary);font-size:11px}",
			".dsu_empty{padding:26px 0;text-align:center;color:var(--dsw-alias-label-tertiary)}"
		].join("");
		const styleId = "dsh-plugin-balance/balance.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(styleId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-plugin-balance";
			tag.dataset.pluginCss = styleId;
			tag.textContent = styleText;
			document.head.appendChild(tag);
		}
		/**
		* Render one decimal balance with Platform Web's display rules.
		* @param raw - server-authored decimal string.
		* @param symbol - currency symbol.
		* @returns grouped signed currency text.
		*/
		function formatAmount(raw, symbol) {
			const value = Number(raw);
			if (!Number.isFinite(value)) return symbol + "—";
			if (value > 0 && value < 0.01) return "<" + symbol + "0.01";
			if (value < 0 && value > -0.01) return "-" + symbol + "0.01";
			const cents = value >= 0 ? Math.trunc(value * 100) / 100 : Math.round(value * 100) / 100;
			const text = new Intl.NumberFormat("en-US", {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			}).format(Math.abs(cents));
			return (cents < 0 ? "-" : "") + symbol + text;
		}
		/**
		* @param currency - wallet currency code.
		* @returns the symbol Platform Web uses for it.
		*/
		function currencySymbol(currency) {
			if (currency === "CNY") return "¥";
			if (currency === "USD") return "$";
			return String(currency ?? "") + " ";
		}
		/**
		* @param wallets - wallet rows from the account balance.
		* @returns all amounts, one per currency, joined for a single line.
		*/
		function formatWallets(wallets) {
			if (!Array.isArray(wallets) || wallets.length === 0) return formatAmount("0", "¥");
			return wallets.map((wallet) => formatAmount(wallet?.balance, currencySymbol(wallet?.currency))).join(" · ");
		}
		/** @returns positive bonus wallets only; Platform omits zero-bonus rows. */
		function positiveBonusWallets(wallets) {
			if (!Array.isArray(wallets)) return [];
			return wallets.filter((wallet) => Number(wallet?.balance) > 0);
		}
		const compactFormats = new Map();
		/**
		* @param tag - BCP 47 locale.
		* @returns a memoized compact number formatter.
		*/
		function compactFormat(tag) {
			let format = compactFormats.get(tag);
			if (format === undefined) {
				format = new Intl.NumberFormat(tag, {
					notation: "compact",
					maximumFractionDigits: 1
				});
				compactFormats.set(tag, format);
			}
			return format;
		}
		/**
		* @param value - token count.
		* @param tag - BCP 47 locale.
		* @returns compact text such as `1.7亿`, `174M`, or `—`.
		*/
		function compactNumber(value, tag) {
			const count = Number(value);
			if (!Number.isFinite(count)) return "—";
			if (count === 0) return "0";
			return compactFormat(tag).format(count);
		}
		/**
		* @param today - today's total.
		* @param yesterday - yesterday's total.
		* @returns percentage change, or null when no comparison is meaningful.
		*/
		function percentDelta(today, yesterday) {
			const current = Number(today);
			const previous = Number(yesterday);
			if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
			const delta = (current - previous) / previous * 100;
			return Number.isFinite(delta) ? delta : null;
		}
		/**
		* @param delta - percentage change.
		* @returns signed percent text, `±0%` when it rounds to nothing.
		*/
		function formatPercent(delta) {
			const value = Number(delta);
			if (!Number.isFinite(value)) return "—";
			if (Math.abs(value) < 0.1) return "±0%";
			const digits = Math.abs(value) >= 100 ? 0 : 1;
			return (value > 0 ? "+" : "-") + Math.abs(value).toFixed(digits) + "%";
		}
		/**
		* @param value - bar value.
		* @param max - tallest value in the series.
		* @param height - chart height in pixels.
		* @returns a visible bar height; zero stays flat.
		*/
		function barHeight(value, max, height) {
			const current = Number(value);
			const ceiling = Number(max);
			if (!Number.isFinite(current) || current <= 0 || !Number.isFinite(ceiling) || ceiling <= 0) return 0;
			return Math.max(2, Math.round(current / ceiling * height));
		}
		/**
		* @param date - `YYYY-MM-DD`.
		* @returns `MM-DD`, or the input when it does not match.
		*/
		function shortDate(date) {
			return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(5) : String(date ?? "");
		}
		/**
		* @param date - `YYYY-MM-DD`.
		* @returns the same calendar day at UTC midnight.
		*/
		function parseIsoDate(date) {
			return new Date(String(date) + "T00:00:00Z");
		}
		/**
		* @param date - UTC-midnight date.
		* @returns `YYYY-MM-DD`.
		*/
		function isoDate(date) {
			return date.toISOString().slice(0, 10);
		}
		/**
		* @param date - UTC-midnight date.
		* @param days - signed day count.
		* @returns the shifted date.
		*/
		function addDays(date, days) {
			return new Date(date.getTime() + days * 86400000);
		}
		/**
		* @param date - UTC-midnight date.
		* @returns ISO weekday, Monday 1 through Sunday 7.
		*/
		function isoWeekday(date) {
			const day = date.getUTCDay();
			return day === 0 ? 7 : day;
		}
		/**
		* Build the 53-week calendar grid ending with the Host's local "today".
		* Columns are weeks (Monday first); each column holds seven day cells.
		* @param data - Host usage payload.
		* @returns `[{ start, cells }]` where a cell is a day entry or null.
		*/
		function buildCalendar(data) {
			const todayDate = typeof data?.today?.date === "string" ? parseIsoDate(data.today.date) : null;
			if (todayDate === null || Number.isNaN(todayDate.getTime())) return [];
			const byDate = new Map();
			for (const entry of Array.isArray(data?.days) ? data.days : []) {
				if (entry !== null && typeof entry === "object" && typeof entry.date === "string") byDate.set(entry.date, entry);
			}
			const currentMonday = addDays(todayDate, -(isoWeekday(todayDate) - 1));
			const gridStart = addDays(currentMonday, -(CALENDAR_WEEKS - 1) * 7);
			const weeks = [];
			for (let column = 0; column < CALENDAR_WEEKS; column += 1) {
				const cells = [];
				for (let row = 0; row < 7; row += 1) {
					const cellDate = addDays(gridStart, column * 7 + row);
					if (cellDate.getTime() > todayDate.getTime()) {
						cells.push(null);
						continue;
					}
					const key = isoDate(cellDate);
					cells.push(byDate.get(key) ?? {
						date: key,
						input: 0,
						output: 0,
						cacheRead: 0,
						cacheWrite: 0,
						total: 0,
						requests: 0,
						sessions: 0
					});
				}
				weeks.push({
					start: isoDate(addDays(gridStart, column * 7)),
					cells
				});
			}
			return weeks;
		}
		/**
		* Resolve each cell's heat value for the active mode.
		* @param weeks - grid from {@link buildCalendar}.
		* @param mode - `day`, `week`, or `cumulative`.
		* @returns per-column values plus each column's own total.
		*/
		function calendarMetric(weeks, mode) {
			const weekTotals = weeks.map((week) => week.cells.reduce((sum, cell) => sum + (cell === null ? 0 : Number(cell.total) || 0), 0));
			let running = 0;
			const values = weeks.map((week, column) => week.cells.map((cell) => {
				if (cell === null) return null;
				const total = Number(cell.total) || 0;
				if (mode === "week") return weekTotals[column];
				if (mode === "cumulative") {
					running += total;
					return running;
				}
				return total;
			}));
			return {
				values,
				weekTotals
			};
		}
		/**
		* Quartile thresholds over the positive heat values.
		* @param values - flattened cell values.
		* @returns three ascending thresholds, or null when nothing is nonzero.
		*/
		function levelThresholds(values) {
			const positive = values.filter((value) => Number.isFinite(value) && value > 0).sort((left, right) => left - right);
			if (positive.length === 0) return null;
			const at = (share) => positive[Math.min(positive.length - 1, Math.floor((positive.length - 1) * share))];
			return [at(0.25), at(0.5), at(0.75)];
		}
		/**
		* @param value - cell heat value.
		* @param thresholds - from {@link levelThresholds}.
		* @returns heat level 0 through 4.
		*/
		function levelOf(value, thresholds) {
			if (thresholds === null || !Number.isFinite(value) || value <= 0) return 0;
			if (value <= thresholds[0]) return 1;
			if (value <= thresholds[1]) return 2;
			if (value <= thresholds[2]) return 3;
			return 4;
		}
		/**
		* Month labels for the calendar's bottom axis, one per month boundary.
		* @param weeks - grid from {@link buildCalendar}.
		* @param tag - BCP 47 locale.
		* @returns `[{ column, label }]`.
		*/
		function calendarMonths(weeks, tag) {
			const format = new Intl.DateTimeFormat(tag, {
				month: "short",
				timeZone: "UTC"
			});
			const labels = [];
			let previousMonth = null;
			let lastColumn = -10;
			weeks.forEach((week, column) => {
				week.cells.forEach((cell) => {
					if (cell === null) return;
					const month = cell.date.slice(0, 7);
					if (previousMonth === null) {
						previousMonth = month;
						return;
					}
					if (month === previousMonth) return;
					previousMonth = month;
					// A boundary one or two columns after the previous label would collide.
					if (column - lastColumn < 3) return;
					labels.push({
						column,
						label: format.format(parseIsoDate(cell.date))
					});
					lastColumn = column;
				});
			});
			return labels;
		}
		/**
		* @param ctx - client plugin context.
		* @returns the BCP 47 tag for the active language.
		*/
		function localeTag(ctx) {
			return ctx.locale.getSnapshot().active === "zh" ? "zh-CN" : "en-US";
		}
		/** @returns a zeroed usage bucket. */
		function zeroUsage() {
			return {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				total: 0,
				requests: 0,
				sessions: 0
			};
		}
		/**
		* @param usage - a usage bucket from the Host payload.
		* @returns the same shape with numeric fields filled in.
		*/
		function usageBucket(usage) {
			if (usage === null || typeof usage !== "object") return zeroUsage();
			return {
				input: Number(usage.input) || 0,
				output: Number(usage.output) || 0,
				cacheRead: Number(usage.cacheRead) || 0,
				cacheWrite: Number(usage.cacheWrite) || 0,
				total: Number(usage.total) || 0,
				requests: Number(usage.requests) || 0,
				sessions: Number(usage.sessions) || 0
			};
		}
		/**
		* Build the request identity one account call carries.
		* @param ctx - client plugin context.
		* @returns version, active language, and UTC offset in seconds.
		*/
		function accountMetadata(ctx) {
			const boot = typeof window !== "undefined" ? window.__DSH_BOOT__ : void 0;
			const version = boot && boot.release && typeof boot.release.version === "string" ? boot.release.version : "0.0.0";
			const snapshot = ctx.locale.getSnapshot();
			return {
				version,
				locale: snapshot.active,
				timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60
			};
		}
		/**
		* The bottom-pinned balance row.
		* @param props - slot props plus this plugin's context and translator.
		* @returns the row, or nothing on the collapsed rail.
		*/
		function BalanceRow({ ctx, t, wide }) {
			const [view, setView] = React.useState({
				phase: "loading",
				wallets: [],
				bonusWallets: [],
				at: 0
			});
			const [signedIn, setSignedIn] = React.useState(null);
			const [, setLocaleRevision] = React.useState(0);
			const alive = React.useRef(true);
			const sequence = React.useRef(0);
			const signedInRef = React.useRef(signedIn);
			signedInRef.current = signedIn;
			const read = React.useCallback(() => {
				const run = ++sequence.current;
				const publish = (next) => {
					if (alive.current && run === sequence.current) setView(next);
				};
				Promise.resolve()
					.then(() => ctx.remote.account.getBalance(accountMetadata(ctx)))
					.then((result) => {
						if (!result || !result.ok) {
							publish({
								phase: signedInRef.current === false ? "signed-out" : "failed",
								wallets: [],
								bonusWallets: [],
								at: 0
							});
							return;
						}
						const balance = result.value ?? {};
						if (balance.status !== "ready") {
							publish({
								phase: "failed",
								wallets: [],
								bonusWallets: [],
								at: 0
							});
							return;
						}
						publish({
							phase: "ready",
							wallets: Array.isArray(balance.value) ? balance.value : [],
							bonusWallets: Array.isArray(balance.bonusWallets) ? balance.bonusWallets : [],
							at: Date.now()
						});
						if (signedInRef.current === null) setSignedIn(true);
					})
					.catch(() => {
						publish({
							phase: signedInRef.current === false ? "signed-out" : "failed",
							wallets: [],
							bonusWallets: [],
							at: 0
						});
					});
			}, [ctx]);
			// Follow the account state stream: it names sign-in/sign-out and asks for a fresh read on every frame.
			React.useEffect(() => {
				alive.current = true;
				let disposed = false;
				let stream;
				try {
					stream = ctx.remote.$stream({
						name: "account",
						open: (signal) => ctx.remote.account.watch(signal),
						ended: () => new Error("account stream ended")
					});
				} catch (_error) {
					return () => {
						alive.current = false;
					};
				}
				(async () => {
					try {
						for await (const frame of stream) {
							if (disposed) break;
							const status = frame?.value?.status;
							setSignedIn(status === "credential-stored");
							if (status === "credential-stored") read();
							try {
								frame.accept();
							} catch (_error) {}
						}
					} catch (_error) {}
				})();
				return () => {
					disposed = true;
					alive.current = false;
					try {
						stream.dispose();
					} catch (_error) {}
				};
			}, [read]);
			// Poll while visible; re-read on focus and on returning to the page.
			React.useEffect(() => {
				read();
				const timer = window.setInterval(() => {
					// The account stream triggers a read when a credential appears, so a signed-out page stays quiet.
					if (signedInRef.current === false) return;
					if (document.visibilityState !== "hidden") read();
				}, POLL_MS);
				const onVisible = () => {
					if (document.visibilityState === "visible") read();
				};
				document.addEventListener("visibilitychange", onVisible);
				window.addEventListener("focus", onVisible);
				return () => {
					window.clearInterval(timer);
					document.removeEventListener("visibilitychange", onVisible);
					window.removeEventListener("focus", onVisible);
				};
			}, [read]);
			// Re-render with the active language without re-reading the balance.
			React.useEffect(() => ctx.locale.subscribe(() => setLocaleRevision((value) => value + 1)), [ctx]);
			if (!wide) return null;
			const phase = signedIn === false ? "signed-out" : view.phase;
			const bonusWallets = phase === "ready" ? positiveBonusWallets(view.bonusWallets) : [];
			let amount;
			if (phase === "signed-out") amount = t("signedOut");
			else if (phase === "failed") amount = t("retry");
			else if (phase === "loading") amount = t("loading");
			else amount = formatWallets(view.wallets);
			const lines = [];
			if (phase === "ready") {
				lines.push(t("recharge") + ": " + formatWallets(view.wallets));
				if (bonusWallets.length > 0) lines.push(t("bonus") + ": " + formatWallets(bonusWallets));
				if (view.at > 0) lines.push(t("updated") + " " + new Date(view.at).toLocaleTimeString(ctx.locale.getSnapshot().active === "zh" ? "zh-CN" : "en-US", { hour12: false }));
			} else if (phase === "signed-out") lines.push(t("signedOutHint"));
			else if (phase === "failed") lines.push(t("failed"));
			lines.push(t("refresh"));
			const title = lines.join("\n");
			return React.createElement("button", {
				type: "button",
				className: "dsb_row",
				title,
				"aria-label": t("label") + ": " + amount,
				"data-balance-phase": phase,
				onClick: () => read()
			}, React.createElement("span", { className: "dsb_label" }, t("label")), React.createElement("span", { className: "dsb_amounts" }, React.createElement("span", {
				className: "dsb_value",
				"data-phase": phase
			}, amount), bonusWallets.length > 0 ? React.createElement("span", { className: "dsb_bonus" }, "+" + formatWallets(bonusWallets)) : null));
		}
		/**
		* Inline SVG icon.
		* @param props - viewBox, size, and child paths.
		* @returns the svg element.
		*/
		function Icon({ viewBox, size, children }) {
			return React.createElement("svg", {
				viewBox,
				width: size,
				height: size,
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.4,
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				focusable: "false"
			}, children);
		}
		const MODE_STORAGE_KEY = "dsh-balance/usage-mode";
		/**
		* @returns the remembered calendar mode, or `day`.
		*/
		function rememberedMode() {
			try {
				const stored = typeof window !== "undefined" && window.localStorage !== void 0 ? window.localStorage.getItem(MODE_STORAGE_KEY) : null;
				if (stored === "week" || stored === "cumulative") return stored;
			} catch (_error) {}
			return "day";
		}
		/**
		* @param mode - calendar mode to remember.
		*/
		function rememberMode(mode) {
			try {
				if (typeof window !== "undefined" && window.localStorage !== void 0) window.localStorage.setItem(MODE_STORAGE_KEY, mode);
			} catch (_error) {}
		}
		/**
		* @returns the remembered usage source, or `local`.
		*/
		function rememberedSource() {
			try {
				const stored = typeof window !== "undefined" && window.localStorage !== void 0 ? window.localStorage.getItem(SOURCE_STORAGE_KEY) : null;
				if (stored === "account") return stored;
			} catch (_error) {}
			return "local";
		}
		/**
		* @param source - usage source to remember.
		*/
		function rememberSource(source) {
			try {
				if (typeof window !== "undefined" && window.localStorage !== void 0) window.localStorage.setItem(SOURCE_STORAGE_KEY, source);
			} catch (_error) {}
		}
		const moneyFormats = new Map();
		/**
		* @param value - amount in the platform currency.
		* @param currency - ISO currency code.
		* @param tag - BCP 47 locale.
		* @returns `¥12.34`, `$12.34`, or `—`.
		*/
		function formatMoney(value, currency, tag) {
			const amount = Number(value);
			if (!Number.isFinite(amount)) return "—";
			let format = moneyFormats.get(tag);
			if (format === undefined) {
				format = new Intl.NumberFormat(tag, {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2
				});
				moneyFormats.set(tag, format);
			}
			const symbol = currency === "USD" ? "$" : currency === "CNY" ? "¥" : String(currency ?? "") + " ";
			return symbol + format.format(amount);
		}
		/**
		* @param reason - account failure reason from the Host.
		* @param t - translator.
		* @returns the message to show.
		*/
		function accountFailureText(reason, t) {
			if (reason === "missing") return t("usageAccountMissing");
			if (reason === "auth") return t("usageAccountAuth");
			return t("usageAccountNetwork");
		}
		/**
		* The token-activity panel: a 53-week contribution graph plus today's hour
		* strip and numeric breakdown. Anchored above its row and portaled to
		* `document.body` when a portal renderer is available.
		* @param props - payload, translator, locale tag, anchor ref, and callbacks.
		* @returns the floating panel.
		*/
		function UsagePanel({ t, tag, data, source, phase, reason, anchorRef, onClose, onRefresh, onSourceChange, busy, error }) {
			const panelRef = React.useRef(null);
			const [pos, setPos] = React.useState(null);
			const [mode, setMode] = React.useState(rememberedMode);
			const [hover, setHover] = React.useState(null);
			const [hoverHour, setHoverHour] = React.useState(null);
			// Place above the row, clamped into the viewport; re-place on resize,
			// scroll, and any panel size change (data arrival, locale switch).
			React.useLayoutEffect(() => {
				const place = () => {
					const anchor = anchorRef.current;
					const panel = panelRef.current;
					if (anchor === null || panel === null || typeof window === "undefined") return;
					const anchorRect = anchor.getBoundingClientRect();
					const width = panel.offsetWidth || 680;
					const height = panel.offsetHeight || 380;
					const maxHeight = Math.max(180, anchorRect.top - PANEL_GAP - PANEL_MARGIN);
					const visibleHeight = Math.min(height, maxHeight);
					const maxLeft = Math.max(PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN);
					const left = Math.min(Math.max(anchorRect.left, PANEL_MARGIN), maxLeft);
					const top = Math.max(PANEL_MARGIN, anchorRect.top - PANEL_GAP - visibleHeight);
					setPos({
						left,
						top,
						maxHeight
					});
				};
				place();
				let observer = null;
				if (typeof ResizeObserver === "function") {
					observer = new ResizeObserver(place);
					if (panelRef.current !== null) observer.observe(panelRef.current);
					// A sidebar drag resizes the row without a window resize event.
					if (anchorRef.current !== null) observer.observe(anchorRef.current);
				}
				window.addEventListener("resize", place);
				window.addEventListener("scroll", place, true);
				return () => {
					if (observer !== null) observer.disconnect();
					window.removeEventListener("resize", place);
					window.removeEventListener("scroll", place, true);
				};
			}, [anchorRef, data, mode]);
			// Dismiss on Escape and on any pointer press outside the panel and row.
			React.useEffect(() => {
				const onKeyDown = (event) => {
					if (event.key === "Escape") onClose();
				};
				const onPointerDown = (event) => {
					const target = event.target;
					if (!(target instanceof Node)) return;
					if (panelRef.current?.contains(target) === true) return;
					if (anchorRef.current?.contains(target) === true) return;
					onClose();
				};
				document.addEventListener("keydown", onKeyDown);
				document.addEventListener("pointerdown", onPointerDown, true);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
					document.removeEventListener("pointerdown", onPointerDown, true);
				};
			}, [anchorRef, onClose]);
			const chooseMode = (next) => {
				setHover(null);
				setMode(next);
				rememberMode(next);
			};
			const today = usageBucket(data?.today);
			const yesterday = usageBucket(data?.yesterday);
			const week = usageBucket(data?.week);
			const month = usageBucket(data?.month);
			const all = usageBucket(data?.total);
			const hours = Array.isArray(data?.hours) ? data.hours : [];
			const hourMax = Math.max(1, ...hours.map((entry) => Number(entry?.total) || 0));
			const hourSum = hours.reduce((sum, entry) => sum + (Number(entry?.total) || 0), 0);
			const delta = percentDelta(today.total, yesterday.total);
			const weeks = buildCalendar(data);
			const metric = calendarMetric(weeks, mode);
			const thresholds = levelThresholds(metric.values.flat());
			const months = calendarMonths(weeks, tag);
			const dayRangeTotal = metric.values.flat().reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
			const rangeTotal = dayRangeTotal;
			const hoveredValue = hover === null ? null : hover.value;
			const captionLabel = hover === null ? t("usageLastMonths") : hover.label;
			const captionValue = compactNumber(hover === null ? rangeTotal : hoveredValue, tag);
			const captionMeta = hover === null ? t("usageSum") : t("usageRequests", { count: hover.requests });
			const cellNodes = [];
			weeks.forEach((weekEntry, column) => {
				weekEntry.cells.forEach((cell, row) => {
					if (cell === null) {
						cellNodes.push(React.createElement("div", {
							className: "dsu_cell",
							key: "empty-" + column + "-" + row,
							"data-empty": "true"
						}));
						return;
					}
					const value = metric.values[column][row];
					const level = levelOf(value, thresholds);
					cellNodes.push(React.createElement("div", {
						className: "dsu_cell",
						key: cell.date,
						"data-level": level > 0 ? String(level) : void 0,
						title: cell.date + " · " + compactNumber(value, tag),
						onMouseEnter: () => setHover({
							label: cell.date,
							value,
							requests: Number(cell.requests) || 0
						}),
						onMouseLeave: () => setHover(null)
					}));
				});
			});
			const monthAxis = React.createElement("div", {
				className: "dsu_months",
				style: { gridTemplateColumns: "repeat(" + Math.max(weeks.length, 1) + ",1fr)" }
			}, months.map((entry) => React.createElement("span", {
				key: "month-" + entry.column,
				style: {
					gridColumn: String(entry.column + 1),
					justifySelf: entry.column >= weeks.length - 2 ? "end" : "start"
				}
			}, entry.label)));
			const legend = React.createElement("div", { className: "dsu_legend" }, React.createElement("span", null, t("usageLess")), [0, 1, 2, 3, 4].map((level) => React.createElement("i", {
				key: "swatch-" + level,
				className: "dsu_swatch",
				"data-level": level > 0 ? String(level) : void 0
			})), React.createElement("span", null, t("usageMore")));
			const modeButtons = [
				["day", t("usageModeDay")],
				["week", t("usageModeWeek")],
				["cumulative", t("usageModeTotal")]
			].map(([value, label]) => React.createElement("button", {
				type: "button",
				key: value,
				className: "dsu_mode",
				"data-active": mode === value ? "true" : "false",
				"aria-pressed": mode === value,
				onClick: () => chooseMode(value)
			}, label));
			const hourBars = hours.map((entry, index) => React.createElement("div", {
				className: "dsu_col",
				key: "hour-" + String(entry?.hour ?? index),
				title: String(Number(entry?.hour) || 0).padStart(2, "0") + ":00 · " + compactNumber(entry?.total, tag),
				onMouseEnter: () => setHoverHour({
					label: String(Number(entry?.hour) || 0).padStart(2, "0") + ":00",
					value: Number(entry?.total) || 0,
					requests: Number(entry?.requests) || 0
				}),
				onMouseLeave: () => setHoverHour(null)
			}, React.createElement("div", {
				className: "dsu_bar",
				"data-peak": Number(entry?.total) === hourMax && hourMax > 1 ? "true" : void 0,
				style: { height: barHeight(entry?.total, hourMax, HOUR_CHART_HEIGHT) + "px" }
			})));
			const stat = (label, value) => React.createElement("div", {
				className: "dsu_pair",
				key: label
			}, React.createElement("span", null, label), React.createElement("b", null, value));
			const accountCell = (key, label, value, emphasis) => React.createElement("div", {
				className: "dsu_accountCell",
				key,
				"data-emphasis": emphasis === true ? "true" : void 0
			}, React.createElement("span", null, label), React.createElement("b", null, value));
			const hasData = data !== null && typeof data === "object";
			const isAccount = source === "account" || data?.granularity === "day";
			const cost = data?.cost ?? {};
			const todayLabel = isAccount ? t("usageTodayUtc") : t("usageToday");
			const monthKey = typeof data?.today?.date === "string" ? data.today.date.slice(0, 7) : null;
			const calendarMonthTotal = monthKey === null || !Array.isArray(data?.days) ? 0 : data.days.reduce((sum, entry) => entry !== null && typeof entry?.date === "string" && entry.date.slice(0, 7) === monthKey ? sum + (Number(entry.total) || 0) : sum, 0);
			const sourceButtons = [["local", t("usageSourceLocal")], ["account", t("usageSourceAccount")]].map(([value, label]) => React.createElement("button", {
				type: "button",
				key: value,
				className: "dsu_mode",
				"data-active": source === value ? "true" : "false",
				"aria-pressed": source === value,
				onClick: () => onSourceChange(value)
			}, label));
			const localBody = React.createElement("div", {
				className: "dsu_body",
				key: "body"
			}, React.createElement("div", { className: "dsu_left" }, React.createElement("div", { className: "dsu_caption", style: { marginTop: "0" } }, React.createElement("span", null, hoverHour === null ? t("usageHours") : hoverHour.label), React.createElement("span", null, React.createElement("b", null, compactNumber(hoverHour === null ? hourSum : hoverHour.value, tag)), hoverHour === null ? "" : " · " + t("usageRequests", { count: hoverHour.requests }))), React.createElement("div", {
				className: "dsu_chart",
				style: { "--dsu-chart-height": HOUR_CHART_HEIGHT + "px" }
			}, hourBars), React.createElement("div", { className: "dsu_axis" }, React.createElement("span", null, "00"), React.createElement("span", null, "06"), React.createElement("span", null, "12"), React.createElement("span", null, "18"), React.createElement("span", null, "23"))), React.createElement("div", { className: "dsu_right" }, React.createElement("div", { className: "dsu_headline" }, React.createElement("span", { className: "dsu_big" }, compactNumber(today.total, tag)), React.createElement("span", { className: "dsu_unit" }, t("usageToday")), delta === null ? null : React.createElement("span", {
				className: "dsu_delta",
				"data-dir": delta > 0 ? "up" : delta < 0 ? "down" : "flat"
			}, formatPercent(delta))), React.createElement("div", { className: "dsu_grid" }, stat(t("usageInput"), compactNumber(today.input, tag)), stat(t("usageOutput"), compactNumber(today.output, tag)), stat(t("usageCacheRead"), compactNumber(today.cacheRead, tag)), stat(t("usageCacheWrite"), compactNumber(today.cacheWrite, tag)))));
			const accountBody = React.createElement("div", {
				className: "dsu_accountBody",
				key: "account"
			}, React.createElement("div", { className: "dsu_statGrid" }, accountCell("today", todayLabel, compactNumber(today.total, tag), true), accountCell("month", t("usageAccountMonth"), compactNumber(calendarMonthTotal, tag), true), accountCell("costToday", t("usageAccountCostToday"), formatMoney(cost.today, cost.currency, tag)), accountCell("costMonth", t("usageAccountCostMonth"), formatMoney(cost.month, cost.currency, tag)), accountCell("input", t("usageInput"), compactNumber(today.input, tag)), accountCell("output", t("usageOutput"), compactNumber(today.output, tag)), accountCell("cache", t("usageCacheRead"), compactNumber(today.cacheRead, tag)), accountCell("requests", t("usageRequestsLabel"), t("usageRequests", { count: today.requests }))), React.createElement("div", { className: "dsu_note", style: { marginTop: "0" } }, t("usageAccountNote") + (data?.partial === true ? " · " + t("usageAccountPartial") : "")));
			const footer = React.createElement("div", {
				className: "dsu_footer",
				key: "footer"
			}, isAccount ? null : React.createElement("span", null, t("usageRequestsLabel") + " ", React.createElement("b", null, t("usageRequests", { count: today.requests }))), isAccount ? null : React.createElement("span", null, t("usageSessionsLabel") + " ", React.createElement("b", null, t("usageSessions", { count: today.sessions }))), React.createElement("span", null, t("usageLast7") + " ", React.createElement("b", null, compactNumber(week.total, tag))), React.createElement("span", null, t("usageLast30") + " ", React.createElement("b", null, compactNumber(month.total, tag))), React.createElement("span", null, (isAccount ? t("usageLastMonths") : t("usageTotal")) + " ", React.createElement("b", null, compactNumber(isAccount ? rangeTotal : all.total, tag))));
			const showEmpty = hasData && all.total === 0 && data?.scanning !== true;
			const notes = [];
			if (hasData && error === true) notes.push(isAccount ? accountFailureText(reason, t) : t("usageRefreshFailed"));
			if (hasData && data?.scanning === true) notes.push(t("usageScanning"));
			const content = !hasData ? React.createElement("div", {
				className: "dsu_empty",
				key: "placeholder"
			}, phase === "failed" ? (isAccount ? accountFailureText(reason, t) : t("usageFailed")) : t("usageScanning")) : showEmpty ? React.createElement("div", {
				className: "dsu_empty",
				key: "empty"
			}, t("usageEmpty")) : [React.createElement("div", {
				className: "dsu_caption",
				key: "caption"
			}, React.createElement("span", null, captionLabel), React.createElement("span", null, React.createElement("b", null, captionValue), " · " + captionMeta)), React.createElement("div", {
				className: "dsu_calendar",
				key: "calendar",
				style: {
					gridTemplateColumns: "repeat(" + Math.max(weeks.length, 1) + ",1fr)",
					gridTemplateRows: "repeat(7,1fr)",
					aspectRatio: Math.max(weeks.length, 1) + " / 7"
				}
			}, cellNodes), monthAxis, React.createElement("div", {
				className: "dsu_legendRow",
				key: "legend"
			}, legend), isAccount ? accountBody : localBody, footer];
			return React.createElement("div", {
				ref: panelRef,
				className: "dsu_panel",
				role: "dialog",
				"aria-label": t("usageTitle"),
				style: pos === null ? {
					visibility: "hidden",
					left: 0,
					top: 0
				} : {
					left: pos.left,
					top: pos.top,
					maxHeight: pos.maxHeight
				}
			}, React.createElement("div", { className: "dsu_header" }, React.createElement("span", { className: "dsu_title" }, t("usageTitle")), React.createElement("div", {
				className: "dsu_modes",
				role: "group",
				"aria-label": t("usageTitle")
			}, sourceButtons), React.createElement("span", { className: "dsu_divider", "aria-hidden": "true" }), React.createElement("div", {
				className: "dsu_modes",
				role: "group",
				"aria-label": t("usageTitle")
			}, modeButtons), React.createElement("button", {
				type: "button",
				className: "dsu_icon",
				title: t("usageRefresh"),
				"aria-label": t("usageRefresh"),
				"data-busy": busy === true ? "true" : "false",
				onClick: onRefresh
			}, React.createElement(Icon, { viewBox: "0 0 16 16", size: 14 }, React.createElement("path", { d: "M13 8a5 5 0 1 1-1.46-3.54" }), React.createElement("path", { d: "M13 3.2v3.1H9.9" }))), React.createElement("button", {
				type: "button",
				className: "dsu_icon",
				title: t("usageClose"),
				"aria-label": t("usageClose"),
				onClick: onClose
			}, React.createElement(Icon, { viewBox: "0 0 16 16", size: 14 }, React.createElement("path", { d: "M4 4l8 8M12 4l-8 8" })))), content, notes.length === 0 ? null : React.createElement("div", { className: "dsu_note" }, notes.join(" · ")));
		}
		/**
		* The usage row. Its value is today's token total; clicking opens the panel.
		* @param props - slot props plus this plugin's context and translator.
		* @returns the row plus its portaled panel, or nothing on the collapsed rail.
		*/
		function UsageRow({ ctx, t, wide }) {
			const [source, setSource] = React.useState(rememberedSource);
			const [view, setView] = React.useState(() => ({
				phase: "loading",
				source: rememberedSource(),
				data: null,
				at: 0,
				error: false,
				reason: null
			}));
			const [open, setOpen] = React.useState(false);
			const [busy, setBusy] = React.useState(false);
			const [, setLocaleRevision] = React.useState(0);
			const rowRef = React.useRef(null);
			const alive = React.useRef(true);
			const sequence = React.useRef(0);
			const viewRef = React.useRef(view);
			viewRef.current = view;
			const sourceRef = React.useRef(source);
			sourceRef.current = source;
			const cacheRef = React.useRef({ local: null, account: null });
			const scanTries = React.useRef(0);
			const read = React.useCallback((requested) => {
				const next = requested === "account" || requested === "local" ? requested : sourceRef.current;
				const run = ++sequence.current;
				const publish = (nextView) => {
					if (!alive.current || run !== sequence.current) return;
					setBusy(false);
					setView(nextView);
				};
				if (alive.current) setBusy(true);
				const query = USAGE_ROUTE + "?days=" + USAGE_DAYS + "&offset=" + String(-new Date().getTimezoneOffset() * 60) + "&source=" + next;
				Promise.resolve()
					.then(() => fetch(query, {
						headers: { accept: "application/json" },
						cache: "no-store",
						credentials: "same-origin"
					}))
					.then(async (response) => {
						if (response !== null && typeof response === "object" && response.ok === true) return {
							ok: true,
							data: await response.json()
						};
						let reason = null;
						try {
							const body = await response.json();
							if (typeof body?.reason === "string") reason = body.reason;
						} catch (_error) {}
						return {
							ok: false,
							reason
						};
					})
					.then((result) => {
						if (result === null || typeof result !== "object" || result.ok !== true || result.data === null || typeof result.data !== "object") {
							const previous = viewRef.current;
							if (previous.source === next && previous.data !== null) publish({
								...previous,
								error: true,
								reason: result?.reason ?? null
							});
							else publish({
								phase: "failed",
								source: next,
								data: null,
								at: 0,
								error: true,
								reason: result?.reason ?? null
							});
							return;
						}
						const at = Date.now();
						// A stale Host build answers account requests with local data;
						// refuse to mislabel it instead of showing the wrong source.
						if (next === "account" && result.data.source !== "account") {
							publish({
								phase: "failed",
								source: next,
								data: null,
								at: 0,
								error: true,
								reason: "stale-host"
							});
							return;
						}
						cacheRef.current[next] = {
							data: result.data,
							at
						};
						publish({
							phase: "ready",
							source: next,
							data: result.data,
							at,
							error: false,
							reason: null
						});
					})
					.catch(() => {
						const previous = viewRef.current;
						if (previous.source === next && previous.data !== null) publish({
							...previous,
							error: true,
							reason: null
						});
						else publish({
							phase: "failed",
							source: next,
							data: null,
							at: 0,
							error: true,
							reason: null
						});
					});
			}, []);
			const chooseSource = React.useCallback((next) => {
				if (next !== "local" && next !== "account") return;
				if (next === sourceRef.current) return;
				setSource(next);
				rememberSource(next);
				const cached = cacheRef.current[next];
				if (cached !== null && cached !== undefined) setView({
					phase: "ready",
					source: next,
					data: cached.data,
					at: cached.at,
					error: false,
					reason: null
				});
				else setView({
					phase: "loading",
					source: next,
					data: null,
					at: 0,
					error: false,
					reason: null
				});
				read(next);
			}, [read]);
			// Poll while visible; re-read on focus and on returning to the page.
			React.useEffect(() => {
				alive.current = true;
				read();
				const timer = window.setInterval(() => {
					if (document.visibilityState !== "hidden") read();
				}, USAGE_POLL_MS);
				const onVisible = () => {
					if (document.visibilityState === "visible") read();
				};
				document.addEventListener("visibilitychange", onVisible);
				window.addEventListener("focus", onVisible);
				return () => {
					alive.current = false;
					window.clearInterval(timer);
					document.removeEventListener("visibilitychange", onVisible);
					window.removeEventListener("focus", onVisible);
				};
			}, [read]);
			// Refresh on open when the cached payload is old.
			React.useEffect(() => {
				if (!open) return;
				if (Date.now() - viewRef.current.at > 30000) read();
			}, [open, read]);
			// While the Host is still indexing history, poll quickly until it settles.
			React.useEffect(() => {
				if (view.data === null || view.data.scanning !== true) {
					scanTries.current = 0;
					return;
				}
				if (scanTries.current >= USAGE_SCAN_RETRIES) return;
				const timer = window.setTimeout(() => {
					scanTries.current += 1;
					read();
				}, USAGE_SCAN_RETRY_MS);
				return () => window.clearTimeout(timer);
			}, [view.data, read]);
			// Re-render with the active language without re-reading usage.
			React.useEffect(() => ctx.locale.subscribe(() => setLocaleRevision((value) => value + 1)), [ctx]);
			const close = React.useCallback(() => setOpen(false), []);
			if (!wide) return null;
			const tag = localeTag(ctx);
			const active = view.source === source;
			const phase = active ? view.phase : "loading";
			const data = active ? view.data : null;
			const today = usageBucket(data?.today);
			const isAccount = source === "account";
			const amount = phase === "ready" && data !== null ? compactNumber(today.total, tag) : phase === "failed" ? t("usageRetry") : t("loading");
			const lines = [];
			if (phase === "ready" && data !== null) {
				const todayLabel = data.dayBasis === "utc" ? t("usageTodayUtc") : t("usageToday");
				lines.push((isAccount ? t("usageSourceAccount") : t("usageSourceLocal")) + " · " + todayLabel + " " + compactNumber(today.total, tag));
				lines.push(t("usageInput") + " " + compactNumber(today.input, tag) + " · " + t("usageOutput") + " " + compactNumber(today.output, tag) + " · " + t("usageCacheRead") + " " + compactNumber(today.cacheRead, tag));
				lines.push(t("usageLast7") + " " + compactNumber(usageBucket(data.week).total, tag) + " · " + t("usageLast30") + " " + compactNumber(usageBucket(data.month).total, tag));
				if (data.scanning === true) lines.push(t("usageScanning"));
				else if (view.at > 0) lines.push(t("updated") + " " + new Date(view.at).toLocaleTimeString(tag, { hour12: false }));
				if (view.error === true) lines.push(isAccount ? accountFailureText(view.reason, t) : t("usageRefreshFailed"));
			} else if (phase === "failed") lines.push(isAccount ? accountFailureText(view.reason, t) : t("usageFailed"));
			else lines.push(t("usageScanning"));
			lines.push(t("usageHint"));
			const title = lines.join("\n");
			const onClick = () => {
				setOpen((value) => !value);
				if (phase === "failed") read(source);
			};
			const panel = open ? React.createElement(UsagePanel, {
				t,
				tag,
				data,
				phase,
				reason: view.reason,
				source,
				anchorRef: rowRef,
				onClose: close,
				onRefresh: () => read(source),
				onSourceChange: chooseSource,
				busy,
				error: active ? view.error : false
			}) : null;
			const panelNode = panel === null ? null : ReactDOM !== null && typeof ReactDOM.createPortal === "function" && typeof document !== "undefined" ? ReactDOM.createPortal(panel, document.body) : panel;
			return React.createElement(React.Fragment, null, React.createElement("button", {
				type: "button",
				ref: rowRef,
				className: "dsb_row",
				title,
				"aria-label": t("usageLabel") + ": " + amount,
				"aria-haspopup": "dialog",
				"aria-expanded": open,
				"data-usage-phase": phase,
				onClick
			}, React.createElement("span", { className: "dsb_label" }, t("usageLabel")), React.createElement("span", { className: "dsb_amounts" }, React.createElement("span", {
				className: "dsb_value",
				"data-phase": phase
			}, amount))), panelNode);
		}
		/**
		* Both footer rows in one slot entry: `sidebar.footer.action` is a row flex
		* container, so a single column wrapper keeps usage above balance on every
		* layout (including a future layout change in the sidebar).
		* @param props - slot props plus this plugin's context and translator.
		* @returns the stacked rows, or nothing on the collapsed rail.
		*/
		function SidebarRows({ ctx, t, wide }) {
			if (!wide) return null;
			return React.createElement("div", { className: "dsb_rows" }, React.createElement(UsageRow, {
				ctx,
				t,
				wide
			}), React.createElement(BalanceRow, {
				ctx,
				t,
				wide
			}));
		}
		/** Services required by the sidebar rows. */
		const inject = ["slots", "locale", "remote", "remote.account"];
		/**
		* Register the usage and balance rows into the sidebar's footer list seat.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "balance: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.slots.inject(SLOT, () => ctx.slots.register({
				name: SLOT,
				id: "balance",
				order: 100
			}, (props) => React.createElement(SidebarRows, {
				...props,
				ctx,
				t
			})));
		}
		exports.apply = apply;
		exports.inject = inject;
		// Formatting helpers exposed for offline checks only; nothing imports this member at runtime.
		exports.__test = {
			formatAmount,
			formatWallets,
			positiveBonusWallets,
			compactNumber,
			percentDelta,
			formatPercent,
			barHeight,
			shortDate,
			usageBucket,
			buildCalendar,
			calendarMetric,
			levelThresholds,
			levelOf,
			calendarMonths,
			formatMoney,
			accountFailureText,
			UsagePanel
		};
		return module.exports;
	}
});
