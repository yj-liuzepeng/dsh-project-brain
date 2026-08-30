import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const root = join(import.meta.dirname, "..");
const expected = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const temp = mkdtempSync(join(tmpdir(), "dsh-project-brain-install-"));
const installRoot = join(temp, "consumer");

try {
  console.log("=== dsh-project-brain clean tarball install ===");
  const filename = execFileSync("npm", ["pack", "--pack-destination", temp], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim().split(/\r?\n/).pop();
  const tarball = join(temp, filename);
  if (!existsSync(tarball)) throw new Error("npm pack did not create " + tarball);

  execFileSync("npm", [
    "install",
    "--prefix", installRoot,
    "--ignore-scripts",
    "--omit=dev",
    tarball,
  ], { cwd: temp, stdio: "inherit" });

  const installedRoot = join(installRoot, "node_modules", expected.name);
  const installed = JSON.parse(readFileSync(join(installedRoot, "package.json"), "utf8"));
  const required = [
    installed.main,
    installed.exports && installed.exports["./client"] && installed.exports["./client"].default,
    "cordis.patch.yml",
  ].filter(Boolean);
  if (installed.version !== expected.version) throw new Error(`version mismatch: ${installed.version} != ${expected.version}`);
  for (const file of required) {
    if (!existsSync(join(installedRoot, file))) throw new Error("installed package missing " + file);
  }
  console.log(`CLEAN_TARBALL_INSTALL_PASS (${expected.name}@${expected.version})`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
