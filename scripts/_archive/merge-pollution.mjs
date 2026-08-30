// Merge DSH Desktop pollution into plugins/.project-brain/
import fs from 'node:fs';
import path from 'node:path';

function readJsonl(p) {
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, 'utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const out = [];
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch (e) {}
  }
  return out;
}

function writeJsonl(p, items) {
  const content = items.map(it => JSON.stringify(it)).join('\n') + '\n';
  fs.writeFileSync(p, content, 'utf8');
}

const src = 'C:\\Users\\liuzp16\\AppData\\Local\\Programs\\DSH Desktop\\.project-brain';
const dst = 'C:\\Users\\liuzp16\\Desktop\\liuzp\\plugins\\.project-brain';

for (const f of ['todo.jsonl', 'memory.jsonl', 'timeline.jsonl']) {
  const srcItems = readJsonl(path.join(src, f));
  const dstItems = readJsonl(path.join(dst, f));
  const seen = new Set(dstItems.map(it => it.id));
  const merged = [...dstItems];
  let added = 0;
  for (const it of srcItems) {
    if (!seen.has(it.id)) {
      merged.push(it);
      added += 1;
    }
  }
  writeJsonl(path.join(dst, f), merged);
  console.log(`${f}: kept ${dstItems.length}, added ${added}, total ${merged.length}`);
}
