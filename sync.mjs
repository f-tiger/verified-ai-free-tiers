#!/usr/bin/env node
// 每日从 baipiaoji.com 拉取最新已核实数据并重建 README；无变化则不产生提交。
// Every step below only rewrites a block it can find exactly. If a source is unreachable
// or an anchor is missing, that step is skipped with a warning and the rest still runs:
// a stale sentence is better than a crashed sync that stops the limits tables updating too.
import { readFileSync, writeFileSync } from 'node:fs';
const base = 'https://baipiaoji.com';
const warn = (m) => console.log('WARN:', m);
const getJson = async (url, init) => {
  try {
    const r = await fetch(url, init);
    if (!r.ok) { warn(`${url} -> HTTP ${r.status}`); return null; }
    return await r.json();
  } catch (e) { warn(`${url} -> ${e.message}`); return null; }
};
const swap = (text, re, fn, label) => {
  if (!re.test(text)) { warn(`anchor not found: ${label}`); return text; }
  return text.replace(re, fn);
};

// 1. Verified limits: data files + both tables (unchanged behaviour).
const data = await (await fetch(base + '/limits.json')).json();
writeFileSync('limits.json', JSON.stringify(data, null, 2));
writeFileSync('limits.md', await (await fetch(base + '/limits.md')).text());
const row = (t) => `| [${t.name}](${base}/en/tools/${t.slug}.html) | ${String(t.quota).replace(/\|/g, '\\|')} | ${t.checked} |`;
const rowZh = (t) => `| [${t.name}](${t.page}) | ${String(t.quota).replace(/\|/g, '\\|')} | ${t.checked} |`;
let readme = readFileSync('README.md', 'utf8');
readme = readme
  .replace(/(## Verified limits \(EN\)\n\n\| Tool[^\n]*\n\|[^\n]*\n)([\s\S]*?)(\n\n## )/, (_, h, _rows, tail) => h + data.tools.map(row).join('\n') + tail)
  .replace(/(## 已核实额度（中文）\n\n\| 工具[^\n]*\n\|[^\n]*\n)([\s\S]*?)(\n\n## )/, (_, h, _rows, tail) => h + data.tools.map(rowZh).join('\n') + tail);

// 2. Coverage sentence (EN + ZH) and the directory size quoted in the search tool row.
if (Number.isInteger(data.count) && Number.isInteger(data.of_total_listed)) {
  readme = swap(readme, /— \d+ of the \d+ listed tools have a verified ceiling\./, () => `— ${data.count} of the ${data.of_total_listed} listed tools have a verified ceiling.`, 'coverage EN');
  readme = swap(readme, /目前 \d+ 个工具中 \d+ 条已核实。/, () => `目前 ${data.of_total_listed} 个工具中 ${data.count} 条已核实。`, 'coverage ZH');
  readme = swap(readme, /\(\d+ tools today; every result reports `directory_size`\)/, () => `(${data.of_total_listed} tools today; every result reports \`directory_size\`)`, 'directory size');
}

// 3. MCP surface: tool / resource counts from the live discovery file; missing tool rows are
//    reported, never invented (each row's wording is written by hand).
const wk = await getJson(base + '/.well-known/mcp.json');
if (wk && Array.isArray(wk.tools) && Array.isArray(wk.resources)) {
  readme = swap(readme, /\*\*\d+ tools\*\*/, () => `**${wk.tools.length} tools**`, 'tool count');
  const res = wk.resources.map((u, i) => (i === 0 ? `\`${u}\`` : `\`${u.replace(/^baipiaoji/, '')}\``)).join(' · ');
  readme = swap(readme, /\*\*\d+ resources\*\* \(pull whole datasets in one call\): [^\n]*/, () => `**${wk.resources.length} resources** (pull whole datasets in one call): ${res}`, 'resources');
  for (const t of wk.tools) if (!readme.includes(`| \`${t}\` |`)) warn(`tool ${t} is live but has no README row — add one by hand`);
}

// 4. Agents directory size and date.
const ag = await getJson(base + '/agents.json');
if (ag && Number.isInteger(ag.count)) {
  readme = swap(readme, /<!--agents-count-->[^<]*<!--\/agents-count-->/, () => `<!--agents-count-->${ag.count} records<!--/agents-count-->`, 'agents count');
  if (/^\d{4}-\d{2}-\d{2}$/.test(ag.generated || '')) readme = swap(readme, /<!--agents-date-->[^<]*<!--\/agents-date-->/, () => `<!--agents-date-->${ag.generated}<!--/agents-date-->`, 'agents date');
}
writeFileSync('README.md', readme);

// 5. server.json mirrors the version the official MCP Registry marks as latest — the registry,
//    not this repo, is the source of truth (publishing happens from the site's own pipeline).
const reg = await getJson('https://registry.modelcontextprotocol.io/v0/servers?search=verified-ai-free-tiers');
const latest = (reg?.servers || []).find((s) => s.server?.name === 'io.github.f-tiger/verified-ai-free-tiers'
  && s._meta?.['io.modelcontextprotocol.registry/official']?.isLatest);
if (latest) writeFileSync('server.json', JSON.stringify(latest.server, null, 2) + '\n');
else warn('registry: no isLatest entry for io.github.f-tiger/verified-ai-free-tiers — server.json left as is');

console.log('synced', data.tools.length, 'verified limits;', wk ? `${wk.tools.length} tools` : 'mcp n/a', ';', ag ? `${ag.count} agents` : 'agents n/a', ';', latest ? `server.json ${latest.server.version}` : 'server.json unchanged');
