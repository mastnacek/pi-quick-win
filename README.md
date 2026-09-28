# pi-quick-win

Names the **smallest independently shippable increment** when a task lands, lets you choose
**deliver now / later / skip**, and closes the loop only on real, verified delivery.

Long agent tasks announce activity ("searched 12 files, edited 3 modules") and nothing else.
The value shows up at the end, so the middle feels like waiting rather than working.
`pi-quick-win` puts one screen in front of you at the moment the task arrives: what the nearest
real win is, what it costs, and how we will know it is done.

No score. No streak. No badges. Just the smallest piece of work that is worth delivering, named early.

## Install

```bash
pi install git:github.com/mastnacek/pi-quick-win
```

## What it does

- **`quick_win` tool** — the agent announces one card: `title`, `impact`, `effort`, ordered `steps`, and a mandatory
  `proof` (how we know it is done). In the TUI you get an overlay card — accent frame, emoji-labelled fields, the
  active choice highlighted — with three choices.
  An increment without a verifiable proof is rejected before it is ever shown.
- **`quick_win_done` tool** — the agent closes the loop with concrete evidence. This is the only thing that produces
  the closing echo, and it refuses when nothing was approved or the evidence is empty.
- **No cap on cards** — a long session keeps landing new increments, and every one of them may be announced.
  The model, not a wall, decides what counts as *new*; a finite cap is available when you want one.
- **`later` queue** — deferred wins are stored as session entries (zero model tokens), survive `/reload` and
  compaction, and show as `quick-win: N later` in the statusline.
- **Visible state** — a muted plugin shows `quick-win: off` on the statusline from session start, and the
  completion menu marks the value in effect (`on ✓` / `off ✓` with ` · ● AKTIVNÍ`). No `/quick-win info` needed.
- **Silent outside the TUI** — in `--mode json`, `--mode print` and `--mode rpc` no card and no statusline are
  painted; the increment is handed to the agent anyway.

## Choices

| Choice | What happens |
| --- | --- |
| `deliver now` | The agent implements exactly that increment and must not widen the scope. |
| `later` | Recorded in the session; visible as a statusline count and via `/quick-win later`. |
| `skip` | Nothing recorded, no echo, the card simply closes. |

Keys: `↑`/`↓` select, `enter` confirms, `esc` closes. Those are the only keys the card answers to — a shortcut it
does not show is a hidden affordance, which is why the `1`-`3` rows of earlier versions are gone.

With `/quick-win lang cs` the whole card UI — the three choices, the field labels, the effort unit and the footer —
renders in Czech. The model-facing tool result stays English in every locale.

## Commands

| Command | Effect |
| --- | --- |
| `/quick-win info` | State: enabled/muted, echo, card limit, deferred count, cards in this task. |
| `/quick-win later` | List the deferred quick wins. |
| `/quick-win clear` | Empty the deferred list. |
| `/quick-win off` / `on` | Mute / unmute. |
| `/quick-win off --global` | Same, persisted for all sessions instead of this project. |
| `/quick-win limit <n\|unlimited>` | Cards allowed per task. `unlimited` (the default) is `0`; a new prompt resets the counter. |
| `/quick-win lang <cs\|en>` | Language of the card UI (choices, field labels, footer). English by default. |

## Configuration

Cascade, nearest layer wins:

1. defaults — `enabled: true`, `echo: true`
2. `~/.pi/agent/pi-quick-win.json` — all sessions
3. `<cwd>/.pi/pi-quick-win.json` — this project

A setting command persists **only the key it changed**, so a project file created to mute the plugin never freezes
the other (inherited) values. Keys: `enabled`, `echo`.

## Design constraints (deliberate)

- **`proof` is mandatory.** An unverifiable increment is a promise, not a win.
- **No gamification.** No points, streaks, ranks or productivity metrics — external rewards displace intrinsic
  motivation, so the reward here is the delivered increment itself.
- **The closing echo is true or absent.** It fires only for an approved increment closed with evidence, and lasts
  one turn.
- **Token budget.** The agent-facing policy is a two-line prompt snippet plus two guidelines (asserted under
  600 chars in the test suite). The psychology behind the design stays in the PRD, not in your context window.
- **Not a planner.** It does not replace `/goal`, a todo list, or a backlog. One card per decision, announced
  when a new increment actually lands.

## Development

```bash
npm test          # 53 tests: card kernel, tools, overlay + styling, deferred queue, commands, integration
npx tsc --noEmit  # type check
```

Layout is vertical slices (`src/slices/*`) over a shared kernel (`src/shared/*`). Slices never import each other;
the composition root (`index.ts`) injects cross-slice dependencies.