// Repair a DSH profile manifest that was saved as UTF-8 with a BOM.
//
// DSH reads <profile>/package.json with JSON.parse, which rejects a leading
// U+FEFF. This script removes only that BOM, keeps the rest of the file
// byte-for-byte, validates the JSON first, and writes a backup.
//
// Usage:
//   node scripts/repair-profile.mjs
//   node scripts/repair-profile.mjs --profile desktop
//   node scripts/repair-profile.mjs --profile C:\path\to\profile
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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

const profileDir = resolveProfileDir(process.argv.slice(2));
const file = path.join(profileDir, 'package.json');
if (!fs.existsSync(file)) fail(`找不到 profile manifest：${file}`);

const raw = fs.readFileSync(file);
const hasBom = raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
let text = raw.toString('utf8');
if (hasBom) text = text.replace(/^\uFEFF/u, '');

let parsed;
try {
  parsed = JSON.parse(text);
} catch (error) {
  fail(`没有修改：${file} 不是合法 JSON\n${error.message}`);
}
if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
  fail(`没有修改：${file} 顶层必须是 JSON 对象`);
}

if (!hasBom) {
  console.log(`没有 BOM，无需修复：${file}`);
  process.exit(0);
}

const backup = `${file}.bak-${Date.now()}`;
fs.copyFileSync(file, backup);
fs.writeFileSync(file, text, 'utf8');
console.log(`已移除 BOM：${file}`);
console.log(`备份：${backup}`);
console.log('请重新启动 DeepSeek Harness。');
