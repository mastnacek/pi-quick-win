/**
 * Statusline painting — shared by every slice that shows quick-win state, so
 * the plugin owns exactly one statusline slot and one owner of its text.
 *
 * Two kinds of message live here and they never compete:
 * - the deferred count (`later: 2`), which persists while items wait;
 * - the closing echo (`✓ <title>`), which is shown only for a verified
 *   delivery and cleared on the next turn instead of by a timer.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { QuickWinCard } from "./card.js";
import type { SelfQuickWinState } from "./state.js";

export const STATUS_ID = "quick-win";

/** Write the shared slot; a dead session or missing UI is not an error. */
export function setStatus(ctx: ExtensionContext, text: string | undefined): void {
	if (!ctx.hasUI) return;
	try {
		ctx.ui.setStatus(STATUS_ID, text);
	} catch {
		// Session closed or UI unavailable.
	}
}

export function paintLaterStatus(state: SelfQuickWinState, ctx: ExtensionContext): void {
	const count = state.later.length;
	if (state.echoVisible) return;
	setStatus(ctx, count > 0 ? `later: ${count}` : undefined);
}

export function paintEcho(state: SelfQuickWinState, ctx: ExtensionContext, card: QuickWinCard): void {
	state.echoVisible = true;
	setStatus(ctx, `✓ ${card.title}`);
}

/** Called on the next turn: the echo is a moment, not a score. */
export function clearEcho(state: SelfQuickWinState, ctx: ExtensionContext): void {
	if (!state.echoVisible) return;
	state.echoVisible = false;
	paintLaterStatus(state, ctx);
}