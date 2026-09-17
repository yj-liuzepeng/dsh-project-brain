import { promises as fsp } from "node:fs";
import path from "node:path";

function asPath(target) {
  if (typeof target === "string") return target;
  if (target && typeof target.path === "string") return target.path;
  return String(target);
}

export function createNodeFs() {
  return {
    async resolve(p, opts) {
      const raw = asPath(p);
      if (opts && opts.cwd && typeof opts.cwd === "string" && !path.isAbsolute(raw)) {
        return path.join(opts.cwd, raw);
      }
      return raw;
    },
    processPath(target) {
      return asPath(target);
    },
    async readText(target) {
      try {
        return await fsp.readFile(asPath(target), "utf8");
      } catch (e) {
        return null;
      }
    },
    async writeText(target, content) {
      const abs = asPath(target);
      await fsp.mkdir(path.dirname(abs), { recursive: true });
      await fsp.writeFile(abs, content == null ? "" : String(content), "utf8");
      return true;
    },
    async mkdir(target, opts) {
      await fsp.mkdir(asPath(target), { recursive: !!(opts && opts.recursive) });
    },
    async listDir(target) {
      const dir = asPath(target);
      const names = await fsp.readdir(dir, { withFileTypes: true });
      return names.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : (e.isFile() ? "file" : "other"),
        target: path.join(dir, e.name),
      }));
    },
  };
}
