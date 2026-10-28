// Offline smoke test for dsh-plugin-balance: evaluates the browser bundle with a
// fake module loader / React and asserts the slot registrations and render output.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';

const source = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

const registrations = [];
let dictionaries;
const ctx = {
  effect: (fn) => fn(),
  locale: {
    register(namespace, value) {
      dictionaries = value;
    },
    bind: () => (key) =>
      ({
        label: '余额',
        bonus: '赠金',
        recharge: '充值余额',
        loading: '—',
        signedOut: '未登录',
        retry: '点击重试',
        refresh: '点击刷新余额',
        updated: '更新于',
        failed: '余额读取失败',
        signedOutHint: '登录 DeepSeek 账号后可查看余额',
        usageLabel: 'Token 用量',
      })[key] ?? key,
    getSnapshot: () => ({ active: 'zh', revision: 0 }),
    subscribe: () => () => {},
  },
  slots: {
    inject: (slot, factory) => {
      assert.equal(slot, 'sidebar.footer.action');
      return factory();
    },
    register: (options, component) => {
      registrations.push({ options, component });
      return () => {};
    },
  },
  remote: {
    account: {
      getBalance: async () => ({ ok: false }),
      watch: () => ({ dispose() {} }),
    },
    $stream: () => ({ dispose() {} }),
  },
};

const React = {
  Fragment: Symbol.for('react.fragment'),
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useRef: (value) => ({ current: value }),
  useCallback: (fn) => fn,
  useEffect: () => {},
  useLayoutEffect: () => {},
};

const sandbox = {
  window: { __ModuleLoader__: { load: (definition) => { sandbox.__definition = definition; } } },
  document: {
    visibilityState: 'visible',
    querySelector: () => null,
    createElement: () => ({ dataset: {}, appendChild() {} }),
    head: { appendChild() {} },
    addEventListener() {},
    removeEventListener() {},
  },
  Intl,
  Date,
  console,
  Symbol,
  Promise,
  Node: class Node {},
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'client.js' });

const definition = sandbox.__definition;
assert.equal(definition.id, 'dsh-plugin-balance');

const exportsObject = definition.factory((specifier) => {
  if (specifier === 'react') return React;
  if (specifier === 'react-dom') return { createPortal: (element) => element };
  throw new Error(`unexpected require: ${specifier}`);
});

assert.equal(typeof exportsObject.apply, 'function');
assert.deepEqual([...exportsObject.inject], ['slots', 'locale', 'remote', 'remote.account']);

exportsObject.apply(ctx);
assert.equal(registrations.length, 1, 'one slot entry holds both rows');
assert.deepEqual(Object.keys(dictionaries.zh), Object.keys(dictionaries.en), 'zh and en cover the same keys');
assert.equal(dictionaries.zh.usageLabel, 'Token 用量');
assert.equal(dictionaries.en.usageModeTotal, 'Cumulative');

const registration = registrations[0];
assert.equal(registration.options.name, 'sidebar.footer.action');
assert.equal(registration.options.id, 'balance');
assert.equal(registration.options.order, 100);

const outer = registration.component({ wide: true });
const container = outer.type(outer.props);
assert.equal(container.type, 'div');
assert.equal(container.props.className, 'dsb_rows');
assert.equal(container.children.length, 2, 'usage above balance');

const usageOuter = container.children[0];
const usageElement = usageOuter.type(usageOuter.props);
assert.equal(usageElement.type, React.Fragment);
const usageRow = usageElement.children[0];
assert.equal(usageRow.type, 'button');
assert.equal(usageRow.props['data-usage-phase'], 'loading');
assert.equal(usageRow.props['aria-haspopup'], 'dialog');
assert.equal(usageRow.props['aria-expanded'], false);
assert.equal(usageRow.children[0].children[0], 'Token 用量');
assert.equal(usageRow.children[1].children[0].children[0], '—');
assert.equal(usageElement.children[1], null, 'no panel before it is opened');

const balanceOuter = container.children[1];
const balanceElement = balanceOuter.type(balanceOuter.props);
assert.equal(balanceElement.type, 'button');
assert.equal(balanceElement.props['data-balance-phase'], 'loading');
assert.equal(balanceElement.children[0].children[0], '余额');
assert.equal(balanceElement.children[1].children[0].children[0], '—');

const collapsed = registration.component({ wide: false });
assert.equal(collapsed.type(collapsed.props), null);

// The account view swaps the hourly strip for the platform stats and cost.
const { UsagePanel, formatMoney, accountFailureText } = exportsObject.__test;
const fakeT = (key, params) => (params ? key + JSON.stringify(params) : key);
const collectText = (node) => {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(' ');
  if (typeof node.type === 'function') return collectText(node.type({ ...node.props, children: node.children }));
  return (node.children ?? []).map(collectText).join(' ');
};
const accountData = {
  source: 'account',
  granularity: 'day',
  dayBasis: 'utc',
  today: { date: '2026-10-28', total: 160, input: 20, output: 5, cacheRead: 100, cacheWrite: 0, requests: 3 },
  yesterday: { date: '2026-10-27', total: 55, input: 50, output: 5, cacheRead: 0, cacheWrite: 0, requests: 1 },
  days: [{ date: '2026-10-28', total: 160, input: 20, output: 5, cacheRead: 100, cacheWrite: 0, requests: 3 }],
  hours: [],
  week: { total: 215, requests: 4 },
  month: { total: 231, requests: 5 },
  total: { total: 237, requests: 6 },
  cost: { currency: 'CNY', today: 0.8, month: 2.8 },
  scanning: false,
  partial: false,
};
const accountPanel = UsagePanel({
  t: fakeT,
  tag: 'zh-CN',
  data: accountData,
  source: 'account',
  phase: 'ready',
  reason: null,
  anchorRef: { current: null },
  onClose() {},
  onRefresh() {},
  onSourceChange() {},
  busy: false,
  error: false,
});
const accountText = collectText(accountPanel);
assert.ok(accountText.includes('usageAccountMonth'), 'month cell is shown');
assert.ok(accountText.includes('usageAccountCostMonth'), 'cost cell is shown');
assert.ok(accountText.includes('¥2.80'), 'cost is formatted with the platform currency');
assert.ok(!accountText.includes('usageHours'), 'account data has no hourly strip');
assert.ok(accountText.includes('usageAccountNote'), 'the UTC day basis is disclosed');

const failedPanel = UsagePanel({
  t: fakeT,
  tag: 'zh-CN',
  data: null,
  source: 'account',
  phase: 'failed',
  reason: 'missing',
  anchorRef: { current: null },
  onClose() {},
  onRefresh() {},
  onSourceChange() {},
  busy: false,
  error: false,
});
assert.ok(collectText(failedPanel).includes('usageAccountMissing'), 'a missing grant explains itself');
assert.equal(formatMoney(12.3, 'CNY', 'en-US'), '¥12.30');
assert.equal(formatMoney(1, 'USD', 'en-US'), '$1.00');
assert.equal(formatMoney('x', 'CNY', 'en-US'), '—');
assert.equal(accountFailureText('auth', fakeT), 'usageAccountAuth');
assert.equal(accountFailureText('network', fakeT), 'usageAccountNetwork');
assert.equal(accountFailureText('missing', fakeT), 'usageAccountMissing');

const {
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
} = exportsObject.__test;
assert.equal(formatAmount('12.345', '¥'), '¥12.34');
assert.equal(formatAmount('0.004', '¥'), '<¥0.01');
assert.equal(formatAmount('-0.004', '¥'), '-¥0.01');
assert.equal(formatAmount('1234.5', '$'), '$1,234.50');
assert.equal(formatAmount('-2.345', '¥'), '-¥2.35');
assert.equal(formatWallets([{ balance: '9.9', currency: 'CNY' }]), '¥9.90');
assert.equal(formatWallets([{ balance: '1', currency: 'CNY' }, { balance: '2', currency: 'USD' }]), '¥1.00 · $2.00');
assert.equal(formatWallets([]), '¥0.00');
assert.equal(positiveBonusWallets([{ balance: '0', currency: 'CNY' }, { balance: '3', currency: 'CNY' }]).length, 1);

assert.equal(compactNumber(0, 'en-US'), '0');
assert.equal(compactNumber(999, 'en-US'), '999');
assert.equal(compactNumber(1234, 'en-US'), '1.2K');
assert.equal(compactNumber(174915731, 'zh-CN'), '1.7亿');
assert.equal(compactNumber(undefined, 'en-US'), '—');
assert.equal(percentDelta(150, 100), 50);
assert.equal(percentDelta(100, 0), null);
assert.equal(percentDelta(0, 0), null);
assert.equal(formatPercent(0.04), '±0%');
assert.equal(formatPercent(12.34), '+12.3%');
assert.equal(formatPercent(-100), '-100%');
assert.equal(barHeight(5, 10, 56), 28);
assert.equal(barHeight(0, 10, 56), 0);
assert.equal(barHeight(1, 1000, 56), 2);
assert.equal(shortDate('2026-10-28'), '10-28');
assert.deepEqual(usageBucket({ total: 5, input: '7' }), {
  input: 7,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  total: 5,
  requests: 0,
  sessions: 0,
});

// The calendar grid ends on the Host's local "today" and always spans 53 weeks.
{
  const grid = buildCalendar({ today: { date: '2026-10-28' }, days: [] });
  assert.equal(grid.length, 53);
  assert.equal(grid[0].start, '2025-10-27');
  assert.equal(grid[0].cells[0].date, '2025-10-27');
  assert.equal(grid.at(-1).start, '2026-10-26');
  assert.equal(grid.at(-1).cells[2].date, '2026-10-28');
  assert.equal(grid.at(-1).cells[3], null, 'days after today stay empty');
  assert.equal(buildCalendar({}).length, 0);
}

// Day, week, and cumulative views share one grid.
{
  const grid = buildCalendar({
    today: { date: '2026-10-28' },
    days: [
      { date: '2026-10-26', total: 10, requests: 1 },
      { date: '2026-10-27', total: 20, requests: 2 },
      { date: '2026-10-28', total: 30, requests: 3 },
    ],
  });
  const day = calendarMetric(grid, 'day');
  assert.equal(day.values.at(-1)[0], 10);
  assert.equal(day.values.at(-1)[2], 30);
  assert.equal(day.values.at(-1)[3], null);
  assert.equal(day.weekTotals.at(-1), 60);

  const week = calendarMetric(grid, 'week');
  assert.equal(week.weekTotals.at(-1), 60);
  assert.equal(week.values.at(-1)[0], 60);
  assert.equal(week.values.at(-1)[2], 60);

  const cumulative = calendarMetric(grid, 'cumulative');
  assert.equal(cumulative.values.at(-1)[0], 10);
  assert.equal(cumulative.values.at(-1)[1], 30);
  assert.equal(cumulative.values.at(-1)[2], 60);
  assert.equal(cumulative.values.at(-1)[3], null);

  const thresholds = levelThresholds([0, 0, 1, 2, 3, 4]);
  assert.deepEqual(thresholds, [1, 2, 3]);
  assert.equal(levelOf(0, thresholds), 0);
  assert.equal(levelOf(1, thresholds), 1);
  assert.equal(levelOf(3, thresholds), 3);
  assert.equal(levelOf(5, thresholds), 4);
  assert.equal(levelOf(5, null), 0);
  assert.equal(levelThresholds([0, 0]), null);

  const months = calendarMonths(grid, 'en-US');
  assert.equal(months[0].column, 0, 'the first month boundary lands in the first column');
  assert.equal(months[0].label, 'Nov');
  assert.ok(months.length >= 12, 'one label per month boundary');
  for (let index = 1; index < months.length; index += 1) {
    assert.ok(months[index].column - months[index - 1].column >= 3, 'labels never collide');
  }
}

console.log('smoke test: ok');
