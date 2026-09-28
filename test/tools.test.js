/**
 * Tool behaviour — the acceptance criteria that are about *behaviour*, not
 * text: the choice is what comes back (§9.2), non-TUI modes stay silent (§9.4),
 * the mute switch silences everything (§9.6), and the echo fires only on real
 * verified delivery (§9.5).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { registerQuickWinTools } from "../src/slices/tools/index.js";
import { registerPipeline } from "../src/slices/pipeline/index.js";
import { callTool, makeCtx, makePi, makeState, textOf, validCard } from "./fakes.js";

/**
 * Register tools and the pipeline with recording deps.
 *
 * `present` stands in for the overlay slice, so these tests are about the tool's
 * contract with a presenter — including `null`, which means "no interactive
 * surface here". The real gate (mode/hasUI) is covered in overlay.test.js and
 * end to end in integration.test.js.
 */
function setup({ state: stateOver = {}, present = async () => "deliver_now", ctx: ctxOver = {} } = {}) {
  const pi = makePi();
  const state = makeState(stateOver);
  const ctx = makeCtx(ctxOver);
  const recordCalls = [];
  const presentCalls = [];

  registerPipeline(pi, state);
  registerQuickWinTools(pi, state, {
    presentCard: async (_ctx, card) => {
      presentCalls.push(card.title);
      return await present(_ctx, card);
    },
    recordLater: (_pi, _state, card) => {
      recordCalls.push(card.title);
      return 1;
    },
  });

  return {
    pi,
    state,
    ctx,
    presentCalls,
    recordCalls,
    card: pi.tools.get("quick_win"),
    done: pi.tools.get("quick_win_done"),
  };
}

test("the TUI choice is what flows back to the model", async () => {
  for (const [present, expected] of [
    [async () => "deliver_now", "deliver_now"],
    [async () => "later", "later"],
    [async () => "skip", "skip"],
  ]) {
    const t = setup({ present });
    const result = await callTool(t.card, validCard(), t.ctx);

    assert.equal(result.details.choice, expected);
    assert.equal(result.details.ui, true, "the card was shown, so ui must be true");
    assert.match(textOf(result), new RegExp(expected === "deliver_now" ? "exactly this increment" : "announc\\w* another"));
  }
});

test("a presenter without an interactive surface hands the increment over silently", async () => {
  const t = setup({ present: async () => null });
  const result = await callTool(t.card, validCard(), t.ctx);

  assert.equal(result.details.choice, "deliver_now", "null means deliver without asking");
  assert.equal(result.details.ui, false);
  assert.equal(t.ctx.statusCalls.length, 0);
  assert.match(textOf(result), /exactly this increment/);
});

test("the mute switch silences cards entirely", async () => {
  const t = setup({ state: { config: { enabled: false, echo: true } } });
  const result = await callTool(t.card, validCard(), t.ctx);

  assert.equal(t.presentCalls.length, 0, "muted must not open a card");
  assert.equal(result.details.muted, true);
  assert.equal(result.details.ui, false);
  assert.match(textOf(result), /muted/);
});

test("no cap by default — a long session keeps announcing new increments", async () => {
  const t = setup();
  await callTool(t.card, validCard(), t.ctx);
  const second = await callTool(t.card, validCard({ title: "Another win" }), t.ctx);

  assert.equal(t.presentCalls.length, 2, "cardLimit 0 means the overlay may open again");
  assert.equal(second.details.duplicate, undefined);
  assert.match(textOf(second), /exactly this increment/);
});

test("a finite card limit makes the next call stand down", async () => {
  const t = setup({ state: { config: { enabled: true, echo: true, cardLimit: 1 } } });
  await callTool(t.card, validCard(), t.ctx);
  const second = await callTool(t.card, validCard({ title: "Another win" }), t.ctx);

  assert.equal(t.presentCalls.length, 1, "the overlay must not reopen past the cap");
  assert.equal(second.details.duplicate, true);
  assert.match(textOf(second), /limit/i);
});

test("a new user prompt resets the card counter", async () => {
  const t = setup({ state: { config: { enabled: true, echo: true, cardLimit: 1 } } });
  await callTool(t.card, validCard(), t.ctx);

  for (const handler of t.pi.handlers.get("input") ?? []) {
    await handler({}, t.ctx);
  }

  await callTool(t.card, validCard({ title: "Next task" }), t.ctx);
  assert.equal(t.presentCalls.length, 2, "a new task gets a fresh card budget");
});

test("later records the card and paints the deferred count", async () => {
  const t = setup({ present: async () => "later" });
  await callTool(t.card, validCard(), t.ctx);

  assert.deepEqual(t.recordCalls, ["Ship the width-safe overlay frame"]);
  assert.ok(t.ctx.statusCalls.length > 0, "the deferred count must be visible");
});

test("skip records nothing and approves nothing", async () => {
  const t = setup({ present: async () => "skip" });
  const result = await callTool(t.card, validCard(), t.ctx);

  assert.equal(t.recordCalls.length, 0);
  assert.equal(t.state.pendingEcho, undefined, "skip must not arm the echo");
  assert.equal(result.details.choice, "skip");
});

test("deliver_now arms the echo; nothing else does", async () => {
  const delivered = setup({ present: async () => "deliver_now" });
  await callTool(delivered.card, validCard(), delivered.ctx);
  assert.equal(delivered.state.pendingEcho?.title, "Ship the width-safe overlay frame");

  const skipped = setup({ present: async () => "skip" });
  await callTool(skipped.card, validCard(), skipped.ctx);
  assert.equal(skipped.state.pendingEcho, undefined);
});

test("the echo fires once, only with evidence, only for an approved win", async () => {
  const t = setup({ present: async () => "deliver_now" });

  // No approval yet: the close must not celebrate.
  const early = await callTool(t.done, { evidence: "ran the tests" }, t.ctx);
  assert.equal(early.details.echo, false);
  assert.equal(early.details.reason, "no-pending-win");
  assert.equal(t.ctx.statusCalls.length, 0);

  await callTool(t.card, validCard(), t.ctx);
  const closed = await callTool(t.done, { evidence: "npm test → 21/21 pass" }, t.ctx);

  assert.equal(closed.details.echo, true);
  assert.equal(closed.details.title, "Ship the width-safe overlay frame");
  assert.equal(t.state.pendingEcho, undefined, "the win is consumed, so it cannot echo twice");
  assert.equal(t.ctx.statusCalls.filter((c) => c.text?.startsWith("✓")).length, 1);

  const again = await callTool(t.done, { evidence: "still true" }, t.ctx);
  assert.equal(again.details.echo, false, "a second close cannot re-celebrate");
});

test("empty evidence is an error, not a quiet celebration", async () => {
  const t = setup({ present: async () => "deliver_now" });
  await callTool(t.card, validCard(), t.ctx);

  await assert.rejects(() => callTool(t.done, { evidence: "   " }, t.ctx), /'evidence' is required/);
  assert.equal(t.ctx.statusCalls.filter((c) => c.text?.startsWith("✓")).length, 0);
  assert.ok(t.state.pendingEcho, "a failed close must not consume the pending win");
});

test("an invalid card throws instead of rendering", async () => {
  const t = setup();
  await assert.rejects(() => callTool(t.card, validCard({ proof: "" }), t.ctx), /'proof' is required/);
  assert.equal(t.presentCalls.length, 0);
});

test("the tool tells the model when to call it, in three guidelines", () => {
  const { card } = setup();
  assert.match(card.promptSnippet, /quick_win/);
  const guidelines = card.promptGuidelines;
  assert.equal(guidelines.length, 3);
  assert.match(guidelines[0], /non-trivial increment lands/);
  assert.match(guidelines[1], /genuinely new increment/, "a later card is allowed, a repeat is not");
  assert.match(guidelines[2], /verified/);
});

test("the prompt surface stays inside its token budget", () => {
  const { card } = setup();
  const policy = [card.promptSnippet, ...card.promptGuidelines].join("\n");

  // PRD §6: the policy may cost ~150 tokens at most. Tool *schemas* are the
  // standard price of any tool; this budget covers the policy text itself.
  assert.ok(policy.length <= 600, `policy grew to ${policy.length} chars, budget is 600`);
});