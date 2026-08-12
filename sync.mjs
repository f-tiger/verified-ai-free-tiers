#!/usr/bin/env node
// 每日从 baipiaoji.com 拉取最新已核实数据并重建 README 表格；无变化则不产生提交。
import { writeFileSync } from 'node:fs';
const base = 'https://baipiaoji.com';
const data = await (await fetch(base + '/limits.json')).json();
writeFileSync('limits.json', JSON.stringify(data, null, 2));
writeFileSync('limits.md', await (await fetch(base + '/limits.md')).text());
const row = (t) => `| [${t.name}](${base}/en/tools/${t.slug}.html) | ${String(t.quota).replace(/\|/g, '\\|')} | ${t.checked} |`;
const rowZh = (t) => `| [${t.name}](${t.page}) | ${String(t.quota).replace(/\|/g, '\\|')} | ${t.checked} |`;
const { readFileSync } = await import('node:fs');
let readme = readFileSync('README.md', 'utf8');
readme = readme
  .replace(/(## Verified limits \(EN\)\n\n\| Tool[^\n]*\n\|[^\n]*\n)([\s\S]*?)(\n\n## )/, (_, h, _rows, tail) => h + data.tools.map(row).join('\n') + tail)
  .replace(/(## 已核实额度（中文）\n\n\| 工具[^\n]*\n\|[^\n]*\n)([\s\S]*?)(\n\n## )/, (_, h, _rows, tail) => h + data.tools.map(rowZh).join('\n') + tail);
writeFileSync('README.md', readme);
console.log('synced', data.tools.length, 'verified limits');
