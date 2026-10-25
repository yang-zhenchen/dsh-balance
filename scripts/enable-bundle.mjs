// Safely add this plugin to a DSH profile: a link dependency plus the bundle
// selection, written as 2-space JSON without a BOM. The script only edits the
// profile manifest; run `pnpm install` in the profile afterwards.
//
// Usage:
//   node scripts/enable-bundle.mjs
//   node scripts/enable-bundle.mjs --profile desktop
//   node scripts/enable-bundle.mjs --profile C:\path\to\profile
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function resolveProfileDir(argv) {
  const at = argv.indexOf('--profile');
  const value = at >= 0 ? argv[at + 1] : 'desktop';
  if (!value) fail('--profile 需要一个值（profile 名称或目录）');
  if (path.isAbsolute(value) || value.includes('/') || value.includes('\\')) return path.resolve(value);
  const home = process.env.DSH_HOME ? path.resolve(process.env.DSH_HOME) : path.join(os.homedir(), '.dsh');
  return path.join(home, 'profiles', value);
}

const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profileDir = resolveProfileDir(process.argv.slice(2));
const file = path.join(profileDir, 'package.json');
if (!fs.existsSync(file)) fail(`找不到 profile manifest：${file}`);

const raw = fs.readFileSync(file);
let text = raw.toString('utf8').replace(/^\uFEFF/u, '');
let manifest;
try {
  manifest = JSON.parse(text);
} catch (error) {
  fail(`没有修改：${file} 不是合法 JSON\n${error.message}\n如果开头有 BOM，先运行 node scripts/repair-profile.mjs`);
}
if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
  fail(`没有修改：${file} 顶层必须是 JSON 对象`);
}

const spec = `link:${pluginDir.replaceAll('\\', '/')}`;
manifest.dependencies = manifest.dependencies ?? {};
manifest.dependencies['dsh-plugin-balance'] = spec;
manifest.dsh = manifest.dsh ?? {};
manifest.dsh.profile = manifest.dsh.profile ?? {};
manifest.dsh.profile.bundles = Array.isArray(manifest.dsh.profile.bundles) ? manifest.dsh.profile.bundles : [];
if (!manifest.dsh.profile.bundles.includes('dsh-plugin-balance')) {
  manifest.dsh.profile.bundles.push('dsh-plugin-balance');
}

const backup = `${file}.bak-${Date.now()}`;
fs.copyFileSync(file, backup);
fs.writeFileSync(file, `${JSON.stringify(manifest, void 0, 2)}\n`, 'utf8');
console.log(`已写入：${file}`);
console.log(`依赖：dsh-plugin-balance => ${spec}`);
console.log(`bundle：dsh-plugin-balance`);
console.log(`备份：${backup}`);
console.log(`下一步：cd "${profileDir}" 然后运行 pnpm install`);
