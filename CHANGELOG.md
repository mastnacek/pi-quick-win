# Changelog

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