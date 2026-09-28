/**
 * CardView — the overlay card: state, frame, and the keys.
 *
 * All geometry lives in `layout.ts`, so this file is only the parts that depend on
 * interaction: which choice is highlighted, how far the description is scrolled,
 * and the frame around both.
 *
 * Two hard rules survive the styling:
 * - Every rendered line is truncated to the supplied width, because the terminal
 *   may be arbitrarily narrow and an overflowing line corrupts the whole frame
 *   (docs/tui.md: "Every rendered line must fit within the supplied width").
 * - Styling is applied per line at render time — Pi resets styles after each
 *   line, so nothing is cached with ANSI embedded. Padding is computed on
 *   *visible* width: emoji are two cells and ANSI escapes are zero.
 *
 * The one behaviour that matters most here: the decision block (three choices and
 * the key hints) is never scrolled and never clipped. A card too tall for the
 * terminal scrolls its description, because a decision window whose menu is off
 * screen is not a decision window.
 */

import type { Component } from "@earendil-works/pi-tui";
import { matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { CHOICES, type QuickWinCard, type QuickWinChoice } from "../../shared/card.js";
import { DEFAULT_LOCALE, stringsFor, type CardStrings, type Locale } from "../../shared/i18n.js";
import { PLUGIN_VERSION } from "../../shared/version.js";
import {
	FRAME_LINES,
	TAIL_LINES,
	headWindow,
	layoutCard,
	windowHead,
	type LayoutLine,
} from "./layout.js";

export interface CardViewOptions {
	locale?: Locale;
	/**
	 * Rows the card may occupy, including the frame. The presenter computes it from
	 * the measured content, so a short card gets a short window and a long one
	 * scrolls instead of being clipped.
	 */
	maxHeight?: number;
}

export class CardView implements Component {
	private index = 0;
	private scroll = 0;
	private readonly strings: CardStrings;
	private readonly maxHeight: number | undefined;

	constructor(
		private readonly card: QuickWinCard,
		private readonly theme: Theme,
		private readonly done: (choice: QuickWinChoice) => void,
		options: CardViewOptions = {},
	) {
		this.strings = stringsFor(options.locale ?? DEFAULT_LOCALE);
		this.maxHeight = options.maxHeight;
	}

	invalidate(): void {
		// Rendering is stateless apart from `index`/`scroll`, which are the state.
	}

	handleInput(data: string): void {
		// Only the keys the footer advertises. A shortcut the card does not show
		// is a hidden affordance, and digits in front of the rows made the menu
		// look like a numbered list instead of a menu.
		if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
			this.done("skip");
			return;
		}
		if (matchesKey(data, "return")) {
			this.choose(this.index + 1);
			return;
		}
		// Scrolling the description never moves the selection: a user reading the
		// proof must not change what Enter will confirm.
		if (matchesKey(data, "pageUp")) {
			this.scroll = Math.max(0, this.scroll - this.page());
			return;
		}
		if (matchesKey(data, "pageDown")) {
			this.scroll += this.page();
			return;
		}
		if (matchesKey(data, "up")) {
			this.index = (this.index + CHOICES.length - 1) % CHOICES.length;
			return;
		}
		if (matchesKey(data, "down")) {
			this.index = (this.index + 1) % CHOICES.length;
		}
	}

	/** Confirm row `oneBased`; out-of-range input is ignored, never guessed. */
	private choose(oneBased: number): void {
		const choice = CHOICES[oneBased - 1];
		if (choice) this.done(choice);
	}

	/** One page of the description, never more than what is hidden. */
	private page(): number {
		const window = this.maxHeight ? headWindow(this.maxHeight) : 1;
		return Math.max(1, window - 1);
	}

	render(width: number): string[] {
		const { head, tail, badge } = layoutCard(this.card, this.strings, width, this.theme, this.index);
		// The layout is already flattened to one entry per row, so `head.length`
		// and the window agree with what the frame will actually draw.
		const budget = this.maxHeight ?? FRAME_LINES + head.length + TAIL_LINES;
		const window = headWindow(budget);
		const view = windowHead(head, window, this.scroll, this.theme);
		// Keep the offset inside the window: the card can be re-laid out at a
		// different width between renders, and a stale offset would hide content.
		this.scroll = Math.min(this.scroll, view.hiddenAbove + view.hiddenBelow);

		const body: LayoutLine[] = [...view.lines, ...tail];
		body.push({ text: this.footer(view.hiddenAbove > 0 || view.hiddenBelow > 0) });
		return this.frame(body, width, badge);
	}

	/** Key hints with colored glyphs; the scroll hint appears only when it works. */
	private footer(scrollable: boolean): string {
		const th = this.theme;
		const f = this.strings.footer;
		const key = (glyph: string, text: string) =>
			`${th.bold(th.fg("accent", glyph))} ${th.fg("dim", text)}`;
		const parts = [key("↑↓", f.move), key("⏎", f.confirm), key("esc", f.skip)];
		if (scrollable) parts.splice(2, 0, key("PgUp/PgDn", f.scroll));
		return parts.join(` ${th.fg("border", "·")} `);
	}

	/** Draw the card border, clamping every interior line to the usable width. */
	private frame(body: readonly LayoutLine[], width: number, badge?: string): string[] {
		const th = this.theme;
		const inner = Math.max(1, width - 2);
		const lines: string[] = [this.header(inner, badge)];

		for (const { text, highlight } of body) {
			for (const piece of text.split("\n")) {
				// One space of breathing room on each side: content must not hug the
				// border, and the highlight has to look like a row, not a stripe.
				const padded = `${this.pad(` ${piece}`, inner - 1)} `;
				lines.push(
					`${th.fg("borderAccent", "│")}${highlight ? th.bg("selectedBg", padded) : padded}${th.fg("borderAccent", "│")}`,
				);
			}
		}
		lines.push(
			`${th.fg("borderAccent", "╰")}${th.fg("borderAccent", "─".repeat(inner))}${th.fg("borderAccent", "╯")}`,
		);
		return lines.map((line) => truncateToWidth(line, width));
	}

	/** Top border: accent title with the build version, dim rule, effort badge. */
	private header(inner: number, badge?: string): string {
		const th = this.theme;
		// The version is not decoration: it names the build that rendered this card,
		// so a stale runtime is visible instead of debatable.
		const title = th.bold(th.fg("accent", ` ⚡ ${this.strings.title} v${PLUGIN_VERSION} `));
		const badgeText = badge ? th.fg("warning", ` ${badge} `) : "";
		const fill = Math.max(0, inner - visibleWidth(title) - visibleWidth(badgeText));
		const rule = "─".repeat(fill);
		return `${th.fg("borderAccent", "╭")}${title}${th.fg("border", rule)}${badgeText}${th.fg("borderAccent", "╮")}`;
	}

	private pad(text: string, inner: number): string {
		const clipped = truncateToWidth(text, inner);
		// Padding is computed on the *visible* width: wide characters, emoji and
		// ANSI escapes all make string length the wrong measure.
		return `${clipped}${" ".repeat(Math.max(0, inner - visibleWidth(clipped)))}`;
	}
}

export { FRAME_LINES, TAIL_LINES };
