/**
 * Overlay slice — presents the card and returns the typed choice.
 *
 * The only place that may touch `ctx.ui.custom()`, and it is gated twice:
 * `mode === "tui"` (a terminal component cannot render anywhere else) and
 * `hasUI` (dialogs exist in TUI *and* RPC, so `hasUI` alone is not enough).
 * `null` means "no interactive surface here" and the caller falls back to
 * delivering the increment without asking.
 *
 * Sizing is measured, not guessed. A fixed `maxHeight` is what clipped the choice
 * menu out of the window on a long card: the engine cut the overlay at row 24 and
 * the rows below the fold simply did not exist. The card's real height now comes
 * from the same layout the view draws, clamped to what the terminal can show, so a
 * short card gets a small window and a long one scrolls its description instead of
 * losing its menu.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { QuickWinCard, QuickWinChoice } from "../../shared/card.js";
import { DEFAULT_LOCALE, stringsFor, type Locale } from "../../shared/i18n.js";
import { CardView } from "./card-view.js";
import { MIN_CARD_HEIGHT, measureCard } from "./layout.js";

/** Preferred card width in columns; never wider than the terminal. */
const CARD_WIDTH = 72;

/** Rows kept free above and below the card so it never touches the edges. */
const TERMINAL_MARGIN = 2;

/**
 * Terminal size, with honest fallbacks.
 *
 * `process.stdout.rows` is correct on Windows, Linux and macOS for a real TTY and
 * undefined when output is piped; the fallbacks only matter for that case, where
 * the card simply uses a conservative window and scrolls.
 */
function terminalSize(): { columns: number; rows: number } {
	const columns = process.stdout?.columns;
	const rows = process.stdout?.rows;
	return {
		columns: typeof columns === "number" && columns > 0 ? columns : 100,
		rows: typeof rows === "number" && rows > 0 ? rows : 40,
	};
}

export async function presentCard(
	ctx: ExtensionContext,
	card: QuickWinCard,
	lang: Locale = DEFAULT_LOCALE,
): Promise<QuickWinChoice | null> {
	if (ctx.mode !== "tui" || !ctx.hasUI) return null;

	const term = terminalSize();
	const width = Math.max(40, Math.min(CARD_WIDTH, term.columns));
	// The measurement uses the same width the overlay will be given, so the count
	// is the count — not an estimate that the engine then contradicts.
	const natural = measureCard(card, stringsFor(lang), width).total;
	const maxHeight = Math.max(MIN_CARD_HEIGHT, Math.min(natural, term.rows - TERMINAL_MARGIN));

	try {
		return await ctx.ui.custom<QuickWinChoice>(
			(_tui, theme, _keybindings, done) =>
				new CardView(card, theme, done, { locale: lang, maxHeight }),
			{ overlay: true, overlayOptions: { anchor: "center", width, maxHeight } },
		);
	} catch {
		// A UI failure must never cost the agent its turn: fall through to the
		// non-interactive path.
		return null;
	}
}

export { CardView } from "./card-view.js";
export { MIN_CARD_HEIGHT, measureCard } from "./layout.js";
