// unwrap tools.execute / Connection RPC 的多层 { ok, data } 包装
//
// 实测过两种宿主行为：
//   A) tools.execute 直接返回 tool.execute() 的 { ok:true, data:{ bundlePath } }
//   B) DSH 再包一层 { ok:true, data: <A> }
// 只剥一层时 Client 会拿到 { ok:true, data:{ bundlePath } }，toast 就变成「未拿到文件名」。

export function unwrapToolResult(result) {
  if (!result || typeof result !== "object") return {};
  if (result.ok === false) {
    return {
      error: true,
      code: result.code,
      message: result.message,
      data: result.data,
    };
  }
  let cur = result;
  for (let i = 0; i < 4; i++) {
    if (!cur || typeof cur !== "object") break;
    const wrappedOk = cur.ok === true && cur.data && typeof cur.data === "object" && !Array.isArray(cur.data);
    if (wrappedOk) {
      cur = cur.data;
      continue;
    }
    break;
  }
  return cur && typeof cur === "object" ? cur : {};
}

/**
 * 从 Connection RPC 回包里捞工具字段。
 * DSH 实测：Quick Action 能读到的是 value.result.data.*（tools.execute 原样）。
 * 拍扁成 value.result.bundlePath 会被 schema 丢掉，Client 就只剩「未拿到文件名」。
 */
export function pickRpcToolData(resp) {
  if (!resp || typeof resp !== "object") return {};
  const value = resp.value && typeof resp.value === "object" ? resp.value : {};
  const result = value.result && typeof value.result === "object" ? value.result : null;
  const nested = result && result.data && typeof result.data === "object" && !Array.isArray(result.data)
    ? result.data
    : null;
  const deeper = nested && nested.data && typeof nested.data === "object" && !Array.isArray(nested.data)
    ? nested.data
    : null;
  const layers = [value, result, nested, deeper].filter(Boolean);
  const out = {};
  for (const layer of layers) {
    for (const key of Object.keys(layer)) {
      if (key === "result" || key === "data" || key === "preview" || key === "ok") continue;
      if (out[key] == null && layer[key] != null && typeof layer[key] !== "object") {
        out[key] = layer[key];
      } else if (out[key] == null && (key === "impact" || key === "manifest" || key === "sourceBackup" || key === "currentBrain" || key === "rootPathRewrite") && layer[key] && typeof layer[key] === "object") {
        out[key] = layer[key];
      } else if (out[key] == null && Array.isArray(layer[key]) && key === "backups") {
        out[key] = layer[key];
      }
    }
  }
  return out;
}
