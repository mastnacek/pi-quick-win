/**
 * Integration — the composition root wired for real: no injected stubs, the
 * actual overlay gate, the actual config cascade, the actual session entries.
 *
 * This is where the acceptance criteria are proven end to end:
 * §9.2 the choice comes back to the model, §9.3 `later` survives a reload,
 * §9.4 non-TUI modes stay silent, §9.6 the mute switch silences everything.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import quickWin from "../index.js";
import { makeCtx, makePi, textOf, validCard } from "./fakes.js";

/** Boot the extension against a fake engine and return its wiring. */
function boot({ cwd } = {}) {
  const pi = makePi();
  quickWin(pi);
  return pi;
}

/** A context whose overlay answers immediately with `choice`. */
function autoChoiceCtx(pi, choice, over = {}) {
  const overlayCalls = [];
  const ctx = makeCtx({
    cwd: over.cwd ?? process.cwd(),
    mode: over.mode ?? "tui",
    hasUI: over.hasUI ?? true,
    ui: {
      setStatus: (id, text) => ctx.statusCalls.push({ id, text }),
      notify: (message, level) => ctx.notes.push({ message, level }),
      select: async () => undefined,
      custom: async (factory) => {
        overlayCalls.push(true);
        return await new Promise((resolve) => {
          const component = factory(
            undefined,
            { fg: (_c, text) => text, bold: (text) => text },
            undefined,
            resolve,
          );
          // A user picking a row: drive the real key handler, no shortcuts.
          component.handleInput(["1", "2", "3"][["deliver_now", "later", "skip"].indexOf(choice)]);
        });
      },
    },
    sessionManager: { getEntries: () => pi.entries },
  });
  ctx.overlayCalls = overlayCalls;
  return ctx;
}

async function fire(pi, event, ctx) {
  for (const handler of pi.handlers.get(event) ?? []) {
    await handler({}, ctx);
  }
}

async function run(pi, name, params, ctx) {
  return await pi.tools.get(name).execute("call-1", params, undefined, undefined, ctx);
}

test("json mode: no overlay, no statusline, increment still handed over", async () => {
  const pi = boot();
  const ctx = autoChoiceCtx(pi, "skip", { mode: "json", hasUI: false });
  await fire(pi, "session_start", ctx);

  const result = await run(pi, "quick_win", validCard(), ctx);

  assert.equal(ctx.overlayCalls.length, 0, "json must never open the card");
  assert.equal(ctx.statusCalls.length, 0, "json must never paint a statusline");
  assert.equal(result.details.ui, false);
  assert.equal(result.details.choice, "deliver_now", "without a chooser, work proceeds");
});

test("tui: choosing later appends it to the session and shows the count", async () => {
  const pi = boot();
  const ctx = autoChoiceCtx(pi, "later");
  await fire(pi, "session_start", ctx);

  const result = await run(pi, "quick_win", validCard({ title: "Parser first" }), ctx);

  assert.equal(result.details.choice, "later");
  assert.equal(result.details.ui, true);
  assert.equal(pi.entries.length, 1, "the deferred card must be written to the session");
  assert.equal(pi.entries[0].data.title, "Parser first");
  assert.ok(
    ctx.statusCalls.some((call) => call.text === "later: 1"),
    `expected a later badge, got ${JSON.stringify(ctx.statusCalls)}`,
  );
});

test("tui: deliver_now does not defer, and the echo closes only on evidence", async () => {
  const pi = boot();
  const ctx = autoChoiceCtx(pi, "deliver_now");
  await fire(pi, "session_start", ctx);

  await run(pi, "quick_win", validCard({ title: "Width-safe frame" }), ctx);
  assert.equal(pi.entries.length, 0, "delivering is not deferring");

  const closed = await run(pi, "quick_win_done", { evidence: "npm test → 39/39" }, ctx);
  assert.equal(closed.details.echo, true);
  assert.ok(ctx.statusCalls.some((call) => call.text === "✓ Width-safe frame"));

  // The echo is a moment: the next turn clears it back to the deferred count.
  await fire(pi, "turn_start", ctx);
  assert.equal(ctx.statusCalls.at(-1).text, undefined, "the echo does not linger");
});

test("a reload rebuilds the deferred queue from session history alone", async () => {
  const first = boot();
  const firstCtx = autoChoiceCtx(first, "later");
  await fire(first, "session_start", firstCtx);
  await run(first, "quick_win", validCard({ title: "Parser first" }), firstCtx);
  // One card per task: a new user prompt re-arms the limit.
  await fire(first, "input", firstCtx);
  await run(first, "quick_win", validCard({ title: "Then the CLI" }), firstCtx);
  assert.equal(first.entries.length, 2, "both deferred cards are in the session");

  // Reload: a brand new extension instance, reading the same entries.
  const second = boot();
  second.entries.push(...first.entries);
  const secondCtx = autoChoiceCtx(second, "skip");
  await fire(second, "session_start", secondCtx);

  await run(second, "quick_win", validCard({ title: "Something else" }), secondCtx);
  const info = await second.commands.get("quick-win").handler("info", secondCtx);
  void info;

  assert.ok(
    secondCtx.statusCalls.some((call) => call.text === "later: 2"),
    `expected both deferred wins back, got ${JSON.stringify(secondCtx.statusCalls)}`,
  );
});

test("the mute switch in the project config silences cards after a reload", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "pi-quick-win-int-"));
  mkdirSync(join(cwd, ".pi"), { recursive: true });
  writeFileSync(join(cwd, ".pi", "pi-quick-win.json"), JSON.stringify({ enabled: false }), "utf8");

  const pi = boot();
  const ctx = autoChoiceCtx(pi, "deliver_now", { cwd });
  await fire(pi, "session_start", ctx);

  const result = await run(pi, "quick_win", validCard(), ctx);

  assert.equal(ctx.overlayCalls.length, 0, "muted means no card, whatever the mode");
  assert.equal(result.details.muted, true);
  assert.match(textOf(result), /muted/);
});

test("shutdown drains every listener and releases the status slot", async () => {
  const pi = boot();
  const ctx = autoChoiceCtx(pi, "deliver_now");
  await fire(pi, "session_start", ctx);

  assert.ok(pi.handlers.get("input")?.length > 0, "the pipeline subscribed");

  for (const handler of pi.handlers.get("session_shutdown") ?? []) {
    await handler({}, ctx);
  }

  assert.ok(
    ctx.statusCalls.some((call) => call.text === undefined),
    "shutdown must clear the shared status slot",
  );
});