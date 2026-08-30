// test auto-rebuild 模拟
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = join(__dirname, "..", "..");

console.log("PLUGIN_DIR:", PLUGIN_DIR);
console.log("build.js exists:", require("node:fs").existsSync(join(PLUGIN_DIR, "build.js")));
console.log("---running build.js---");
const t0 = Date.now();
const child = spawn(process.execPath, [join(PLUGIN_DIR, "build.js")], {
  cwd: PLUGIN_DIR, stdio: ["ignore", "inherit", "inherit"],
});
child.on("close", (code) => {
  console.log("---done---", "code=" + code, "ms=" + (Date.now() - t0));
});
