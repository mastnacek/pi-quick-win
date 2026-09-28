# Changelog

## 0.1.1 — 2026-09-28

**Fixed**
- The plugin now signals its configuration at first glance. A muted plugin paints `quick-win: off` on the
  statusline from session start (silent and broken used to look identical), and `/quick-win` completions mark the
  value in effect — `on ✓` / `off ✓` plus ` · ● AKTIVNÍ`, read live at completion time, never from a snapshot.
- Completion filtering matched the annotated label instead of the bare token, so `--global ` offered only `off`.
- Subagent recursion guard: the extension returns early when `PI_SUBAGENT` or `PI_CHILD_SESSION` is set, so child
  sessions register no tools, commands or hooks.

## 0.1.0 — 2026-09-28

First slice: the card, the choice, and the truthful close.

**Added**
- `quick_win` tool — announces one card (`title`, `impact`, `effort`, `steps`, mandatory `proof`), renders a
  centred overlay in the TUI with `deliver now / later / skip`, and returns the typed choice to the model.
- `quick_win_done` tool — closes an approved increment with evidence; the only source of the closing echo.
- One-card-per-task limit, re-armed by the next user prompt.
- Deferred (`later`) queue persisted as session entries: survives `/reload` and compaction at zero model-token cost,
  with a `later: N` statusline badge.
- `/quick-win [info|later|clear|on|off] [--global]` with trailing-space-contract completions.
- Config cascade (`defaults ← ~/.pi/agent/ ← <cwd>/.pi/`), partial-key saves, mute switch.
- Silent behaviour outside the TUI (`json`, `print`, `rpc`): no card, no statusline, work proceeds.
- 46 tests: card kernel, tool contract, overlay width safety and key handling, deferred queue + restore,
  commands/completions, and end-to-end integration through the composition root.

**Deliberately not in this slice**
- Optional sound / TTS close (channel integration with `pi-tui-sound` / `pi-tts`). Text echo only for now.
- Interactive choice in RPC mode (dialogs exist there, but the card surface is terminal-only by design).
- Any scoring, streak, badge or statistic — permanently out of scope, not merely deferred.