import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
const failures = [];

function check(condition, message) {
  if (condition) console.log(`  [PASS] ${message}`);
  else {
    console.error(`  [FAIL] ${message}`);
    failures.push(message);
  }
}

console.log("=== dsh-project-brain release verification ===");

check(pkg.name === "dsh-project-brain", "package name is stable");
check(pkg.version === lock.version && pkg.version === lock.packages?.[""]?.version, "package and lock versions match");
check(pkg.license === "MIT" && existsSync(join(root, "LICENSE")), "MIT license is present");
check(existsSync(join(root, pkg.main)), "Host entry exists");
check(existsSync(join(root, pkg.exports?.["./client"]?.default || "")), "Client entry exists");
check(readFileSync(join(root, "cordis.patch.yml"), "utf8").includes("id: dsh-project-brain"), "DSH patch declares plugin id");

const packed = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: root,
  encoding: "utf8",
}));
const files = packed[0]?.files?.map((entry) => entry.path) || [];
const forbiddenFiles = files.filter((file) =>
  file.includes(".project-brain/") ||
  /(^|\/)\.env(?:\.|$)/.test(file) ||
  /\.(?:pem|p12|key|log|tgz)$/.test(file)
);
check(files.length > 0, "npm package has an explicit file set");
check(forbiddenFiles.length === 0, "package excludes project memory, credentials, logs, and archives");

const textFiles = files.filter((file) => !/\.(?:png|jpg|jpeg|gif|webp|ico|woff2?)$/i.test(file));
const forbiddenContent = [
  { name: "macOS user path", pattern: /\/Users\/[A-Za-z0-9._-]+\// },
  { name: "macOS temporary path", pattern: /\/var\/folders\/[A-Za-z0-9/_-]+/ },
  { name: "Windows user path", pattern: /[A-Za-z]:\\Users\\[^\\\s]+\\/ },
  { name: "DSH Session UUID", pattern: /session-[0-9a-f]{8}-[0-9a-f-]{27,}/i },
  { name: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];
const leaks = [];
for (const file of textFiles) {
  const absolute = join(root, file);
  if (!existsSync(absolute)) continue;
  const content = readFileSync(absolute, "utf8");
  for (const rule of forbiddenContent) {
    if (rule.pattern.test(content)) leaks.push(`${file}: ${rule.name}`);
  }
}
check(leaks.length === 0, `release files contain no local paths, Session IDs, or credentials${leaks.length ? ` (${leaks.join(", ")})` : ""}`);

const hostBundle = readFileSync(join(root, "dsh-project-brain/lib/index.js"), "utf8");
const clientBundle = readFileSync(join(root, "dsh-project-brain/lib/client.js"), "utf8");
check(hostBundle.includes("runtime RPC") || clientBundle.includes("runtime-rpc"), "release bundles use runtime workspace data");
check(clientBundle.includes('"data-dashboard-tab"'), "tabbed Dashboard UI is included");

console.log(`\n${files.length} packaged files checked; ${failures.length} failure(s).`);
if (failures.length) process.exit(1);
