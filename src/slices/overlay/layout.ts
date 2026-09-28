/**
 * Card layout — the geometry of the card, with no state and no chrome.
 *
 * Split out of the view for one reason: the presenter must know how many lines
 * the card needs *before* it can size the overlay, and a size that is guessed
 * wrong is what clipped the choice menu out of the window. So the line count and
 * the line content come from the same function, and the presenter measures the
 * very lines the view will draw.
 *
 * Styling is injected as a tiny `Painter`, because the number of lines must not
 * depend on the theme: ANSI escapes are zero-width, so the same layout is one line
 * longer or shorter whether or not a colour is applied. `measureCard()` therefore
 * passes an identity painter and gets the exact count.
 *
 * The card is split into two zones on purpose:
 *   - `head` — the claim: title, impact, proof, steps, alternative. Variable.
 *   - `tail` — the decision: rule, three choices, rule, key hints. ALWAYS six
 *     lines, never wrapped, never scrolled.
 *
 * The menu is the one part of a decision window that must never be clipped, so it
 * lives in the tail and the head is what gets a scroll window.
 */

import { visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { ThemeColor } from "@earendil-works/pi-coding-agent";
import type { QuickWinCard } from "../../shared/card.js";
import type { CardStrings } from "../../shared/i18n.js";

/** The two style operations the layout needs; `Theme` satisfies it. */
export interface Painter {
	fg(color: ThemeColor, text: string): string;
	bold(text: string): string;
}

/** One rendered body line; `highlight` paints the selected choice stripe. */
export interface LayoutLine {
	text: string;
	highlight?: boolean;
}

export interface CardLayout {
	head: LayoutLine[];
	tail: LayoutLine[];
	/** `⏱ effort` — null when the header had no room for it. */
	badge: string | undefined;
}

/** The choice icons: language-neutral, so they stay in the layout. */
const ICONS: readonly string[] = ["🚀", "📅", "⏭"];

const FIELD_ICONS = {
	impact: "🎯",
	proof: "✅",
	steps: "📋",
	alternative: "🔀",
	effort: "⏱",
} as const;

const FIELD_COLORS: Record<keyof typeof FIELD_ICONS, ThemeColor> = {
	impact: "accent",
	proof: "success",
	steps: "borderAccent",
	alternative: "warning",
	effort: "warning",
};

/** Frames lines: the top and bottom border. */
export const FRAME_LINES = 2;

/** Fixed decision block: rule, three choices, rule, key hints. */
export const TAIL_LINES = 6;

/** Smallest card worth showing: title, a little text and the whole menu. */
export const MIN_CARD_HEIGHT = 12;

const IDENTITY: Painter = { fg: (_color, text) => text, bold: (text) => text };

/** Field-label column width, recomputed per locale so the table stays aligned. */
export function labelCol(s: CardStrings): number {
	return (
		Math.max(
			visibleWidth(`${FIELD_ICONS.impact} ${s.impact}`),
			visibleWidth(`${FIELD_ICONS.proof} ${s.proof}`),
			visibleWidth(`${FIELD_ICONS.steps} ${s.steps}`),
			visibleWidth(`${FIELD_ICONS.alternative} ${s.alternative}`),
			visibleWidth(`${FIELD_ICONS.effort} ${s.effort}`),
		) + 1
	);
}

/**
 * Lay the card out at `width`.
 *
 * `selected` only affects the choice styling; it never changes the line count,
 * which is why the presenter can measure without knowing it.
 */
export function layoutCard(
	card: QuickWinCard,
	s: CardStrings,
	width: number,
	paint: Painter,
	selected = 0,
): CardLayout {
	const col = labelCol(s);
	const badge = `⏱ ${s.effortUnits[card.effort]}`;
	// The effort rides in the header when there is room; on a narrow terminal it
	// drops into the field column instead of disappearing.
	const badgeInHeader = width - 2 >= visibleWidth(badge) + 24;
	const head: LayoutLine[] = [];

	head.push({ text: paint.bold(paint.fg("accent", card.title)) });
	head.push({ text: "" });
	if (!badgeInHeader) head.push({ text: field("effort", badge, width, col, s, paint) });
	head.push({ text: field("impact", card.impact, width, col, s, paint) });
	head.push({ text: field("proof", card.proof, width, col, s, paint) });
	head.push({ text: "" });
	head.push({
		text: paint.bold(paint.fg(FIELD_COLORS.steps, `${FIELD_ICONS.steps} ${s.steps}`)),
	});
	card.steps.forEach((step, i) => {
		head.push({ text: stepLine(step, i + 1, width, col, paint) });
	});
	if (card.alternative) {
		head.push({ text: "" });
		head.push({ text: field("alternative", card.alternative, width, col, s, paint) });
	}

	const tail: LayoutLine[] = [{ text: rule(width) }];
	s.choices.forEach((choice, i) => {
		tail.push({ text: choiceLine(choice, i, width, paint, selected === i), highlight: i === selected });
	});
	tail.push({ text: rule(width) });

	// Flattened: one entry per terminal row, so every count downstream (the overlay
	// height, the scroll window) counts rows and not wrapped fields.
	return {
		head: flatten(head),
		tail: flatten(tail),
		badge: badgeInHeader ? badge : undefined,
	};
}

/** Expand wrapped entries so one entry is one row. Highlight flags ride along. */
export function flatten(lines: readonly LayoutLine[]): LayoutLine[] {
	return lines.flatMap((line) =>
		line.text.split("\n").map((text) => (line.highlight ? { text, highlight: true } : { text })),
	);
}

/** The exact line count of `layoutCard`, without styling or a theme. */
export function measureCard(
	card: QuickWinCard,
	s: CardStrings,
	width: number,
): { head: number; tail: number; total: number } {
	const { head, tail } = layoutCard(card, s, width, IDENTITY);
	return { head: head.length, tail: tail.length, total: FRAME_LINES + head.length + TAIL_LINES };
}

/** A labelled, width-wrapped field. Returns lines joined by \n. */
function field(
	which: keyof typeof FIELD_ICONS,
	value: string,
	width: number,
	col: number,
	s: CardStrings,
	paint: Painter,
): string {
	const label =
		which === "impact"
			? s.impact
			: which === "proof"
				? s.proof
				: which === "alternative"
					? s.alternative
					: s.effort;
	const head = paint.bold(paint.fg(FIELD_COLORS[which], `${FIELD_ICONS[which]} ${label}`));
	return wrap(head, value, width, col);
}

/** A numbered step: an ordered list is content, a numbered menu was the bug. */
function stepLine(
	text: string,
	oneBased: number,
	width: number,
	col: number,
	paint: Painter,
): string {
	return wrap(`  ${paint.fg("accent", `${oneBased}.`)}`, text, width, col);
}

/**
 * Shared body path: the head is measured as-is, the value is wrapped to what is
 * left, and continuation lines are indented to the head's width.
 */
function wrap(head: string, value: string, width: number, headWidth: number): string {
	const indent = " ".repeat(headWidth);
	const available = Math.max(8, width - 2 - headWidth);
	return wrapTextWithAnsi(value, available)
		.map((line, i) =>
			i === 0
				? `${head}${" ".repeat(Math.max(0, headWidth - visibleWidth(head)))}${line}`
				: `${indent}${line}`,
		)
		.join("\n");
}

/** One choice row; the selected one carries the cursor and the bold label. */
function choiceLine(
	choice: { label: string; hint: string },
	index: number,
	width: number,
	paint: Painter,
	selected: boolean,
): string {
	const icon = `${ICONS[index] ?? ""} `;
	if (!selected) return `  ${paint.fg("dim", `${icon}${choice.label}`)}   ${paint.fg("dim", choice.hint)}`;
	return `${paint.bold(paint.fg("accent", "▸"))} ${paint.bold(`${icon}${choice.label}`)}   ${paint.fg("dim", choice.hint)}`;
}

/** A full-width dim rule; two columns narrower than the frame (body padding). */
export function rule(width: number): string {
	return "─".repeat(Math.max(0, width - 4));
}

/** How many head lines the card may show before the frame and the menu. */
export function headWindow(maxHeight: number): number {
	return Math.max(1, maxHeight - FRAME_LINES - TAIL_LINES);
}

export interface HeadWindow {
	lines: LayoutLine[];
	hiddenAbove: number;
	hiddenBelow: number;
}

/**
 * Window the head into `window` lines, scrolled by `scroll`.
 * When the head does not fit, one line of the window is spent on the scroll hint
 * — the menu staying complete matters more than one more line of prose.
 */
export function windowHead(
	head: readonly LayoutLine[],
	window: number,
	scroll: number,
	paint: Painter,
): HeadWindow {
	if (head.length <= window) {
		return { lines: [...head], hiddenAbove: 0, hiddenBelow: 0 };
	}
	const visible = Math.max(1, window - 1);
	const maxScroll = head.length - visible;
	const offset = Math.min(Math.max(0, scroll), maxScroll);
	const hiddenAbove = offset;
	const hiddenBelow = head.length - offset - visible;
	return {
		lines: [{ text: scrollHint(hiddenAbove, hiddenBelow, paint) }, ...head.slice(offset, offset + visible)],
		hiddenAbove,
		hiddenBelow,
	};
}

/** `↑ 3 above · ↓ 5 below` — only the side that exists is shown. */
function scrollHint(above: number, below: number, paint: Painter): string {
	const parts: string[] = [];
	if (above > 0) parts.push(paint.fg("accent", `↑ ${above}`));
	if (below > 0) parts.push(paint.fg("accent", `↓ ${below}`));
	return `  ${paint.fg("dim", `${parts.join(paint.fg("border", " · "))} ${paint.fg("dim", "· PgUp/PgDn")}`)}`;
}
