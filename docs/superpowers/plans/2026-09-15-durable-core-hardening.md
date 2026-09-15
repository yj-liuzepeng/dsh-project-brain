# Durable Core Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining Durable Core gaps so new sessions inject only standing facts, old changelogs backfill on first read, and ask/default retrieval match the spec.

**Architecture:** Keep `admitMemory` as the only fact writer. Tighten `ruleGate` (changelog vs durable lesson; activity-report bodies). Run `housekeepMemories` on first memory read with `writeTimeline: false`. Evict Core by 0.1 importance buckets then oldest. Ask uses weighted BM25+importance+recency; vectors are an optional extra weight, not RRF-primary. Dashboard splits Core vs collapsed dormant.

**Tech Stack:** Node ESM, existing smoke scripts (`scripts/smoke-durable-core.mjs`, `scripts/smoke-retrieval-rrf.mjs`), `src/host/memory/admit.js` + readers.

## Global Constraints

- Local-first `.project-brain/memory.jsonl` remains the only fact store.
- Rules veto; LLM cannot override rule failure.
- Do not enlarge Core cap (15 / 800) or restore Jaccard merge-and-drop.
- Do not commit unless the user asks.
- Mock LLM must not become memory.

---

### Task 1: Rule gate + eviction + on-read housekeep

**Files:**
- Modify: `src/host/memory/admit.js`
- Test: `scripts/smoke-durable-core.mjs`

- [x] Failing tests: durable `release-fix` body admitted; patch+验收 body rejected; activity report rejected; close-importance evicts older; `ensureHousekeepOnRead` archives changelog without timeline spam; `admit: false` writes nothing
- [x] Implement `isActivityReport`, relax version+release unless body is a report, 0.1 importance buckets, `ensureHousekeepOnRead`, compact automatic content to 400 chars
- [x] Smoke pass

### Task 2: Readers + ask contract

**Files:**
- Modify: `src/host/injector.js`, `src/tools/continue.js`, `src/tools/memory.js`, `src/tools/ask.js`, `src/tools/status.js`, `src/host/sidebar/aggregator.js`, `src/host/memory/retrieval.js`, `src/host/memory/inject-context.js`, `src/host/memory/session-extractor.js`
- Test: `scripts/smoke-durable-core.mjs`, `scripts/smoke-retrieval-rrf.mjs`

- [x] Call `ensureHousekeepOnRead` / sync housekeep before inject, continue, list, ask, status, dashboard
- [x] `retrieveMemories` never takes RRF as primary; vector is a weight only
- [x] Ask dormant hit / archived miss
- [x] Injector markdown === continue `injection`

### Task 3: Dashboard + spec + this-repo Core

**Files:**
- Modify: `src/client.js`, `docs/superpowers/specs/2026-09-15-durable-core-memory-design.md`, `.project-brain/memory.jsonl`, `.project-brain/todo.jsonl`

- [x] Memory tab: Core first, dormant collapsed
- [x] Spec status line = implemented
- [x] Supersede outdated 三大核心决策 with Durable Core fact

### Task 4: Verify

- [x] `npm test` and `npm run test:acceptance`
- [x] `npm run build` so `lib/index.js` contains `ensureHousekeepOnRead`
