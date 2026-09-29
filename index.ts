/**
 * pi-quick-win — the smallest shippable increment, on screen, when the task
 * lands.
 *
 * Composition root ONLY: it creates the state kernel, wires slices onto Pi
 * events, and injects each slice's cross-slice dependency. No business logic
 * lives here:
 * - card validation and text      → src/shared/card
 * - config cascade                → src/shared/config
 * - statusline ownership          → src/shared/status
 * - lifecycle rules               → src/slices/pipeline
 * - the overlay card              → src/slices/overlay
 * - model tools                   → src/slices/tools
 * - the deferred queue            → src/slices/later
 * - /quick-win                    → src/slices/commands
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createQuickWinState, reloadConfig } from "./src/shared/state.js";
import { registerPipeline } from "./src/slices/pipeline/index.js";
import { presentCard } from "./src/slices/overlay/index.js";
import { registerQuickWinTools } from "./src/slices/tools/index.js";
import { clearLater, describeLater, recordLater, restoreLater } from "./src/slices/later/index.js";
import { registerQuickWinCommand } from "./src/slices/commands/index.js";
import { paintBadge } from "./src/shared/status.js";

export default function quickWinExtension(pi: ExtensionAPI): void {
	// Subagent and child sessions load every global extension. A one-card-per-task
	// prompt surface is meaningless there and its hooks would recurse through the
	// parent's tool calls, so this plugin stays inert (skill §8: recursion guard).
	if (process.env.PI_SUBAGENT === "true" || Boolean(process.env.PI_CHILD_SESSION)) return;

	const state = createQuickWinState(pi);

	// Session init: reload the cascading config (which needs a cwd that does not
	// exist at extension-load time) and restore the deferred queue from the
	// session's own entries, so `/reload` and compaction do not lose it.
	state.track(
		pi.on("session_start", async (_event, ctx) => {
			reloadConfig(state, ctx.cwd);
			state.later = restoreLater(ctx);
			state.cardsShownThisTask = 0;
			state.pendingEcho = undefined;
			state.echoVisible = false;
			paintBadge(state, ctx);
		}),
	);

	registerPipeline(pi, state);

	// The composition root is the only place allowed to cross a slice boundary.
	registerQuickWinTools(pi, state, { presentCard, recordLater });
	registerQuickWinCommand(pi, state, {
		describeLater: (items, strings) => describeLater(items, strings),
		clearLater,
	});

	// Cleanup: drain listeners and release the statusline slot. Idempotent,
	// because cancellation, reload and exit can all converge here.
	pi.on("session_shutdown", async (_event, ctx) => {
		while (state.unsubscribers.length > 0) {
			try {
				state.unsubscribers.pop()?.();
			} catch {
				// ignore
			}
		}
		state.pendingEcho = undefined;
		state.echoVisible = false;
		state.ifLive(() => {
			if (ctx.hasUI) ctx.ui.setStatus("quick-win", undefined);
		});
	});
}