// write-lock.js — 按 key 串行化写入序列。
//
// 为什么需要：DSH 的 fs 只有覆盖写，appendLine 是「读全文 → 拼接 → 写全文」，
// admit / housekeep / 人工编辑则是「读整表 → 改 → 写整表」。两个并发的序列
// 会各自基于旧快照写回，后写的把先写的抹掉，而且没有任何报错。
//
// 两层 key，获取顺序永远是「事务锁 → 文件锁」，且两者 key 不同，不会互相死锁：
//   - 事务锁 brainTxKey(projectPath, file)：包住整个读-改-写序列
//   - 文件锁 path：包住单次 append / 覆盖写
//
// 持锁期间不要调用任何可能再取同一把锁的函数（典型的是 buildWorkspacePreview →
// persistHousekeep）。真这么写了会被下面的重入检测当场拦下，而不是静默挂起。

import { AsyncLocalStorage } from "node:async_hooks";

const chains = new Map();

// 记录当前异步调用链已经持有哪些 key。持锁期间再取同一把锁 = 自己等自己，
// 表现是「操作其实成功了，但调用方永远收不到返回」——最难查的那种 bug。
// 与其挂死，不如当场抛错把调用路径暴露出来。
const heldKeys = new AsyncLocalStorage();

export function withWriteLock(key, task) {
  const k = String(key || "default");
  const held = heldKeys.getStore();
  if (held && held.has(k)) {
    return Promise.reject(Object.assign(
      new Error("write-lock re-entered, would deadlock: " + k),
      { code: "E_WRITE_LOCK_REENTRY" },
    ));
  }
  const nextHeld = new Set(held || []);
  nextHeld.add(k);
  const run = () => heldKeys.run(nextHeld, task);

  const prev = chains.get(k);
  // 队列空时直接跑，省掉一次微任务跳转——串行调用是最常见的路径。
  const result = prev ? prev.then(run) : (async () => run())();
  // 链上只传递「已完成」信号并吞掉错误，否则一次失败会毒化后面排队的所有任务。
  // 顺手清空闲置的 key，避免长时间运行后 Map 里堆满已完成的链。
  let tail;
  const settle = () => {
    if (chains.get(k) === tail) chains.delete(k);
  };
  tail = result.then(settle, settle);
  chains.set(k, tail);
  return result;
}

export function brainTxKey(projectPath, file) {
  return String(projectPath || "") + "::tx::" + String(file || "memory.jsonl");
}

// 仅供测试断言用：正常运行时队列应该很快排空。
export function pendingLockCount() {
  return chains.size;
}
