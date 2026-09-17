// confirm-tokens.js — 内存级 confirmToken 存储（dryRun → apply 两步机制）
//
// 用法：
//   const tokenStore = createTokenStore({ ttlMs: 5 * 60 * 1000 });
//   const token = tokenStore.issue({ kind: "import", payload: {...} });
//   tokenStore.consume(token, { kind: "import" });  // 校验通过返回 payload，否则返回 null
//
// 设计：
//   - 内存级（重启失效，调用方需重新 dryRun）
//   - 5 分钟 TTL（默认），过期自动清理
//   - 一次性（consume 后删除）
//   - 绑定 kind（"import" / "rollback"），不同操作不互通
//   - 32-char hex（node:crypto randomBytes）

import { randomBytes } from "node:crypto";

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 分钟

export function createTokenStore({ ttlMs = DEFAULT_TTL_MS } = {}) {
  /** @type {Map<string, { kind: string, payload: any, createdAt: number }>} */
  const store = new Map();

  function sweep(now = Date.now()) {
    for (const [key, entry] of store.entries()) {
      if (now - entry.createdAt > ttlMs) {
        store.delete(key);
      }
    }
  }

  return {
    /**
     * 发放一个 confirmToken，附带 payload。
     * @param {{ kind: string, payload: any }} args
     * @returns {string} token
     */
    issue({ kind, payload }) {
      if (!kind) throw new Error("confirm-tokens: kind is required");
      const token = randomBytes(16).toString("hex");
      store.set(token, { kind, payload, createdAt: Date.now() });
      return token;
    },

    /**
     * 校验并消费 token。成功返回 payload，失败返回 null。
     * @param {string} token
     * @param {{ kind?: string }} args 期待的操作类型（可选）
     * @returns {any} payload 或 null
     */
    consume(token, { kind } = {}) {
      if (!token || typeof token !== "string") return null;
      const entry = store.get(token);
      if (!entry) return null;
      store.delete(token); // 一次性
      if (kind && entry.kind !== kind) return null;
      return entry.payload;
    },

    /**
     * 仅校验（不消费），用于 dryRun 显示 / 调试。
     */
    peek(token, { kind } = {}) {
      const entry = store.get(token);
      if (!entry) return null;
      if (kind && entry.kind !== kind) return null;
      // 顺带清理过期
      if (Date.now() - entry.createdAt > ttlMs) {
        store.delete(token);
        return null;
      }
      return entry.payload;
    },

    /** 主动清理过期（测试 / 健康检查用） */
    sweep,

    /** 当前活跃 token 数（调试用） */
    get size() {
      sweep();
      return store.size;
    },
  };
}

// 单例：进程级共享一个 store（多个 Tool 协作）
let _singleton = null;
export function getTokenStore() {
  if (!_singleton) _singleton = createTokenStore();
  return _singleton;
}

// 测试 / 重新初始化（仅供单测使用）
export function _resetTokenStoreForTest() {
  _singleton = createTokenStore();
}
