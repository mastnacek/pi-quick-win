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
function setup({ config = { enabled: true, echo: true }, ctx: ctxOver = {}, globalFile } = {}) {
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

  for (const leaf of ["info", "later", "clear", "off", "on"]) {
    assert.ok(byLabel.has(leaf), `${leaf} must be offered`);
    assert.equal(byLabel.get(leaf).value, leaf, `${leaf} is terminal — no trailing space`);
  }
  assert.equal(byLabel.get("--global").value, "--global ", "--global is a prefix — trailing space");
});

test("typing a prefix narrows the menu instead of clearing it", () => {
  const { command } = setup();
  assert.deepEqual(
    (command.getArgumentCompletions("o") ?? []).map((i) => i.label),
    ["off", "on"],
  );
  assert.equal(command.getArgumentCompletions("zzz"), null);
});

test("--global only offers leaves it can actually carry", () => {
  const { command } = setup();
  const items = command.getArgumentCompletions("--global ") ?? [];

  assert.deepEqual(
    items.map((i) => i.label),
    ["off", "on"],
    "info/later/clear are not settings and must not be offered under --global",
  );
  for (const item of items) {
    assert.equal(item.value, `--global ${item.label}`, "value replaces the whole argument line");
  }
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