# scripts/_archive

一次性诊断 / 调试脚本归档。**不再随产品演进维护**，仅保留作为历史诊断参考。

| 文件 | 用途 | 归档时机 |
| --- | --- | --- |
| `debug-ask.js` | 离线复现 `project_ask` BOM + readJson 修复（v0.3.9） | 修复上线后 |
| `merge-pollution.mjs` | 把误写到 DSH Desktop 安装目录的 `.project-brain/` 数据合并回 plugins workspace | v0.3.8 path-resolver 修复后 |
| `test-rebuild.mjs` | 手动触发 `build.js` 看输出 | v0.3.4 auto-rebuild 上线后 |

> ⚠️ 这里的脚本**不参与 build、不被 import**，是 v0.3.0-v0.3.10 治理债清理阶段（v0.3.11）的临时归档。
> 永久删除前请先确认对应 SPEC changelog 已记录诊断结论（见 `SPEC.md` §20）。