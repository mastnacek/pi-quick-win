/**
 * Test fakes — a minimal stand-in for `ExtensionAPI` and `ExtensionContext`.
 *
 * Deliberately structural rather than mock-library based: these tests are about
 * what the plugin *does* with the engine surface (which UI call it makes, when
 * it makes none), so the fakes record calls and nothing else.
 */

import { createQuickWinState } from "../src/shared/state.js";

export function makePi() {
  const tools = new Map();
  const commands = new Map();
  const handlers = new Map();
  const entries = [];
  return {
    tools,
    commands,
    handlers,
    entries,
    on(event, handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
      return () => {};
    },
    registerTool(def) {
      tools.set(def.name, def);
    },
    registerCommand(name, def) {
      commands.set(name, def);
    },
    appendEntry(customType, data) {
      entries.push({ type: "custom", customType, data });
    },
  };
}

export function makeCtx(over = {}) {
  const status = [];
  const notes = [];
  return {
    mode: "tui",
    hasUI: true,
    cwd: process.cwd(),
    ui: {
      setStatus: (id, text) => status.push({ id, text }),
      notify: (message, level) => notes.push({ message, level }),
      select: async () => undefined,
    },
    sessionManager: { getEntries: () => [] },
    isIdle: () => true,
    statusCalls: status,
    notes,
    ...over,
  };
}

export function makeState(over = {}) {
  const state = createQuickWinState(makePi());
  return Object.assign(state, over);
}

/** A card that passes validation; individual tests override single fields. */
export function validCard(over = {}) {
  return {
    title: "Ship the width-safe overlay frame",
    impact: "The card renders on any terminal width without corrupting the screen.",
    effort: "hour",
    steps: ["Write the frame helper", "Add the width test"],
    proof: "npm test -- context-bar",
    ...over,
  };
}

export async function callTool(def, params, ctx) {
  return await def.execute("call-1", params, undefined, undefined, ctx);
}

export function textOf(result) {
  return result.content.map((block) => block.text ?? "").join("\n");
}