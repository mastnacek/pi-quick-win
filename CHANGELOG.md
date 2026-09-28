# Changelog

## 0.4.1 — 2026-09-28

**Changed**
- The card header now names the build that rendered it: `⚡ QUICK WIN v<version>`. A card from a stale runtime used to look exactly like a card from the code you are reading; the version turns "is this the new build?" into a one-glance question. The version is read from `package.json` through `import.meta.url`, so it resolves the same on Windows and POSIX, and a missing manifest degrades to `unknown` instead of breaking the card.
- Two regression tests: the header version equals `package.json`, and no choice row or footer line contains a digit at all (the card is a menu, not a numbered list).


## 0.4.0 — 2026-09-28

**Changed**
- **The card is a menu again.** The `1 2 3` prefixes and the `1-3 pick` footer hint are gone: they were a hidden digit
  shortcut that read as a numbered list. The card now answers only to what it advertises — `↑↓` to move, `⏎`/Enter to
  confirm, `esc` to close. The `1`/`2`/`3`, `q`, `j` and `k` key handlers are removed, so no behaviour is hidden
  behind a key the card never shows.
- The choice hints and the footer word for `esc` are now truthful: with no card cap, `skip` records nothing rather
  than "stop asking in this task".
- **Czech UI vocabulary** (`/quick-win lang cs`): the three choices, the field labels, the effort unit and the footer
  render in Czech, so the plugin's own UI and the translated card body speak the same language. English stays the
  default, and the model-facing tool result stays English in every locale — the agent keeps working in English.

**Added**
- `src/shared/i18n.ts`: `Locale`, an `en`/`cs` string table, `stringsFor()`, `normalizeLocale()`.
- `lang` in the config cascade, `/quick-win lang <cs|en> [--global]` with a two-level completion menu marking the
  value in effect. An unknown locale is a typo: it is refused with a usage line, never written to disk; an
  unparsable value in a config file falls back to English.
- 5 new tests (63 total): the menu ignores digits, the Czech render, the unknown-locale fallback, the `lang`
  completion level, and the partial-key persistence path.

## 0.3.0 — 2026-09-28

**Changed**
- **The one-card-per-task wall is gone.** An all-day session now announces every new increment instead of being
  silenced after the first card. The state is a counter (`cardsShownThisTask`) compared against a new
  `config.cardLimit`, and `0` — the default — means unlimited, so nagging is prevented by the model's judgement
  (a third prompt guideline: again only for a genuinely new increment) instead of a hard refusal.
- `/quick-win info` reports the limit and the number of cards in this task instead of a yes/no.

**Added**
- `/quick-win limit <n|unlimited> [--global]`, persisted through the same config cascade (only the changed key is
  written), with a two-level completion menu that marks the leaf in effect (`3 ✓` + ` · ● AKTIVNÍ`).
- `normalizeConfig` in the shared config module: an unparsable, negative or fractional `cardLimit` becomes
  unlimited, never 1 — a broken config must not silence the plugin.
- 5 new tests (58 total): no-cap default, finite cap, counter reset on a new prompt, the `limit` completion
  levels, partial-key persistence, and the junk-config fallback.

## 0.2.0 — 2026-09-28

**Changed**
- The card is now a notification instead of a debug dump. Rounded accent frame, a `⚡ QUICK WIN` header with the
  effort badge (`⏱ hour`) right-aligned, emoji-labelled field column (`🎯 Impact`, `✅ Proof`, `📋 Steps`,
  `🔀 Other cut`, `⏱ Effort`) with per-field colors, dim separator rules instead of blank lines, a
  full-width `selectedBg` highlight on the active choice with an accent `▸` and key digit, and a footer whose
  key glyphs (`↑↓ 1-3 ⏎ esc`) are colored while the words stay dim.
- Every line is still clamped to the supplied width, padding is still computed on *visible* width (emoji are two
  cells), and the plain-text card in the tool result is untouched — the model still reads a clean, emoji-free card.

**Added**
- 2 render tests: one asserts the styling contract (emoji labels, accent/success colors, exactly one highlighted
  row, bold header), one asserts the effort falls back into the body when a narrow terminal leaves no room in the
  header. 53 tests total.

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