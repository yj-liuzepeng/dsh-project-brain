// 调试 detector 输出
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

function hashBytes(b) { return createHash("sha1").update(b).digest("hex"); }
function makeGitObject(type, content) {
  const header = Buffer.from(`${type} ${content.length}\0`, "binary");
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  return Buffer.concat([header, body]);
}
function writeLooseObject(gitDir, type, content) {
  const obj = makeGitObject(type, content);
  const hash = hashBytes(obj);
  const dir = join(gitDir, "objects", hash.slice(0, 2));
  const path = join(dir, hash.slice(2));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, deflateRawSync(obj));
  return hash;
}
function makeTree(entries) {
  const parts = [];
  entries.sort((a, b) => {
    const ab = Buffer.from(a.name, "binary");
    const bb = Buffer.from(b.name, "binary");
    return ab < bb ? -1 : ab > bb ? 1 : 0;
  });
  for (const e of entries) {
    parts.push(Buffer.from(`${e.mode} ${e.name}\0`, "binary"));
    parts.push(Buffer.from(e.hash, "hex"));
  }
  return Buffer.concat(parts);
}
function makeCommit({ tree, parents = [], message }) {
  const lines = [`tree ${tree}`];
  for (const p of parents) lines.push(`parent ${p}`);
  lines.push("author test <t@t>", "committer test <t@t>", "", message);
  return lines.join("\n");
}

const tmp = mkdtempSync(join(tmpdir(), "dsh-pb-debug-"));
const gitDir = join(tmp, ".git");
mkdirSync(join(gitDir, "objects"), { recursive: true });
mkdirSync(join(gitDir, "refs", "heads"), { recursive: true });

// Build 3 commits
const b1 = writeLooseObject(gitDir, "blob", "hello\n");
const t1 = writeLooseObject(gitDir, "tree", makeTree([{ mode: "100644", name: "README.md", hash: b1 }]));
const c1 = writeLooseObject(gitDir, "commit", makeCommit({ tree: t1, message: "initial" }));
const b2 = writeLooseObject(gitDir, "blob", "v1\n");
const t2 = writeLooseObject(gitDir, "tree", makeTree([
  { mode: "100644", name: "README.md", hash: b1 },
  { mode: "100644", name: "src/index.js", hash: b2 },
]));
const c2 = writeLooseObject(gitDir, "commit", makeCommit({ tree: t2, parents: [c1], message: "add src" }));
const b3 = writeLooseObject(gitDir, "blob", "hello updated\n");
const t3 = writeLooseObject(gitDir, "tree", makeTree([
  { mode: "100644", name: "README.md", hash: b3 },
  { mode: "100644", name: "src/index.js", hash: b2 },
]));
const c3 = writeLooseObject(gitDir, "commit", makeCommit({ tree: t3, parents: [c2], message: "update README" }));
writeFileSync(join(gitDir, "refs", "heads", "main"), c3 + "\n");
writeFileSync(join(gitDir, "HEAD"), "ref: refs/heads/main\n");

console.log("=== repo ===");
console.log("c1:", c1);
console.log("c2:", c2);
console.log("c3:", c3, "(HEAD)");

const { detectChanges } = await import("../src/host/diff/detector.js");

console.log("\n=== since=1 (HEAD vs HEAD~1 = c3 vs c2) ===");
const r1 = await detectChanges({ projectPath: tmp, since: "1" });
console.log("files:", r1.files);
console.log("changes:", JSON.stringify(r1.changes, null, 2));
console.log("commits:", r1.commits);

console.log("\n=== since=2 (HEAD vs HEAD~2 = c3 vs c1) ===");
const r2 = await detectChanges({ projectPath: tmp, since: "2" });
console.log("files:", r2.files);
console.log("changes:", JSON.stringify(r2.changes, null, 2));
console.log("commits:", r2.commits);

rmSync(tmp, { recursive: true, force: true });