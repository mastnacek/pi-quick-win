/**
 * Overlay slice — presents the card and returns the typed choice.
 *
 * The only place that may touch `ctx.ui.custom()`, and it is gated twice:
 * `mode === "tui"` (a terminal component cannot render anywhere else) and
 * `hasUI` (dialogs exist in TUI *and* RPC, so `hasUI` alone is not enough).
 * `null` means "no interactive surface here" and the caller falls back to
 * delivering the increment without asking.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { QuickWinCard, QuickWinChoice } from "../../shared/card.js";
import { DEFAULT_LOCALE, type Locale } from "../../shared/i18n.js";
import { CardView } from "./card-view.js";

/** Card width in columns; the overlay is centred and clamped by the engine. */
const CARD_WIDTH = 72;

export async function presentCard(
	ctx: ExtensionContext,
	card: QuickWinCard,
	lang: Locale = DEFAULT_LOCALE,
): Promise<QuickWinChoice | null> {
	if (ctx.mode !== "tui" || !ctx.hasUI) return null;

	try {
		return await ctx.ui.custom<QuickWinChoice>(
			(_tui, theme, _keybindings, done) => new CardView(card, theme, done, lang),
			{ overlay: true, overlayOptions: { anchor: "center", width: CARD_WIDTH, maxHeight: 24 } },
		);
	} catch {
		// A UI failure must never cost the agent its turn: fall through to the
		// non-interactive path.
		return null;
	}
}

export { CardView } from "./card-view.js";