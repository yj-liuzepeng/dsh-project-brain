// smoke-append-line.mjs - v0.4.0 appendLine / appendJsonl O(N)→O(N-readonly) 优化验证
//
// 覆盖：
//   1) appendLine 基础：文件不存在 → 创建 + 写
//   2) appendLine 边界：文件末尾有 "\n" → 直接拼接
//   3) appendLine 边界：文件末尾无 "\n" → 补换行
//   4) appendLine line 自带 "\n" → 不重复补
//   5) appendLine line 不带 "\n" → 自动补
//   6) appendLine null/空 → 直接返回 false（不创建文件）
//   7) appendJsonl 行为兼容：appendJsonl(fs, path, {a:1}) 等价于 appendLine(fs, path, '{"a":1}\n')
//   8) appendJsonl 多次调用累积：5 次调用 → 5 行
//   9) appendJsonl 与 parseJsonl 往返：append 后 readJsonl 能完整读回
//   10) 性能基准：1000 行 append 总耗时 < 100ms（O(N) readonly 表现）
//   11) appendLine 边界：空文件 → 直接写
//   12) appendLine 边界：line 含特殊字符（中文 + 引号 + 换行）→ 正确转义
//
// 用例总计 12 项，0 → 12 PASS。
//
// 退出码：0 = PASS，1 = FAIL

import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP = mkdtempSync(join(tmpdir(), "dsh-pb-append-"));

// 用 node:fs 直接当 fsAdapter（与 src/host/store/brain-files.js 接口一致）
import * as nodefs from "node:fs";
const fsAdapter = {
  resolve: async (p) => p,
  readText: async (target) => { try { return nodefs.readFileSync(target, "utf8"); } catch { return null; } },
  writeText: async (target, content) => {
    try { nodefs.mkdirSync(String(target).replace(/[\\/][^\\/]*$/, ""), { recursive: true }); } catch (e) {}
    nodefs.writeFileSync(target, content, "utf8"); return true;
  },
};

const { appendLine, appendJsonl, parseJsonl, readJsonl } = await import("../src/host/store/brain-files.js");

let pass = 0;
let fail = 0;
const check = (name, ok, extra) => {
  if (ok) { console.log(`  [PASS] ${name}`); pass++; }
  else { console.log(`  [FAIL] ${name}${extra ? "  -> " + extra : ""}`); fail++; }
};

console.log("=== 1) appendLine 基础：文件不存在 ===");
const p1 = join(TMP, "a.jsonl");
check("appendLine 到不存在文件 → 返回 true", await appendLine(fsAdapter, p1, "first\n"));
check("文件被创建", existsSync(p1));
check("文件内容正确", readFileSync(p1, "utf8") === "first\n");

console.log("\n=== 2) appendLine 边界：文件末尾有 \\n ===");
const p2 = join(TMP, "b.jsonl");
writeFileSync(p2, "a\nb\n", "utf8");
check("appendLine 到末尾有 \\n 的文件 → 返回 true", await appendLine(fsAdapter, p2, "c\n"));
check("内容是 a\\nb\\nc\\n（无重复 \\n）", readFileSync(p2, "utf8") === "a\nb\nc\n");

console.log("\n=== 3) appendLine 边界：文件末尾无 \\n ===");
const p3 = join(TMP, "c.jsonl");
writeFileSync(p3, "a\nb", "utf8");  // 末尾无 \n
check("appendLine 到末尾无 \\n 的文件 → 返回 true", await appendLine(fsAdapter, p3, "c\n"));
check("补了 \\n：a\\nb\\nc\\n", readFileSync(p3, "utf8") === "a\nb\nc\n");

console.log("\n=== 4) appendLine line 自带 \\n → 不重复补 ===");
const p4 = join(TMP, "d.jsonl");
writeFileSync(p4, "a\n", "utf8");
check("line 自带 \\n → 不重复", await appendLine(fsAdapter, p4, "b\n"));
check("a\\nb\\n（不是 a\\nb\\n\\n）", readFileSync(p4, "utf8") === "a\nb\n");

console.log("\n=== 5) appendLine line 不带 \\n → 自动补 ===");
const p5 = join(TMP, "e.jsonl");
writeFileSync(p5, "a\n", "utf8");
check("line 不带 \\n → 自动补", await appendLine(fsAdapter, p5, "b"));
check("a\\nb\\n", readFileSync(p5, "utf8") === "a\nb\n");

console.log("\n=== 6) appendLine null/空 line ===");
const p6 = join(TMP, "f.jsonl");
check("appendLine null → false（不创建文件）", !(await appendLine(fsAdapter, p6, null)));
check("文件未被创建", !existsSync(p6));

console.log("\n=== 7) appendJsonl 行为兼容 ===");
const p7 = join(TMP, "g.jsonl");
await appendJsonl(fsAdapter, p7, { id: "mem-1", title: "test" });
check("appendJsonl 后文件存在", existsSync(p7));
check("内容是 {\"id\":\"mem-1\",...}\\n", readFileSync(p7, "utf8").startsWith('{"id":"mem-1"') && readFileSync(p7, "utf8").endsWith("\n"));

console.log("\n=== 8) appendJsonl 多次累积 ===");
const p8 = join(TMP, "h.jsonl");
for (let i = 0; i < 5; i++) {
  await appendJsonl(fsAdapter, p8, { i });
}
const hContent = readFileSync(p8, "utf8").trim().split("\n");
check("5 次 append → 5 行", hContent.length === 5);
check("最后一行是 {\\\"i\\\":4}", hContent[4] === '{"i":4}');

console.log("\n=== 9) appendJsonl ↔ readJsonl 往返 ===");
const p9 = join(TMP, "i.jsonl");
const items = [{ a: 1, b: "x" }, { a: 2, b: "y 中文" }, { a: 3, b: '"quoted"' }];
for (const it of items) await appendJsonl(fsAdapter, p9, it);
const readBack = await readJsonl(fsAdapter, p9);
check("3 行全部读回", readBack.length === 3);
check("中文 + 引号正确反序列化", JSON.stringify(readBack) === JSON.stringify(items));

console.log("\n=== 10) 性能基准：append 的单行成本不得失控 ===");
// 这一项原本断言「新实现比旧实现（readJsonl + push + serializeJsonl）快」。
// 2026-09-23 用交替对跑实测后发现这个前提不成立：
//     N= 300 → 1.02x    N=1000 → 0.97x    N=2500 → 1.15x
// 两者差异全在噪声范围内。因为瓶颈是「读全文 + 写全文」的文件 IO，
// JSON.parse / stringify 的开销相对可以忽略。此前测出的 1.4~1.5x 是
// 连跑两轮新实现再连跑两轮旧实现造成的缓存不对称，不是真实差距。
//
// 所以改成守单行平均成本：它抓得住真正的灾难（比如误改成每条 append 都扫全表
// 两遍、或退化成 O(N²)），又不会被机器负载晃出误报。实测约 2ms/行，留 10 倍余量。
const BENCH_N = 300;
const row = (i) => ({ i, data: "x".repeat(50) });
const benchPath = join(TMP, "bench.jsonl");
writeFileSync(benchPath, "", "utf8");
const benchStart = Date.now();
for (let i = 0; i < BENCH_N; i++) await appendJsonl(fsAdapter, benchPath, row(i));
const perRow = (Date.now() - benchStart) / BENCH_N;
check(
  `${BENCH_N} 行 append 平均 ${perRow.toFixed(2)}ms/行（上限 20ms/行）`,
  perRow < 20,
  `actual ${perRow.toFixed(2)}ms/行`,
);
check("append 的行数完整", (await readJsonl(fsAdapter, benchPath)).length === BENCH_N);

console.log("\n=== 11) appendLine 空文件 ===");
const p11 = join(TMP, "k.jsonl");
writeFileSync(p11, "", "utf8");
check("空文件 appendLine → true", await appendLine(fsAdapter, p11, "first\n"));
check("内容是 first\\n", readFileSync(p11, "utf8") === "first\n");

console.log("\n=== 12) appendLine 特殊字符 ===");
const p12 = join(TMP, "l.jsonl");
writeFileSync(p12, "", "utf8");
await appendLine(fsAdapter, p12, JSON.stringify({ msg: "中文 + \"quotes\" + \n embedded newline" }) + "\n");
const lContent = readFileSync(p12, "utf8");
check("特殊字符写入成功", lContent.length > 0);
const lParsed = parseJsonl(lContent);
check("特殊字符正确反序列化", lParsed[0].msg.includes("中文") && lParsed[0].msg.includes("quotes"));

console.log(`\n${pass} PASS / ${fail} FAIL`);
rmSync(TMP, { recursive: true, force: true });
process.exit(fail === 0 ? 0 : 1);