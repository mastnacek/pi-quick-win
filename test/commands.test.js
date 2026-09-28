/**
 * `/quick-win` — completions contract, the mute switch, and the config cascade.
 *
 * The two scope paths are injected, so these tests never read or write the
 * developer's real ~/.pi/agent/pi-quick-win.json.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { registerQuickWinCommand } from "../src/slices/commands/index.js";
import { loadConfig, projectConfigPath } from "../src/shared/config.js";
import { makeCtx, makePi, makeState } from "./fakes.js";

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "pi-quick-win-"));
  const cwd = join(root, "project");
  mkdirSync(cwd, { recursive: true });
  return { cwd, globalFile: join(root, "global.json") };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value), "utf8");
}

/** Register the command with a sandboxed global scope and a recording dep set. */
function setup({ config = { enabled: true, echo: true, cardLimit: 0 }, ctx: ctxOver = {}, globalFile } = {}) {
  const pi = makePi();
  const state = makeState(globalFile ? { config, globalFile } : { config });
  const ctx = makeCtx(ctxOver);
  const cleared = [];

  registerQuickWinCommand(pi, state, {
    describeLater: (s) => (s.later.length === 0 ? "No deferred quick wins." : `${s.later.length} deferred`),
    clearLater: () => cleared.push(true),
  });

  return { pi, state, ctx, cleared, command: pi.commands.get("quick-win") };
}

test("completions follow the trailing-space contract", () => {
  const { command } = setup();
  const items = command.getArgumentCompletions("") ?? [];
  const byLabel = new Map(items.map((i) => [i.label, i]));

  for (const leaf of ["info", "later", "clear", "on", "off"]) {
    const item = byLabel.get(leaf) ?? items.find((i) => i.label.startsWith(leaf));
    assert.ok(item, `${leaf} must be offered`);
    assert.equal(item.value, leaf, `${leaf} is terminal — clean value, no trailing space`);
  }
  assert.equal(byLabel.get("--global").value, "--global ", "--global is a prefix — trailing space");
});

test("the settings menu marks the value in effect, live", () => {
  const enabled = setup({ config: { enabled: true, echo: true } });
  const enabledRows = new Map((enabled.command.getArgumentCompletions("") ?? []).map((i) => [i.label, i]));

  assert.ok(enabledRows.has("on ✓"), "the active toggle carries the marker in its label");
  assert.ok(enabledRows.has("off"), "the inactive toggle carries no marker");
  assert.match(enabledRows.get("on ✓").description, /● AKTIVNÍ/);
  assert.ok(!/AKTIVNÍ/.test(enabledRows.get("off").description));
  assert.equal(enabledRows.get("on ✓").value, "on", "the marker must never enter `value`");

  const muted = setup({ config: { enabled: false, echo: true } });
  const mutedRows = new Map((muted.command.getArgumentCompletions("") ?? []).map((i) => [i.label, i]));
  assert.ok(mutedRows.has("off ✓"), "after muting, the marker moves to off");
  assert.match(mutedRows.get("off ✓").description, /● AKTIVNÍ/);
});

test("the menu reads live state, not a snapshot taken at registration", () => {
  const { command, state } = setup({ config: { enabled: true, echo: true } });
  assert.ok((command.getArgumentCompletions("") ?? []).some((i) => i.label === "on ✓"));

  state.config.enabled = false;

  assert.ok(
    (command.getArgumentCompletions("") ?? []).some((i) => i.label === "off ✓"),
    "the menu must re-read the config on every completion",
  );
});

test("typing a prefix narrows the menu instead of clearing it", () => {
  const { command } = setup();
  assert.deepEqual(
    (command.getArgumentCompletions("o") ?? []).map((i) => i.label).sort(),
    ["off", "on ✓"],
    "filtering must ignore the marker",
  );
  assert.equal(command.getArgumentCompletions("zzz"), null);
});

test("--global only offers leaves it can actually carry", () => {
  const { command } = setup();
  const items = command.getArgumentCompletions("--global ") ?? [];

  assert.deepEqual(
    items.map((i) => i.value).sort(),
    ["--global limit ", "--global off", "--global on"],
    "info/later/clear are not settings and must not be offered under --global",
  );
  for (const item of items) {
    assert.ok(/● AKTIVNÍ/.test(item.description) || /Unmute|Mute|Cards per task/.test(item.description));
  }
});

test("limit offers its own value level, marked with the value in effect", () => {
  const { command } = setup({ config: { enabled: true, echo: true, cardLimit: 3 } });
  const items = command.getArgumentCompletions("limit ") ?? [];

  assert.deepEqual(
    items.map((i) => i.value).sort(),
    ["1", "10", "3", "unlimited"],
  );
  const active = items.find((i) => i.value === "3");
  assert.match(active.label, /✓/, "the leaf in effect is marked in the label");
  assert.match(active.description, /● AKTIVNÍ/);
  assert.doesNotMatch(
    items.find((i) => i.value === "unlimited").description,
    /AKTIVNÍ/,
    "exactly one leaf may claim to be active",
  );
});

test("--global limit carries the value, not just the setting", () => {
  const { command } = setup();
  const items = command.getArgumentCompletions("--global limit ") ?? [];
  assert.deepEqual(
    items.map((i) => i.value).sort(),
    ["--global limit 1", "--global limit 10", "--global limit 3", "--global limit unlimited"],
  );
});

test("/quick-win limit persists only the changed key", () => {
  const { cwd, globalFile } = sandbox();
  writeJson(globalFile, { enabled: false, cardLimit: 1 });
  const { command, state, ctx } = setup({ globalFile, ctx: { cwd } });

  command.handler("limit unlimited", ctx);

  assert.equal(state.config.cardLimit, 0);
  assert.deepEqual(JSON.parse(readFileSync(projectConfigPath(cwd), "utf8")), { cardLimit: 0 });
  const merged = loadConfig(cwd, globalFile);
  assert.equal(merged.cardLimit, 0, "the project layer wins over the global value");
  assert.equal(merged.enabled, false, "inherited keys must not be frozen into the project layer");
});

test("a junk card limit means no cap, never a silent plugin", () => {
  const { cwd, globalFile } = sandbox();
  writeJson(projectConfigPath(cwd), { cardLimit: "many" });
  const merged = loadConfig(cwd, globalFile);
  assert.equal(merged.cardLimit, 0, "unparsable means unlimited, not 1");
  assert.equal(merged.enabled, true);
});

test("/quick-win off mutes and persists only the changed key", () => {
  const { cwd, globalFile } = sandbox();
  writeJson(globalFile, { enabled: true, echo: false });
  const { command, state, ctx } = setup({ globalFile, ctx: { cwd } });

  command.handler("off", ctx);

  assert.equal(state.config.enabled, false);
  assert.deepEqual(JSON.parse(readFileSync(projectConfigPath(cwd), "utf8")), { enabled: false });

  // The untouched global key still wins for the value it owns.
  const merged = loadConfig(cwd, globalFile);
  assert.equal(merged.enabled, false);
  assert.equal(merged.echo, false, "inherited keys must not be frozen into the project layer");
  assert.equal(state.echoVisible, false);
});

test("/quick-win on --global writes the global layer, not the project one", () => {
  const { cwd, globalFile } = sandbox();
  const { command, ctx, state } = setup({
    config: { enabled: false, echo: true },
    globalFile,
    ctx: { cwd },
  });

  command.handler("on --global", ctx);

  assert.equal(state.config.enabled, true);
  assert.equal(JSON.parse(readFileSync(globalFile, "utf8")).enabled, true);
  assert.ok(!existsSync(projectConfigPath(cwd)), "--global must not touch the project layer");
});

test("completions exist even when the command is called with no UI", () => {
  const { cwd } = sandbox();
  const { command, ctx } = setup({ ctx: { cwd, hasUI: false, mode: "print" } });

  command.handler("", ctx);
  command.handler("off", ctx);

  assert.equal(ctx.notes.length, 0, "no UI means no notifications");
});

test("clear empties the deferred list through the injected dep", () => {
  const { cwd } = sandbox();
  const { command, ctx, cleared } = setup({ ctx: { cwd } });

  command.handler("clear", ctx);
  assert.deepEqual(cleared, [true]);
});