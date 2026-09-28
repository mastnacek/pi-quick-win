/**
 * Card kernel — the domain rules. `proof` is mandatory and effort is a closed
 * set, because a win nobody can verify is not a win (PRD §3.1, §10).
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  CHOICES,
  EFFORTS,
  choiceDirective,
  renderCardText,
  validateCard,
} from "../src/shared/card.js";
import { validCard } from "./fakes.js";

test("a complete card validates and trims its text", () => {
  const card = validateCard(validCard({ title: "  Spaced title  " }));
  assert.equal(card.title, "Spaced title");
  assert.deepEqual(card.steps, ["Write the frame helper", "Add the width test"]);
  assert.equal(card.effort, "hour");
});

test("proof is mandatory — no proof, no card", () => {
  assert.throws(() => validateCard(validCard({ proof: "" })), /'proof' is required/);
  assert.throws(() => validateCard(validCard({ proof: "   " })), /'proof' is required/);
  assert.throws(() => validateCard(validCard({ proof: undefined })), /'proof' is required/);
});

test("title, impact and steps are mandatory", () => {
  assert.throws(() => validateCard(validCard({ title: "" })), /'title' is required/);
  assert.throws(() => validateCard(validCard({ impact: "" })), /'impact' is required/);
  assert.throws(() => validateCard(validCard({ steps: [] })), /'steps' must be a non-empty array/);
  assert.throws(() => validateCard(validCard({ steps: ["ok", "  "] })), /steps\[1\]/);
});

test("effort is a closed set — free text is rejected", () => {
  assert.throws(() => validateCard(validCard({ effort: "two coffees" })), /'effort' must be one of/);
  for (const effort of EFFORTS) {
    assert.equal(validateCard(validCard({ effort })).effort, effort);
  }
});

test("an empty alternative is omitted rather than stored as blank", () => {
  assert.equal(validateCard(validCard({ alternative: "  " })).alternative, undefined);
  assert.equal(validateCard(validCard({ alternative: "Only the parser" })).alternative, "Only the parser");
});

test("card text carries impact, steps and proof", () => {
  const text = renderCardText(validateCard(validCard()));
  assert.match(text, /Quick win: Ship the width-safe overlay frame/);
  assert.match(text, /verify with: npm test/);
  assert.match(text, /1\. Write the frame helper/);
  assert.match(text, /2\. Add the width test/);
});

test("only deliver_now instructs work; the others stand down and stop nagging", () => {
  const card = validateCard(validCard());
  const deliver = choiceDirective("deliver_now", card);
  assert.match(deliver, /exactly this increment/);
  assert.match(deliver, /quick_win_done/);
  assert.match(deliver, /Do not widen the scope/);

  for (const choice of ["later", "skip"]) {
    assert.match(choiceDirective(choice, card), /announc\w* another quick win/i);
  }
});

test("the three choices are exactly what the overlay offers", () => {
  assert.deepEqual([...CHOICES], ["deliver_now", "later", "skip"]);
});