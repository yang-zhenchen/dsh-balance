window.__ModuleLoader__.load({
	id: "dsh-plugin-balance",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var React = require("react");
		/** Dictionary namespace owned by this plugin. */
		const NS = "balance";
		/** Sidebar seat rendered directly above the account/avatar row. */
		const SLOT = "sidebar.footer.action";
		/** Balance poll interval while the page is visible. */
		const POLL_MS = 15000;
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
			signedOutHint: "登录 DeepSeek 账号后可查看余额"
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
			signedOutHint: "Sign in to your DeepSeek account to see your balance"
		};
		const styleText = [
			".dsb_row{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;height:30px;box-sizing:border-box;padding:0 8px;border:0;border-radius:var(--dsw-radius-md);background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:18px;text-align:left;cursor:pointer;-webkit-app-region:no-drag}",
			".dsb_row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsb_row:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}",
			".dsb_label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dsb_amounts{flex:0 0 auto;display:flex;align-items:baseline;gap:5px;white-space:nowrap;font-variant-numeric:tabular-nums}",
			".dsb_value{color:var(--dsw-alias-label-primary);font-weight:500}",
			".dsb_value[data-phase=loading],.dsb_value[data-phase=failed],.dsb_value[data-phase=signed-out]{color:var(--dsw-alias-label-tertiary);font-weight:400}",
			".dsb_bonus{color:var(--dsw-alias-label-tertiary);font-size:11px}"
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
		/** Services required by the balance row. */
		const inject = ["slots", "locale", "remote", "remote.account"];
		/**
		* Register the balance row into the sidebar's footer list seat.
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
			}, (props) => React.createElement(BalanceRow, {
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
			positiveBonusWallets
		};
		return module.exports;
	}
});
