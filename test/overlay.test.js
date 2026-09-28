/**
 * Overlay slice — the gate that keeps terminal UI out of json/print/rpc, and
 * the width safety of the rendered card.
 *
 * This is the layer where "no UI in non-TUI modes" is actually decided, so it
 * is tested here against the real presenter rather than through a stub.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { visibleWidth } from "@earendil-works/pi-tui";
import { presentCard, measureCard, MIN_CARD_HEIGHT } from "../src/slices/overlay/index.js";
import { CardView } from "../src/slices/overlay/card-view.js";
import { stringsFor } from "../src/shared/i18n.js";
import { validateCard } from "../src/shared/card.js";
import { makeCtx, validCard } from "./fakes.js";

const CARD = validateCard(validCard({ alternative: "Only the parser, not the printer" }));

/** A theme with no styling, so width assertions measure real content. */
const PLAIN_THEME = { fg: (_color, text) => text, bg: (_color, text) => text, bold: (text) => text };

/** A theme that records what it was asked to paint, for the styling assertions. */
function makeRecordingTheme() {
  const calls = { fg: [], bg: [], bold: 0 };
  return {
    calls,
    theme: {
      fg: (color, text) => {
        calls.fg.push(color);
        return text;
      },
      bg: (color, text) => {
        calls.bg.push(color);
        return text;
      },
      bold: (text) => {
        calls.bold += 1;
        return text;
      },
    },
  };
}

/** Drive the component the way Pi does: build it, feed keys, read the result. */
async function driveCard(keys, width = 72, theme = PLAIN_THEME) {
  let component;
  const ctx = makeCtx({
    mode: "tui",
    ui: {
      setStatus: () => {},
      notify: () => {},
      custom: async (factory) => {
        return await new Promise((resolve) => {
          component = factory(undefined, theme, undefined, resolve);
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

/** Open the card without choosing, so a key can be tested in isolation. */
async function openCard(lang = "en", width = 72, theme = PLAIN_THEME) {
  let component;
  const ctx = makeCtx({
    mode: "tui",
    ui: {
      setStatus: () => {},
      notify: () => {},
      custom: async (factory) => {
        component = factory(undefined, theme, undefined, () => "skip");
        return "skip";
      },
    },
  });

  await presentCard(ctx, CARD, lang);
  return component;
}

/**
 * A card with a height budget, the way the presenter builds it: measured first,
 * then capped by the terminal. No ctx needed — the component is what matters here.
 */

function sized(card, terminalRows, lang = "en", theme = PLAIN_THEME) {
  const natural = measureCard(card, stringsFor(lang), 72).total;
  return new CardView(card, theme, () => "skip", {
    locale: lang,
    maxHeight: Math.max(MIN_CARD_HEIGHT, Math.min(natural, terminalRows)),
  });
}

/** A card too tall for any reasonable terminal. */
const TALL = validateCard(
  validCard({
    title: "A card with more text than a small terminal can show",
    impact:
      "The notification claims the user can no longer blame a stale build, and the header says which build drew the card, so the question is answerable in one glance instead of by arguing about git history for ten minutes.",
    proof: "cd pi-quick-win && npm test green, and the rendered card fits the terminal without losing the menu",
    steps: [
      "Add a layout module that both measures and draws the card",
      "Pass the measured height to the overlay instead of a fixed constant",
      "Window the description and keep the decision block whole",
      "Advertise the scroll keys in the footer only while they do something",
      "Assert the menu is present at every terminal height",
    ],
    alternative: "A shorter card that asks for the same decision in one screen",
  }),
);

test("escape closes without recording, and digits do nothing", async () => {
  assert.equal((await driveCard(["\u001b"])).result, "skip", "escape is the honest 'not now'");

  // The rows carry no numbers, so the card must not answer to them either.
  const component = await openCard();
  component.handleInput("2");
  const body = component.render(72).join("\n");
  assert.match(body, /▸ 🚀 deliver now/, "a digit must not move or pick a row");

  component.handleInput("\u001b[B");
  assert.match(component.render(72).join("\n"), /▸ 📅 later/, "the arrow key still works");
});

test("the card speaks Czech when the locale says so", async () => {
  const body = (await openCard("cs")).render(72).join("\n");

  assert.match(body, /🎯 Dopad/, "field labels are localized");
  assert.match(body, /✅ Důkaz/);
  assert.match(body, /📋 Kroky/);
  assert.match(body, /🔀 Jiná varianta/);
  assert.match(body, /⏱ hodina/, "the effort badge carries a Czech unit");
  assert.match(body, /▸ 🚀 roznout ihned/, "the choices are localized");
  assert.match(body, /📅 později/);
  assert.match(body, /⏭ přeskočit/);
  assert.match(body, /↑↓ pohyb/, "the footer is localized");
  assert.match(body, /⏎ potvrdit/);
  assert.match(body, /esc zavřít/);
  assert.doesNotMatch(body, /deliver now|Impact|Proof/);
});

test("an unknown locale falls back to English instead of breaking", async () => {
  const body = (await openCard("klingon")).render(72).join("\n");
  assert.match(body, /deliver now/);
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

test("the header names the build that rendered the card", async () => {
  const { version } = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"));
  const { component } = await driveCard(["\u001b"], 72);

  assert.match(component.render(72)[0], new RegExp(`QUICK WIN v${version.replace(/\./g, "\\.")}`));
});

test("the choice rows carry no numbers at all — it is a menu, not a list", async () => {
  const all = (await openCard("cs")).render(72);
  const rows = all.filter((line) => /roznout ihned|později|přeskočit/.test(line));
  assert.equal(rows.length, 3, `exactly the three choices, got ${JSON.stringify(rows)}`);
  for (const row of rows) {
    assert.doesNotMatch(row, /\d/, `a choice row must not show a digit: ${JSON.stringify(row)}`);
  }
  const footer = all.find((line) => /↑↓/.test(line));
  assert.doesNotMatch(footer ?? "", /\d/, "the footer advertises keys, not digit shortcuts");
});

test("the card is styled like a notification: emoji labels, accent frame, highlighted choice", async () => {
  const { calls, theme } = makeRecordingTheme();
  const { component } = await driveCard(["\u001b"], 72, theme);
  const lines = component.render(72);

  const body = lines.join("\n");
  assert.match(lines[0], /^╭.*⚡ QUICK WIN/, "the header carries the mark and the title");
  assert.match(lines[0], /⏱ hour/, "the effort badge rides in the header");
  assert.match(body, /🎯 Impact/, "fields are emoji-marked");
  assert.match(body, /✅ Proof/);
  assert.match(body, /📋 Steps/);
  assert.match(body, /▸ 🚀 deliver now/, "the default row is marked with a cursor");
  assert.match(body, /↑↓ move/, "the footer explains the keys");
  assert.doesNotMatch(body, /1-3/, "no digit shortcut is advertised, so none is accepted");
  assert.doesNotMatch(body, /^\s*[│ ]*[123] /m, "the rows are a menu, not a numbered list");

  assert.ok(calls.fg.includes("accent"), "the accent color is used");
  assert.ok(calls.fg.includes("success"), "the proof field is painted as verified");
  assert.deepEqual(calls.bg, ["selectedBg"], "exactly the selected choice row is highlighted");
  assert.ok(calls.bold > 0, "the title, header and selected row are bold");
});

test("the effort moves into the body when the header has no room for it", async () => {
  const { theme } = makeRecordingTheme();
  const { component } = await driveCard(["\u001b"], 30, theme);
  const lines = component.render(30);
  assert.doesNotMatch(lines[0], /⏱/, "a narrow header drops the badge");
  assert.match(lines.join("\n"), /⏱ Effort/, "the effort is still on the card");
});

test("the menu is never clipped, whatever the terminal height", () => {
  for (const rows of [12, 14, 18, 24, 40, 200]) {
    const view = sized(TALL, rows);
    const lines = view.render(72);
    const body = lines.join("\n");

    assert.ok(lines.length <= Math.max(rows, MIN_CARD_HEIGHT), `the card must fit ${rows} rows`);
    assert.match(body, /▸ .*deliver now/, "the selected choice is on screen");
    assert.match(body, /later/, "the second choice is on screen");
    assert.match(body, /skip/, "the third choice is on screen");
    assert.match(body, /↑↓ move/, "the key hints are on screen");
  }
});

test("a short card is measured, not padded to the terminal", () => {
  const natural = measureCard(CARD, stringsFor("en"), 72).total;
  const lines = sized(CARD, 200).render(72);
  assert.equal(lines.length, natural, "the window is exactly the content when it fits");
});

test("PgUp/PgDn scroll the description and never the menu", () => {
  const view = sized(TALL, 16);
  const before = view.render(72).join("\n");
  assert.match(before, /PgUp\/PgDn scroll/, "the footer offers scrolling only while it does something");

  view.handleInput("[6~"); // page down
  const after = view.render(72).join("\n");
  assert.notEqual(after, before, "the description moved");
  assert.match(after, /▸ .*deliver now/, "the menu survived the scroll");
  assert.match(after, /↑ \d+/, "the hint says there is more above");

  view.handleInput("[6~");
  const further = view.render(72).join("\n");
  assert.notEqual(further, after, "scrolling continues until the end");
  assert.match(further, /↑↓ move/, "the key hints are still there after scrolling");
});

test("scrolling a long card does not change what Enter confirms", () => {
  let picked = null;
  const natural = measureCard(TALL, stringsFor("en"), 72).total;
  const view = new CardView(TALL, PLAIN_THEME, (choice) => {
    picked = choice;
  }, { locale: "en", maxHeight: Math.min(natural, 16) });

  view.handleInput("[6~");
  view.handleInput("[6~");
  view.handleInput("\r");
  assert.equal(picked, "deliver_now", "the selection never moved while reading the proof");
});