// Offline smoke test for dsh-plugin-balance: evaluates the browser bundle with a
// fake module loader / React and asserts the slot registration and render output.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert';

const source = fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

let registration;
const ctx = {
  effect: (fn) => fn(),
  locale: {
    register() {},
    bind: () => (key) => ({
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
      registration = { options, component };
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
  createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useRef: (value) => ({ current: value }),
  useCallback: (fn) => fn,
  useEffect: () => {},
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
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'client.js' });

const definition = sandbox.__definition;
assert.equal(definition.id, 'dsh-plugin-balance');

const exportsObject = definition.factory((specifier) => {
  assert.equal(specifier, 'react');
  return React;
});

assert.equal(typeof exportsObject.apply, 'function');
assert.deepEqual([...exportsObject.inject], ['slots', 'locale', 'remote', 'remote.account']);

exportsObject.apply(ctx);
assert.equal(registration.options.name, 'sidebar.footer.action');
assert.equal(registration.options.id, 'balance');
assert.equal(registration.options.order, 100);

const outer = registration.component({ wide: true });
const element = outer.type(outer.props);
assert.equal(element.type, 'button');
assert.equal(element.props['data-balance-phase'], 'loading');
assert.equal(element.children[0].children[0], '余额');
assert.equal(element.children[1].children[0].children[0], '—');

const collapsed = registration.component({ wide: false });
assert.equal(collapsed.type(collapsed.props), null);

const { formatAmount, formatWallets, positiveBonusWallets } = exportsObject.__test;
assert.equal(formatAmount('12.345', '¥'), '¥12.34');
assert.equal(formatAmount('0.004', '¥'), '<¥0.01');
assert.equal(formatAmount('-0.004', '¥'), '-¥0.01');
assert.equal(formatAmount('1234.5', '$'), '$1,234.50');
assert.equal(formatAmount('-2.345', '¥'), '-¥2.35');
assert.equal(formatWallets([{ balance: '9.9', currency: 'CNY' }]), '¥9.90');
assert.equal(formatWallets([{ balance: '1', currency: 'CNY' }, { balance: '2', currency: 'USD' }]), '¥1.00 · $2.00');
assert.equal(formatWallets([]), '¥0.00');
assert.equal(positiveBonusWallets([{ balance: '0', currency: 'CNY' }, { balance: '3', currency: 'CNY' }]).length, 1);

console.log('smoke test: ok');
