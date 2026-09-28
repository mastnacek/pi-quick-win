/**
 * Pipeline — the two lifecycle rules that are not the tools' business:
 *
 * 1. A new user prompt starts a new task, which re-arms the one-card-per-task
 *    limit. Nothing else may re-arm it: a timer would let the plugin nag mid-task.
 * 2. The closing echo lasts one turn. Clearing it here keeps timers out of the
 *    extension entirely (long-lived resources belong in session_start/shutdown).
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { clearEcho } from "../../shared/status.js";
import type { SelfQuickWinState } from "../../shared/state.js";

export function registerPipeline(pi: ExtensionAPI, state: SelfQuickWinState): void {
	state.track(
		pi.on("input", async () => {
			state.cardShownThisTask = false;
		}),
	);

	state.track(
		pi.on("turn_start", async (_event, ctx: ExtensionContext) => {
			clearEcho(state, ctx);
		}),
	);
}