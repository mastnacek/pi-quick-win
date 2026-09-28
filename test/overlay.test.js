/**
 * Overlay slice — the gate that keeps terminal UI out of json/print/rpc, and
 * the width safety of the rendered card.
 *
 * This is the layer where "no UI in non-TUI modes" is actually decided, so it
 * is tested here against the real presenter rather than through a stub.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import { presentCard } from "../src/slices/overlay/index.js";
import { validateCard } from "../src/shared/card.js";
import { makeCtx, validCard } from "./fakes.js";

const CARD = validateCard(validCard({ alternative: "Only the parser, not the printer" }));

/** A theme with no styling, so width assertions measure real content. */
const PLAIN_THEME = { fg: (_color, text) => text, bold: (text) => text };

/** Drive the component the way Pi does: build it, feed keys, read the result. */
async function driveCard(keys, width = 72) {
  let component;
  const ctx = makeCtx({
    mode: "tui",
    ui: {
      setStatus: () => {},
      notify: () => {},
      custom: async (factory) => {
        return await new Promise((resolve) => {
          component = factory(undefined, PLAIN_THEME, undefined, resolve);
        });
      },
    },
  });

  const promise = presentCard(ctx, CARD);
  for (const key of keys) {
    component.handleInput(key);
    await Promise.resolve();
  }
  return { result: await promise, component };
}

test("json, print and rpc never open a terminal component", async () => {
  for (const [mode, hasUI] of [
    ["json", false],
    ["print", false],
    ["rpc", true],
  ]) {
    let customCalls = 0;
    const ctx = makeCtx({
      mode,
      hasUI,
      ui: {
        setStatus: () => {},
        notify: () => {},
        custom: async () => {
          customCalls += 1;
          return "deliver_now";
        },
      },
    });

    assert.equal(await presentCard(ctx, CARD), null, `${mode} must yield no choice`);
    assert.equal(customCalls, 0, `${mode} must not call ctx.ui.custom()`);
  }
});

test("a UI failure degrades to no choice instead of costing the turn", async () => {
  const ctx = makeCtx({
    mode: "tui",
    ui: {
      setStatus: () => {},
      notify: () => {},
      custom: async () => {
        throw new Error("terminal went away");
      },
    },
  });

  assert.equal(await presentCard(ctx, CARD), null);
});

test("enter confirms the highlighted choice, and arrows move it", async () => {
  const direct = await driveCard(["\r"]);
  assert.equal(direct.result, "deliver_now", "the first row is highlighted by default");

  const moved = await driveCard(["\u001b[B", "\r"]);
  assert.equal(moved.result, "later", "down moves one row before enter");

  const wrapped = await driveCard(["\u001b[A", "\r"]);
  assert.equal(wrapped.result, "skip", "up wraps to the last row");
});

test("digits pick a choice directly and escape means skip", async () => {
  assert.equal((await driveCard(["3"])).result, "skip");
  assert.equal((await driveCard(["2"])).result, "later");
  assert.equal((await driveCard(["\u001b"])).result, "skip", "escape is the honest 'not today'");
});

test("every rendered line fits the width it was given", async () => {
  for (const width of [24, 40, 71, 72, 120]) {
    const { component } = await driveCard(["\u001b"], width);
    const lines = component.render(width);
    assert.ok(lines.length > 0, "the card renders something");
    for (const line of lines) {
      assert.ok(
        visibleWidth(line) <= width,
        `line wider than ${width} (${visibleWidth(line)}): ${JSON.stringify(line)}`,
      );
    }
  }
});

test("the card shows the impact, the proof and the alternative cut", async () => {
  const { component } = await driveCard(["\u001b"], 72);
  const body = component.render(72).join("\n");

  assert.match(body, /Ship the width-safe overlay frame/);
  assert.match(body, /npm test -- context-bar/, "the proof must be on the card, not only in the tool text");
  assert.match(body, /Other cut/);
  assert.match(body, /deliver now/);
});