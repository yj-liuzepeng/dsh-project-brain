# Durable Core Memory

Date: 2026-09-15
Status: Implemented (write-path inventory closed). Hardening 2026-09-15: first-read housekeep, changelog vs durable lesson, activity-report gate, ask weighted blend (RRF not primary), Dashboard Core/dormant split.
Scope: Rewrite the project-brain memory write/read contract. Architecture scan and todo remain; **any code that writes `memory.jsonl` must go through `admitMemory`**, including `project_diff`.

## 1. Goal

Long-term memory exists to help the next session maintain the project: decisions, constraints, lessons, stable architecture facts. It is not a changelog, not a chat archive, and not a dump of “what we did this session”.

**Product winning condition (locked):** a new session behaves like the same practitioner picking up yesterday’s work — it sees the standing decisions, does not reopen settled design, and can continue from the last recap plus active TODOs.

**Non-goal:** automatically recalling every module convention from the past year without `project_ask` / architecture tools. Dormant facts stay on disk; they are not stuffed into every prompt. “Understand the project more over time” means a stable Core + fresh last summary + TODOs + architecture scan, not an unbounded always-on memory dump.

## 2. Non-negotiables

- Local-first: `.project-brain/memory.jsonl` remains the only fact store. Vector cache stays derived and optional.
- Precision over recall: missing a fact is acceptable; injecting a false or ephemeral “fact” is not.
- Rules have veto power. An LLM cannot override a rule failure.
- Automatic writes (agent tool, session extract) require LLM confirmation. User utterance “记住 / 记一下 / remember” only needs to pass rules.
- Uninitialized projects: no memory writes, no half-created `.project-brain/` from the memory subsystem.
- Injection never silently truncates Core. Eviction happens at write time.
- Housekeeping never deletes a durable decision. Title-similarity merge-and-drop is forbidden.
- **Single writer:** the only production function allowed to append fact rows to `memory.jsonl` is `admitMemory`. Status-only rewrites go through `archive` / explicit `supersede` / `housekeepMemories`. Ad-hoc `makeMemoryEntry` + `appendJsonl` in tools is forbidden.
- **No synthetic facts:** mock LLM output must not be committed as memory.
- **Automatic path never supersedes or deletes because titles look similar.** Fingerprint match skips insert; title Jaccard is suggestion-only. Real replacement requires an explicit `supersedes` id (LLM or `project_memory_supersede`).
- **This-batch exemption:** memories admitted in the current write/housekeep turn are not evicted to `dormant` while older actives still exist.
- **One Core definition:** injector, `project_continue`, `project_suggest_next`, and Dashboard “current knowledge” all use `isCoreMemory` (`status===active`).

## 3. Layered model

Three layers, not mixed:

| Layer | Store | Injected every session | Retrieved by ask |
| --- | --- | --- | --- |
| Core | `memory.jsonl` `status=active` | Yes, all of it | Yes |
| Dormant | `memory.jsonl` `status=dormant` | No | Yes (BM25) |
| Rejected | `memory.jsonl` `status=archived` | No | No (unless `includeArchived`) |
| Replaced | `memory.jsonl` `status=superseded` | No | No (unless `includeArchived`) |
| Session recap | `timeline.jsonl` `eventType=session_summary` | Last disposed session only | Via timeline, not as memory |

`change` events belong on the timeline, never in `memory.jsonl`.
`issue` belongs in `todo.jsonl`, never in `memory.jsonl`.

## 4. Record schema

Keep `schemaVersion: 2`. New `status` values are additive.

Allowed memory types (after admit):

- `decision` | `requirement` | `architecture` | `bug` | `lesson`
- `context` only when `source.kind === "user_explicit"`

Forbidden as memory: `change`, `issue`. Existing records of those types are archived by backfill if they fail the durable-fact rules (changelog-like `change` always fails).

Required fields on new writes: `id`, `type`, `title`, `content`, `importance`, `confidence`, `status`, `source`, `createdAt`, `updatedAt`.

`source.kind` is one of:

- `user_explicit` — realtime strong “记住” signal
- `agent` — `project_memory_add` (automatic channel)
- `session_semantic` — session-end LLM extract (automatic channel)
- `project_diff` — `project_diff` after admit (automatic channel; never mock)

`source.fingerprint` is required on every new write (sha256 of `type\n title\n content` normalized lowercase collapsed whitespace, first 24 hex chars — same as current session-extractor).

Treat unknown/missing `status` on old rows as `active` until backfill. Treat legacy `reinforced` as `active`. Treat `deleted` like `archived` for all reads.

## 5. Admit pipeline

All write paths produce a candidate `{ type, title, content, importance?, confidence?, relatedFiles?, tags?, source }` and call one function: `admitMemory(candidate, ctx)`.

```
candidate
  → project initialized?        no → reject, write nothing
  → ruleGate(candidate)         fail → route or drop (below), not memory
  → channel
       user_explicit            → persist path
       automatic                → llmConfirm(candidate)
                                   no / LLM down → not memory
  → dedupe / conflict
  → persist + enforceCoreCap
```

### 5.1 Rule gate (deterministic, unit-tested)

Reject (not memory) when any of:

1. Type not in the allow-list above (`context` without `user_explicit` fails).
2. Title or content looks like a changelog **genre**, not merely because a durable sentence mentions a version. Reject when:
   - title is version-led release notes: `v1.2.0 …`, `… patch #3`, `release`, `changelog`, or combines a version token with `patch` / `改动` / `验收`
   - keywords: `改了 N 个文件`, `本次 session 改动`, `commit`, `PR #` as the main claim
   - body is primarily a file list (`- path/to/file` lines ≥ 3 and little prose)
   - Do **not** reject a decision whose title is a standing fact that happens to include a version (`codegraph 以 tree-sitter 0.25 为运行时`)
3. Content shorter than 20 characters after trim.
4. Content is not a durable statement: reject if the **whole body** is a this-session activity report (file lists, “改了 N 个文件”, 验收清单). Do **not** reject merely because a lesson starts with `刚才` / `本次` (`刚才踩了 host 不热更新，改 host 必须重启` is durable). Durable means it would still be true without a date or version number.

Rule failure routing:

- type `change` or changelog-like → append timeline event (`eventType=change` or `session_summary` detail), not memory
- type `issue` → `project_todo_add` equivalent insert if title exists; else drop
- other → drop (optional timeline `eventType=memory_rejected` with reason; not required for v1)

### 5.2 Channels

| Channel | Trigger | Rules | LLM confirm |
| --- | --- | --- | --- |
| User remember | `agent/inbox/claimed`, strong regex only | Yes | No |
| Agent tool | `project_memory_add` | Yes | Yes |
| Session extract | `session/disposed` | Yes, per item | Yes, in the same extract call (`durable` flag) |
| `project_diff` | tool execute, not dry-run | Yes | Yes (real route only; mock → refuse write) |
| Weak realtime | “以后都 / 约定 / going forward” | Do not write at ingest | Session extract may pick it up |

Strong regex remains the current strong patterns (`记住|记一下|备忘|别忘了|remember|don't forget|…`). Weak patterns are removed from realtime writes.

After a strong “记住” match, **do not** apply `NEGATIVE_CONTEXTS` git/commit veto. “记住：不要 force push” is a standing constraint and must be admitted if it passes the durable rule gate. Git-word blacklist may only skip utterances that are clearly this-turn VCS instructions **without** a remember signal.

`project_memory_add` is never `user_explicit`, even if the agent claims the user asked. Only the realtime detector seeing the user message can set `user_explicit`.

### 5.3 LLM confirm (automatic only)

Do not add a second LLM round-trip for session end. Extend the existing session-extract JSON:

```json
{
  "summary": "2–4 sentences of what this session did (recap, not memory)",
  "memories": [
    {
      "type": "decision",
      "title": "...",
      "content": "...",
      "evidence": "...",
      "durable": true,
      "importance": 0.8,
      "confidence": 0.9,
      "relatedFiles": [],
      "tags": [],
      "supersedes": "mem-… or null"
    }
  ]
}
```

Drop any item with `durable !== true`. Keep existing evidence grounding; ungrounded items already cap confidence — additionally, ungrounded items cannot enter Core as `active` if confidence < 0.6 (write as drop, not dormant).

For `project_memory_add`, call a small confirm prompt: return `{ admit: boolean, type, reason, supersedes? }`. If LLM unavailable or parse fails: **do not write memory**. Return `ok: false, code: E_ADMIT_LLM_UNAVAILABLE` (or `E_ADMIT_REJECTED`). Timeline is unchanged unless the tool caller also wants a recap (they do not).

Git diff stays evidence for the extract prompt. **Do not** fall back to a `type=change` memory when the LLM returns no durable items. File lists may appear in the timeline `session_summary.detail` only.

### 5.4 Dedupe and conflict

Before insert:

1. Same `source.fingerprint` as any non-archived row → skip (idempotent success for user_explicit; tool returns existing id).
2. Explicit `supersedes` id (from LLM confirm / extract JSON / `project_memory_supersede`) pointing at an active or dormant row → mark old `superseded`, insert new `active`. Both bodies remain.
3. Same type + title bigram Jaccard ≥ 0.85 → **do not change status**. Record `suggest_supersede` for dry-run/housekeep reports only.

Automatic insert must not hide a standing decision because titles look alike.

### 5.5 Unique writer and `project_diff`

Invariant (smoke grep + tests): production `src/**` contains no `appendJsonl(..., "memory.jsonl")` except inside `admitMemory`. Status-only rewrites (`archive`, explicit `supersede`, `housekeepMemories`) go through those helpers, not ad-hoc `makeMemoryEntry`.

`project_diff` today defaults `dryRun=false` and can commit mock architecture text. Required:

- Default `dryRun=true`.
- If the LLM path is mock / fallback fixture: return `E_ADMIT_MOCK_FORBIDDEN`, write nothing.
- Non-dry-run real output is a candidate with `source.kind=project_diff` and must pass `admitMemory` (automatic + LLM confirm). Changelog-like `type=change` from diff never becomes memory (timeline only).

## 6. Core cap and eviction

Constants (code, not settings, for v1):

- `CORE_MAX_ITEMS = 15`
- `CORE_MAX_TOKENS = 800`
- Token estimate: same as injector today (CJK 1.5 chars/token, other 4 chars/token) over `title + content` of active rows.

`enforceCoreCap(rows, { pinnedIds })` after every successful insert or housekeep:

1. Active set is all `status===active`.
2. `pinnedIds` = ids admitted in this turn. They are skipped while any **unpinned** active remains.
3. While `count > 15` or `tokenSum > 800`: pick the **unpinned** active with lowest `importance`, then oldest `updatedAt`, set `status=dormant`. If every active is pinned and still over cap, then evict pinned by the same order (last resort).
4. Never delete. Never truncate text. Never drop from injection by slicing Top-K.

A newly admitted row always starts as `active`. A just-confirmed constraint must appear in the next session’s Core unless the entire Core is this-turn overflow.

User `project_memory_archive` sets `archived` (rejected/unwanted). It does not use `dormant`.

## 7. Injection

Replace Top-K `retrieveMemories("")` and the extra “最近决策链” block.

Shared assembler `buildInjectionContext(brain)` used by:

- `setupInjector` system prompt section
- `project_continue`

Markdown shape:

```
## Project Brain
### 项目概况
### Core 记忆          (all active, newest updatedAt first)
### 上次会话           (latest timeline session_summary.summary from a disposed session)
### 活跃 TODO
```

Rules:

- Inject **all** `active` memories. No truncation of Core. Cap is enforced at write.
- Last session summary: one entry, max **400** tokens, truncate on sentence boundary and append `（摘要已截断）`. If missing, omit the heading. Do not substitute git file lists.
- Token budget of the whole section: Core first (≤800), summary second (≤400), then 概况 + TODO. Combined Core+summary stays ≤1200 so 概况/TODO still fit under ~1500. Do not silently drop Core items.
- Empty/uninitialized: return `""`.
- Prompt 约定: remove “用户说记住就调 project_memory_add”. Replace with: only call `project_memory_add` for durable decisions/constraints/lessons; the tool may reject and must not be retried as changelog. Use `project_todo_*` for in-flight work — continue fidelity depends on TODOs, not on stuffing recap into memory.

## 8. Read APIs

| Consumer | Sees |
| --- | --- |
| Injector / continue / `project_suggest_next` / Dashboard current | `isCoreMemory` only (`status===active`) |
| `project_ask` default | `active` + `dormant`, BM25 + importance/recency blend (existing fallback weights, no RRF as primary) |
| `project_ask` vectors | Optional extra channel if configured; failure → BM25 only; never used in injector |
| `project_memory_list` default | `active` only |
| `project_memory_list` `layer=dormant\|all` | dormant, or active+dormant |
| Dashboard memory tab | `active` first, then dormant collapsed; hide archived unless toggle |
| `includeArchived` | adds archived + superseded |

Remove `memoryScore` / `topMemories` from injector and continue. Keep `topMemories` only if list without query needs a sort: sort active by `importance` desc, `updatedAt` desc — not the old 90-day formula mixed with retrieveMemories’ 180-day formula.

`isActiveMemory` today means “not archived/superseded/deleted”. Split and **update every caller**:

- `isCoreMemory` → `status===active` (missing status counts as active until backfill)
- `isRetrievableMemory` → core or dormant
- Call sites: injector, continue, **`src/host/suggest.js`**, dashboard stats / memory tab “current” → `isCoreMemory`. ask → `isRetrievableMemory`. Do not leave `suggest.js` on `topMemories(isActiveMemory)` or it will recommend dormant/changelog as “today’s work”.

## 9. Backfill

Existing development `memory.jsonl` is not precious.

On summarizer run and on first memory read after upgrade, `backfillMemoryStatuses(rows)`:

- Rule-gate hard hits (versioned titles, changelog body, `type=change`) → `archived` automatically, `archiveReason=backfill_rule`.
- Do not LLM-auto-archive the rest in v1.
- Persist rewritten jsonl only if something changed.

## 10. Dream (housekeeping only)

Dream is **tidy-up**, not sleep-time intelligence. Reflection already happens in session-end extract (`durable` + timeline summary). A second LLM pass that “consolidates while idle” is out of scope.

### 10.1 Replace the current auto-dream

Today (`summarizer.js` after `session/disposed`): if `memory.jsonl.length >= 30`, immediately `applyDreamCommit` (light, not dry-run): title Jaccard ≥ 0.92 **deletes** similar rows; `importance < 0.15` and age > 30 days → `archived`; empty plans still rewrite the file and append a timeline event. That is not acceptable.

| Current | Required |
| --- | --- |
| Trigger: total row count ≥ 30, every dispose | Trigger: after admit/backfill, and only if housekeeping actually changes a row |
| Jaccard merge **drops** the loser | Forbidden on the automatic path |
| `status=reinforced` + importance +0.05 | Forbidden; treat existing `reinforced` as `active` |
| Archive by low importance × age | Too weak and wrong; archive only rule-gate changelog hits |
| Count includes archived, so it never “cools down” | Do not use row count as a trigger |
| Timeline even when 0/0 | Timeline only when `changed === true` |

### 10.2 One function: `housekeepMemories(rows)`

Deterministic, no LLM. Returns `{ rows, changed, actions }`.

1. `backfillMemoryStatuses` — changelog genre / `type=change` → `archived` (`archiveReason=backfill_rule`). Rows are kept.
2. `enforceCoreCap(rows, { pinnedIds })` — excess `active` → `dormant`. This-turn admits are pinned. Never delete, never truncate text.
3. Collect **suggestions only** (not applied automatically): same-type title Jaccard ≥ 0.85 pairs among active+dormant → `suggest_supersede`. A human or a later explicit `project_memory_supersede` may act; auto-dream must not.

`changed` is true iff any `status` / `updatedAt` / `archiveReason` mutated. If false: do not `writeJsonl`, do not append timeline.

### 10.3 When it runs

**Automatic (session dispose, after extracts are admitted):** call `housekeepMemories`. Persist only on change. This replaces the ≥30 auto-dream block. No extra threshold.

**Manual (`project_dream`):** keep the tool and Dashboard「整理记忆」.

- `dryRun=true` (default): return `actions` (applied-if-commit: `archive_rule`, `evict_to_dormant`; informational: `suggest_supersede`). No file writes.
- `dryRun=false`: apply the same as `housekeepMemories` (steps 1–2 only). Still do **not** apply Jaccard deletes or auto-supersede.
- `mode=full` must **not** physically remove `archived` rows in v1. Durable facts stay recoverable. Vacuum of archived changelog is out of scope.

### 10.4 Non-goals for Dream

- LLM rewrite / cluster / “promote dormant back to Core”
- Vector-similarity merge
- Cross-project archive
- Using Dream as a substitute for `admitMemory`

## 11. Module map

New: `src/host/memory/admit.js` — `ruleGate`, `admitMemory`, `enforceCoreCap`, `backfillMemoryStatuses`, fingerprint/conflict helpers.

Touch:

- `src/tools/diff.js` — default dryRun true; mock forbidden; writes only via `admitMemory`
- `src/host/suggest.js` — `isCoreMemory` + same Core sort as list, not old `memoryScore` Top-K on all non-archived
- `src/host/memory/session-extractor.js` — `durable` field; no change-memory fallback in summarizer
- `src/host/summarizer.js` — drop git `type=change` memory; call admit; replace ≥30 Jaccard auto-dream with `housekeepMemories` (write only if changed)
- `src/host/realtime-memory.js` — strong signals only; init guard; remember-signal bypasses git blacklist; `admitMemory` with `user_explicit`
- `src/tools/memory.js` — add/list/archive/supersede go through admit; list layer filter
- `src/host/injector.js` — shared assembler; prompt text; core-only
- `src/tools/continue.js` + `brain-logic.js` `buildContinueData` — same assembler
- `src/host/memory/retrieval.js` — ask path only; injector must not call it for empty-query Top-K
- `src/host/store/brain-logic.js` — status helpers, type allow-list, stop using `change` as a first-class memory type for new writes
- `src/tools/dream.js` / `computeDreamActions` / `applyDreamCommit` — stop merge-and-drop; dry-run reports housekeep + suggest_supersede; commit = housekeep only
- `src/host/sidebar/aggregator.js` — dashboard filtering
- smoke tests listed in §13, including grep that `memory.jsonl` appends only live in `admit.js`

Do not add a new database, graph store, or MemGPT-style per-turn core editor.

## 12. Failure table

| Condition | Behavior |
| --- | --- |
| Not initialized | All memory writes refuse; realtime returns skip; summarizer skip (already) |
| Rule fail | No memory row |
| LLM down on automatic write | No memory row; session summary may still be empty; user_explicit still writes if rules pass |
| JSONL write fail | `ok: false`, no fake success |
| Embedding fail | Ask BM25; inject unchanged |
| Duplicate fingerprint | No second row |
| Housekeep no-op | No jsonl rewrite, no dream timeline event |
| Title-similar old rows at dispose | Not deleted; may appear as `suggest_supersede` only |
| Title-similar insert | Both stay active/dormant; suggestion only |
| Mock LLM in `project_diff` | No memory row |
| Strong remember + git words | Still admitted if durable |

## 13. Tests

All without a live LLM (mock confirm).

- Rule gate: version title, `patch` title, file-list body, `本次 session 改动 N 个文件`, type `change`/`issue` routing, `context` without user_explicit rejected, user_explicit context accepted if durable
- Uninitialized: realtime and `memory_add` do not create files
- Channel: user_explicit persist with LLM mock throwing; `memory_add` with LLM unavailable → no row; `memory_add` with `admit: false` → no row
- Conflict: explicit `supersedes` id marks old `superseded`; Jaccard-only pair does not
- Cap: 16th durable insert demotes an **older** low-importance active to dormant; a this-turn pinned row stays active
- `project_diff` dry-run default; mock output writes 0 rows; real output goes through admit
- Grep: no `memory.jsonl` append outside `admit.js` in `src/`
- `suggest.js` evidence memories are core-only
- Remember signal containing “commit” still admits
- Lesson starting with `刚才` + standing fact is not rule-rejected
- Injector vs continue: same assembler output for same fixture
- Backfill: `v1.2.0 patch` title → archived
- Summarizer: no LLM memories and git files present → timeline only, zero `type=change` memory
- Ask: dormant hit by keyword; archived not hit by default
- Retrieval: empty query is not used for injection; optional vector failure leaves BM25
- Housekeep: changelog title → archived, row still present; 16th active → dormant; two similar titles → not dropped on auto path; no-op does not write
- `project_dream` dry-run default; commit does not Jaccard-delete
- Removed: auto-dream on `length >= 30` with merge-and-drop

## 14. Out of scope

- Replacing jsonl
- Per-turn LLM-managed Core (MemGPT)
- Storing raw chat as memory
- Removing the embedding settings UI
- Human review queue for every write
- Changing architecture **scan/display** except that `project_diff` memory writes must pass admit (no mock commit)
- LLM / vector / idle-time “dreaming” that rewrites or promotes memories
- Physically deleting archived rows (`mode=full` vacuum)

## 15. Implementation order

1. `admit.js` + status helpers + unique-writer grep tests + rules/cap/backfill/pinned eviction
2. Wire **every** writer: tools/memory, realtime, summarizer/extractor, **diff**, dream housekeep
3. Shared injection assembler; switch continue/injector/**suggest**/dashboard to `isCoreMemory`
4. Ask/list filters; stop injector using retrieveMemories
5. Smoke/acceptance count updates
