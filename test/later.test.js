/**
 * Deferred queue — the acceptance criterion that `later` survives `/reload`
 * and compaction (§9.3). It survives because it is written as a session entry
 * and rebuilt from the session's own history, never from memory.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  LATER_ENTRY,
  clearLater,
  describeLater,
  recordLater,
  restoreLater,
} from "../src/slices/later/index.js";
import { makeCtx, makePi, makeState, validCard } from "./fakes.js";

test("a deferred card is appended to the session, not held in memory alone", () => {
  const pi = makePi();
  const state = makeState();

  const count = recordLater(pi, state, validCard({ title: "Parser first" }));

  assert.equal(count, 1);
  assert.equal(pi.entries.length, 1);
  assert.equal(pi.entries[0].customType, LATER_ENTRY);
  assert.equal(pi.entries[0].data.title, "Parser first");
  assert.equal(pi.entries[0].data.proof, "npm test -- context-bar");
});

test("restore rebuilds the queue from session entries — the reload path", () => {
  const pi = makePi();
  const state = makeState();
  recordLater(pi, state, validCard({ title: "Parser first" }));
  recordLater(pi, state, validCard({ title: "Then the CLI" }));

  // A fresh context reading the same session history is what /reload produces.
  const ctx = makeCtx({ sessionManager: { getEntries: () => pi.entries } });
  const restored = restoreLater(ctx);

  assert.deepEqual(restored.map((item) => item.title), ["Parser first", "Then the CLI"]);
  assert.equal(restored[0].proof, "npm test -- context-bar");
});

test("entries from other plugins and malformed entries are ignored", () => {
  const ctx = makeCtx({
    sessionManager: {
      getEntries: () => [
        { type: "custom", customType: "something-else", data: { title: "not ours" } },
        { type: "custom", customType: LATER_ENTRY, data: null },
        { type: "message", message: {} },
        { type: "custom", customType: LATER_ENTRY, data: { title: "" } },
        { type: "custom", customType: LATER_ENTRY, data: { title: "kept" } },
      ],
    },
  });

  assert.deepEqual(restoreLater(ctx).map((item) => item.title), ["kept"]);
});

test("clearing empties the queue and survives a restore", () => {
  const pi = makePi();
  const state = makeState();
  recordLater(pi, state, validCard({ title: "Parser first" }));

  clearLater(pi, state);
  assert.equal(state.later.length, 0);
  assert.equal(restoreLater(makeCtx({ sessionManager: { getEntries: () => pi.entries } })).length, 0);
});

test("an unreadable session history degrades to an empty queue", () => {
  const ctx = makeCtx({
    sessionManager: {
      getEntries: () => {
        throw new Error("session gone");
      },
    },
  });
  assert.deepEqual(restoreLater(ctx), []);
});

test("the list is compact and speaks like a human", () => {
  assert.equal(describeLater([]), "No deferred quick wins.");
  const text = describeLater([
    { title: "Parser first", proof: "tests", recordedAt: 0 },
    { title: "Then the CLI", proof: "", recordedAt: 0 },
  ]);
  assert.equal(text, "1. Parser first\n2. Then the CLI");
});