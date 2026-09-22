# Grill: Durable Core Memory
Date: 2026-09-15

## Intent
Build a stable long-term project memory so future sessions can maintain the project. Existing `memory.jsonl` rows are development noise and are not assets.

Locked product bar: each new session continues like the same practitioner — standing decisions in Core, last recap + TODOs for continuity. Not a goal: recalling every historical module convention without ask.

## Constraints
- Precision over recall; rules veto LLM.
- Local jsonl stays the fact store.
- Uninitialized projects must not be written.
- Core must always fit in the prompt (hard cap, no silent truncate).
- Do not delete the embedding settings UI; do not make vectors the reliability path.

## Key decisions
- Decision: Only durable facts qualify as memory (not changelogs). Reason: current jsonl is mostly release notes. Alternative: capture-all and rank.
- Decision: Rules veto + LLM confirm on automatic writes only; user “记住” skips LLM. Reason: reliability without blocking explicit remember. Alternative: LLM on every write, or rules-only for agent tools.
- Decision: `project_memory_add` is automatic, not explicit. Reason: almost all junk came from the agent tool. Alternative: treat tool writes as explicit.
- Decision: Existing corpus is not precious; rule-hard-hits auto-archive. Reason: still in development. Alternative: manual review of all 19 rows.
- Decision: Inject Core (all active) + last session summary from timeline. Reason: continue fidelity without stuffing recap into memory. Alternative: Core only, or old Top-K dump.
- Decision: Core cap 15 items / ~800 tokens; overflow to `dormant`; conflict via `superseded`. Reason: unbounded core recreates prompt pollution. Alternative: Top-K at inject time.
- Decision: Three statuses active / dormant / archived (plus superseded). Reason: eviction ≠ rejection. Alternative: single archived flag.
- Decision: Memory types decision/requirement/architecture/bug/lesson; change→timeline; issue→todo; context only for user_explicit. Reason: narrow door. Alternative: keep 8 types.
- Decision: Ask defaults to BM25 on active+dormant; vectors optional for ask only. Reason: small corpus; stop dual scoring. Alternative: RRF as primary, or delete embeddings.
- Decision: Implement Durable Core on current jsonl (approach 1), not a minimal blacklist patch and not MemGPT. Reason: compatible and testable.

## Surfaced assumptions
- Session-end LLM extract can carry `durable` in the same JSON object (no second call).
- Git file lists are evidence, not memories.
- Dashboard can hide archived by default without a redesign.

## Open questions
None blocking implementation. Constants (15 / 800 / 600) are v1 code constants, not user settings.

## Out of scope
Replacing jsonl; per-turn LLM core editing; storing raw chat; removing embedding settings; human approve-queue for every write; architecture scanner rewrite.
