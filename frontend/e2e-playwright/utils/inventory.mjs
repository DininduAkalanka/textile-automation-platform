import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = fileURLToPath(new URL('../../src/app/', import.meta.url));
const proxy = readFileSync(new URL('../../src/proxy.ts', import.meta.url), 'utf8');
const roles = ['guest', 'CUSTOMER', 'WORKER', 'MANAGER', 'ADMIN'];
const gates = [...proxy.matchAll(/\{ prefix: '([^']+)', allow: \[([^\]]+)\] \}/g)]
  .map(([, prefix, allowed]) => ({
    prefix,
    allowed: [...allowed.matchAll(/'([^']+)'/g)].map((match) => match[1]),
  }));
if (!gates.length) throw new Error('Cannot read route gates from src/proxy.ts');

const metadata = new Map([
  ['robots.ts', 'robots.txt'], ['sitemap.ts', 'sitemap.xml'],
  ['icon.svg', 'icon.svg'], ['apple-icon.png', 'apple-icon.png'],
]);

function* files(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else yield path;
  }
}

const rows = [];
for (const file of files(app)) {
  const segments = relative(app, file).split(sep);
  const name = segments.pop();
  if (!/^(page|route)\.[jt]sx?$/.test(name) && !metadata.has(name)) continue;
  const groups = segments.filter((segment) => segment.startsWith('('));
  const route = '/' + [
    ...segments.filter((segment) => !groups.includes(segment)),
    ...(metadata.has(name) ? [metadata.get(name)] : []),
  ].join('/');
  const gate = gates.find(({ prefix }) => route === prefix || route.startsWith(prefix + '/'));
  const access = roles.map((role) => !gate || gate.allowed.includes(role) ? 'Allow' : role === 'guest' ? 'Login' : 'Home');
  rows.push([route, groups.join('/') || '—', ...access]);
}
console.log('| Route | Route group | Guest | Customer | Worker | Manager | Admin |');
console.log('| --- | --- | --- | --- | --- | --- | --- |');
for (const [route, group, ...access] of rows.sort((a, b) => a[0].localeCompare(b[0], 'en'))) {
  console.log('| `' + route + '` | ' + group + ' | ' + access.join(' | ') + ' |');
}
