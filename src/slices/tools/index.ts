/**
 * Model-facing tools: `quick_win` (announce the smallest shippable increment)
 * and `quick_win_done` (close the loop with verified evidence).
 *
 * Both are deliberately narrow. `quick_win` may be called at most once per task
 * and never invents the increment itself — the card is the model's claim, the
 * user's choice is the decision, and `proof` is the price of admission.
 *
 * Slice isolation: the overlay presenter and the `later` queue arrive as
 * injected deps from the composition root, never as imports from sibling slices.
 */

import type { AgentToolResult, ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import {
	choiceDirective,
	renderCardText,
	validateCard,
	type QuickWinCard,
	type QuickWinChoice,
} from "../../shared/card.js";
import { EFFORTS } from "../../shared/card.js";
import { paintBadge, paintEcho } from "../../shared/status.js";
import type { SelfQuickWinState } from "../../shared/state.js";
import type { Locale } from "../../shared/i18n.js";

/** Operations the tools need, supplied by the composition root. */
export interface ToolDeps {
	presentCard(ctx: ExtensionContext, card: QuickWinCard, lang: Locale): Promise<QuickWinChoice | null>;
	recordLater(pi: ExtensionAPI, state: SelfQuickWinState, card: QuickWinCard): number;
}

export function registerQuickWinTools(
	pi: ExtensionAPI,
	state: SelfQuickWinState,
	deps: ToolDeps,
): void {
	registerQuickWin(pi, state, deps);
	registerQuickWinDone(pi, state);
}

function registerQuickWin(pi: ExtensionAPI, state: SelfQuickWinState, deps: ToolDeps): void {
	pi.registerTool({
		name: "quick_win",
		label: "Quick Win",
		description:
			"Announce the smallest independently shippable increment of the current task and let the user choose " +
			"deliver now / later / skip. Call it before the first large write, so the user sees the nearest real " +
			"win instead of only activity — and again whenever a genuinely new increment appears. Requires a " +
			"verifiable `proof`; an increment that cannot be verified will be rejected.",
		promptSnippet: "quick_win — name the smallest shippable increment; quick_win_done — close it with evidence",
		promptGuidelines: [
			"Call quick_win when a non-trivial increment lands: name the smallest independently shippable one (impact, effort, ordered steps, and the proof that it is done).",
			"Call it again only for a genuinely new increment, never twice for the same one.",
			"Call quick_win_done only when an increment is deliverable and verified — pass the concrete evidence. Never for partial work, never to celebrate activity.",
		],
		parameters: Type.Object({
			title: Type.String({
				description: "The smallest independently shippable increment, in one sentence.",
			}),
			impact: Type.String({
				description: "What becomes possible or fixed once this increment exists. No promises.",
			}),
			effort: StringEnum(EFFORTS, {
				description: "Rough cost class of the increment.",
			}),
			steps: Type.Array(Type.String(), {
				minItems: 1,
				description: "Concrete ordered steps to deliver exactly this increment.",
			}),
			proof: Type.String({
				description:
					"How we know it is done — a command, a test, a file, an observable behaviour. Mandatory.",
			}),
			alternative: Type.Optional(
				Type.String({ description: "Optional different cut of the same task." }),
			),
		}),
		// An overlay takes keyboard focus, so it must never race a sibling tool call.
		executionMode: "sequential",
		async execute(_toolCallId, params, _signal, _onUpdate, ctx): Promise<AgentToolResult<unknown>> {
			const card = validateCard(params);

			// Muted: the plugin answers, but shows nothing (PRD §9.6).
			if (!state.config.enabled) {
				return {
					content: [
						{
							type: "text",
							text: `${renderCardText(card)}\n\n(quick-win is muted; proceed with the increment without asking.)`,
						},
					],
					details: { choice: null, ui: false, muted: true },
				};
			}

			if (state.cardLimitReached()) {
				return {
					content: [
						{
							type: "text",
							text:
								`The card limit for this task (${state.config.cardLimit}) is already used up. ` +
								"Do not announce another card; deliver the current increment and close it with quick_win_done.",
						},
					],
					details: { choice: null, ui: false, duplicate: true },
				};
			}

			const chosen = await deps.presentCard(ctx, card, state.config.lang);
			// null = no interactive surface (json/print/rpc). Deliver without asking.
			const choice: QuickWinChoice = chosen ?? "deliver_now";

			state.cardsShownThisTask += 1;

			if (choice === "later") {
				deps.recordLater(pi, state, card);
				paintBadge(state, ctx);
			}
			if (choice === "deliver_now") {
				state.pendingEcho = card;
			}

			return {
				content: [{ type: "text", text: `${renderCardText(card)}\n\n${choiceDirective(choice, card)}` }],
				details: {
					choice,
					ui: chosen !== null,
					title: card.title,
					proof: card.proof,
					steps: card.steps,
				},
			};
		},
	});
}

function registerQuickWinDone(pi: ExtensionAPI, state: SelfQuickWinState): void {
	pi.registerTool({
		name: "quick_win_done",
		label: "Quick Win Delivered",
		description:
			"Close an approved quick win with the evidence that its stated proof now holds. This is the only thing " +
			"that produces the closing echo, and it refuses when nothing was approved or the evidence is empty.",
		parameters: Type.Object({
			evidence: Type.String({
				description: "What was verified: the command output, test name, or observable result.",
			}),
		}),
		executionMode: "sequential",
		async execute(_toolCallId, params, _signal, _onUpdate, ctx): Promise<AgentToolResult<unknown>> {
			const evidence = typeof params.evidence === "string" ? params.evidence.trim() : "";
			if (evidence.length === 0) {
				throw new Error("quick_win_done: 'evidence' is required — describe what was verified.");
			}

			const card = state.pendingEcho;
			if (!card) {
				return {
					content: [
						{
							type: "text",
							text:
								"Nothing to close: no quick win is awaiting delivery in this task. " +
								"Continue working; do not claim a win that was not approved.",
						},
					],
					details: { echo: false, reason: "no-pending-win" },
				};
			}

			state.pendingEcho = undefined;

			if (!state.config.enabled || !state.config.echo) {
				return {
					content: [{ type: "text", text: `Increment closed: ${card.title}` }],
					details: { echo: false, reason: "echo-off", title: card.title },
				};
			}

			paintEcho(state, ctx, card);
			return {
				content: [{ type: "text", text: `Closed: ${card.title} (evidence: ${evidence})` }],
				details: { echo: true, title: card.title, evidence },
			};
		},
	});
}