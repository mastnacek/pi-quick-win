/**
 * Quick-win card — the pure domain kernel.
 *
 * A card is the agent's claim about the *smallest independently shippable
 * increment* of the current task. It is deliberately not a plan, a task list
 * or a score: one increment, its impact, its cost, its steps, and the proof
 * that it is done.
 *
 * `proof` is mandatory and that is the whole point (PRD §3.1, §10): an
 * increment nobody can verify is not a win, it is a promise. A card without
 * proof is rejected before it ever reaches the screen.
 */

/** Typed user decision. Kept tiny so it can be persisted in tool details. */
export type QuickWinChoice = "deliver_now" | "later" | "skip";

export const CHOICES: readonly QuickWinChoice[] = ["deliver_now", "later", "skip"];

/** Rough cost classes instead of a number — a promise of minutes is a lie anyway. */
export type QuickWinEffort = "minutes" | "hour" | "hours" | "day";

export const EFFORTS: readonly QuickWinEffort[] = ["minutes", "hour", "hours", "day"];

export interface QuickWinCard {
	title: string;
	impact: string;
	effort: QuickWinEffort;
	steps: string[];
	proof: string;
	/** Optional alternative cut of the same task, offered behind a key press. */
	alternative?: string;
}

/** What the agent handed us, before validation. Everything is untrusted input. */
export interface QuickWinInput {
	title?: unknown;
	impact?: unknown;
	effort?: unknown;
	steps?: unknown;
	proof?: unknown;
	alternative?: unknown;
}

function requireText(value: unknown, field: string): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`quick_win: '${field}' is required and must be a non-empty string.`);
	}
	return value.trim();
}

/**
 * Validate untrusted tool input into a card, or throw with a message the model
 * can act on. Throwing (not returning) is the engine's error contract: only an
 * exception sets `isError: true`.
 */
export function validateCard(input: QuickWinInput): QuickWinCard {
	const title = requireText(input.title, "title");
	const impact = requireText(input.impact, "impact");
	const proof = requireText(input.proof, "proof");

	const rawEffort = typeof input.effort === "string" ? input.effort.trim() : "";
	// Resolve to the declared member rather than casting, so a validated card
	// cannot carry an effort outside the closed set.
	const effort = EFFORTS.find((candidate) => candidate === rawEffort);
	if (!effort) {
		throw new Error(
			`quick_win: 'effort' must be one of ${EFFORTS.join(" | ")} (got ${JSON.stringify(input.effort)}).`,
		);
	}

	if (!Array.isArray(input.steps) || input.steps.length === 0) {
		throw new Error("quick_win: 'steps' must be a non-empty array of concrete steps.");
	}
	const steps = input.steps.map((step, index) => requireText(step, `steps[${index}]`));

	const alternative =
		typeof input.alternative === "string" && input.alternative.trim().length > 0
			? input.alternative.trim()
			: undefined;

	return {
		title,
		impact,
		effort,
		steps,
		proof,
		...(alternative ? { alternative } : {}),
	};
}

/** Card as plain text — used for tool results and for every non-TUI mode. */
export function renderCardText(card: QuickWinCard): string {
	const lines = [
		`Quick win: ${card.title}`,
		`Impact: ${card.impact}`,
		`Effort: ${card.effort} (verify with: ${card.proof})`,
	];
	lines.push("Steps:");
	for (const [index, step] of card.steps.entries()) {
		lines.push(`  ${index + 1}. ${step}`);
	}
	if (card.alternative) lines.push(`Other cut: ${card.alternative}`);
	return lines.join("\n");
}

/**
 * The instruction handed back to the model once a choice exists. Kept short
 * because it is billed on every card, and explicit about scope because the
 * whole point is that the agent implements *this* increment, not something else.
 */
export function choiceDirective(choice: QuickWinChoice, card: QuickWinCard): string {
	if (choice === "skip") {
		return "Chooser skipped the quick win for today. Continue the task without announcing another quick win in this task.";
	}
	if (choice === "later") {
		return "Quick win recorded as 'later'. Continue with the task; do not announce another quick win in this task.";
	}
	return (
		`Implement exactly this increment now: "${card.title}". ` +
		`Do not widen the scope. When it is verified against the stated proof (${card.proof}), ` +
		`call quick_win_done with that evidence — nothing else closes the loop.`
	);
}