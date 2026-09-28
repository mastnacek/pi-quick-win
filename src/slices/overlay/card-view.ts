/**
 * CardView — the overlay card: one increment, its cost, its steps, its proof,
 * and three typed choices.
 *
 * This is the one screen the user sees per task, so it is built like a
 * notification rather than a debug dump: an accent frame, an emoji-labelled
 * field column, a highlighted choice row and a key-hint footer.
 *
 * Two hard rules survive the styling:
 * - Every rendered line is truncated to the supplied width, because the terminal
 *   may be arbitrarily narrow and an overflowing line corrupts the whole frame
 *   (docs/tui.md: "Every rendered line must fit within the supplied width").
 * - Styling is applied per line at render time — Pi resets styles after each
 *   line, so nothing is cached with ANSI embedded. Padding is computed on
 *   *visible* width: emoji are two cells and ANSI escapes are zero.
 */

import type { Component } from "@earendil-works/pi-tui";
import { matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { CHOICES, type QuickWinCard, type QuickWinChoice } from "../../shared/card.js";

/** Short labels for the three choices, in CHOICES order. */
const LABELS: ReadonlyArray<{ icon: string; label: string; hint: string }> = [
	{ icon: "🚀", label: "deliver now", hint: "implement exactly this increment" },
	{ icon: "📅", label: "later", hint: "keep it for a later session" },
	{ icon: "⏭", label: "skip", hint: "not today, stop asking in this task" },
];

/** One field column: emoji + name, each in its own color so the eye can skim. */
const FIELDS = {
	impact: { icon: "🎯", label: "Impact", color: "accent" },
	proof: { icon: "✅", label: "Proof", color: "success" },
	steps: { icon: "📋", label: "Steps", color: "borderAccent" },
	alternative: { icon: "🔀", label: "Other cut", color: "warning" },
	effort: { icon: "⏱", label: "Effort", color: "warning" },
} as const satisfies Record<string, { icon: string; label: string; color: ThemeColor }>;

/** Visible width of the field column, so values line up like a table. */
const LABEL_COL =
	Math.max(...Object.values(FIELDS).map((f) => visibleWidth(`${f.icon} ${f.label}`))) + 1;

/** A body line, optionally painted as the highlighted choice row. */
interface BodyLine {
	text: string;
	highlight?: boolean;
}

export class CardView implements Component {
	private index = 0;

	constructor(
		private readonly card: QuickWinCard,
		private readonly theme: Theme,
		private readonly done: (choice: QuickWinChoice) => void,
	) {}

	invalidate(): void {
		// Stateless rendering: nothing is cached, so nothing to drop.
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c") || data === "q") {
			this.done("skip");
			return;
		}
		if (matchesKey(data, "return")) {
			this.choose(this.index + 1);
			return;
		}
		const digit = Number.parseInt(data, 10);
		if (Number.isInteger(digit) && digit >= 1 && digit <= CHOICES.length) {
			this.choose(digit);
			return;
		}
		if (matchesKey(data, "up") || data === "k") {
			this.index = (this.index + CHOICES.length - 1) % CHOICES.length;
			return;
		}
		if (matchesKey(data, "down") || data === "j") {
			this.index = (this.index + 1) % CHOICES.length;
		}
	}

	/** Confirm row `oneBased`; out-of-range input is ignored, never guessed. */
	private choose(oneBased: number): void {
		const choice = CHOICES[oneBased - 1];
		if (choice) this.done(choice);
	}

	render(width: number): string[] {
		const th = this.theme;
		const body: BodyLine[] = [];
		const badge = `⏱ ${this.card.effort}`;
		// The effort rides in the header when there is room for it; on a narrow
		// terminal it drops into the field column instead of disappearing.
		const badgeInHeader = width - 2 >= visibleWidth(badge) + 24;

		body.push({ text: th.bold(th.fg("accent", this.card.title)) });
		body.push({ text: "" });
		if (!badgeInHeader) {
			body.push({ text: this.field(FIELDS.effort, this.card.effort, width) });
		}
		body.push({ text: this.field(FIELDS.impact, this.card.impact, width) });
		body.push({ text: this.field(FIELDS.proof, this.card.proof, width) });
		body.push({ text: "" });
		body.push({ text: th.bold(th.fg(FIELDS.steps.color, `${FIELDS.steps.icon} ${FIELDS.steps.label}`)) });
		this.card.steps.forEach((step, i) => {
			body.push({ text: this.step(step, i + 1, width) });
		});
		if (this.card.alternative) {
			body.push({ text: "" });
			body.push({ text: this.field(FIELDS.alternative, this.card.alternative, width) });
		}

		body.push({ text: this.rule(width) });
		LABELS.forEach((choice, i) => {
			body.push({ text: this.choice(choice, i), highlight: i === this.index });
		});
		body.push({ text: this.rule(width) });
		body.push({ text: this.footer() });

		return this.frame(body, width, badgeInHeader ? badge : undefined);
	}

	/** A labelled, width-wrapped field. Returns lines joined by \n. */
	private field(
		field: { icon: string; label: string; color: ThemeColor },
		value: string,
		width: number,
	): string {
		const head = this.theme.bold(this.theme.fg(field.color, `${field.icon} ${field.label}`));
		return this.wrap(head, value, width, LABEL_COL);
	}

	/** A numbered step, wrapped under itself rather than under the number. */
	private step(text: string, oneBased: number, width: number): string {
		const number = this.theme.fg("accent", `${oneBased}.`);
		return this.wrap(`  ${number}`, text, width, LABEL_COL);
	}

	/**
	 * Shared body/wrap path: the head is measured as-is, the value is wrapped to
	 * what is left, and continuation lines are indented to the head's width.
	 */
	private wrap(head: string, value: string, width: number, headWidth: number): string {
		const indent = " ".repeat(headWidth);
		const available = Math.max(8, width - 2 - headWidth);
		const wrapped = wrapTextWithAnsi(value, available);
		return wrapped
			.map((line, i) => (i === 0 ? `${head}${" ".repeat(Math.max(0, headWidth - visibleWidth(head)))}${line}` : `${indent}${line}`))
			.join("\n");
	}

	/** One choice row; the selected one carries the cursor, the key and the label. */
	private choice(
		choice: { icon: string; label: string; hint: string },
		index: number,
	): string {
		const th = this.theme;
		if (index !== this.index) {
			return `  ${th.fg("dim", `${index + 1}  ${choice.icon} ${choice.label}`)}   ${th.fg("dim", choice.hint)}`;
		}
		const cursor = th.bold(th.fg("accent", "▸"));
		const key = th.bold(th.fg("accent", `${index + 1}`));
		return `${cursor} ${key}  ${choice.icon} ${th.bold(choice.label)}   ${th.fg("dim", choice.hint)}`;
	}

	/** A full-width dim rule, used instead of an empty line to group the card.
	 *  Two columns narrower than the frame: the body has one space of padding. */
	private rule(width: number): string {
		return this.theme.fg("border", "─".repeat(Math.max(0, width - 4)));
	}

	/** Key hints with colored glyphs, so the keyboard story is readable at a glance. */
	private footer(): string {
		const th = this.theme;
		const key = (glyph: string, text: string) =>
			`${th.bold(th.fg("accent", glyph))} ${th.fg("dim", text)}`;
		return [key("↑↓", "move"), key("1-3", "pick"), key("⏎", "confirm"), key("esc", "skip")].join(
			` ${th.fg("border", "·")} `,
		);
	}

	/** Draw the card border, clamping every interior line to the usable width. */
	private frame(body: BodyLine[], width: number, badge?: string): string[] {
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
		lines.push(`${th.fg("borderAccent", "╰")}${th.fg("borderAccent", "─".repeat(inner))}${th.fg("borderAccent", "╯")}`);
		return lines.map((line) => truncateToWidth(line, width));
	}

	/** Top border: accent title, dim rule, effort badge, closing corner. */
	private header(inner: number, badge?: string): string {
		const th = this.theme;
		const title = th.bold(th.fg("accent", " ⚡ QUICK WIN "));
		const badgeText = badge ? th.fg("warning", ` ${badge} `) : "";
		const fill = Math.max(0, inner - visibleWidth(title) - visibleWidth(badgeText));
		return `${th.fg("borderAccent", "╭")}${title}${th.fg("border", "─".repeat(fill))}${badgeText}${th.fg("borderAccent", "╮")}`;
	}

	private pad(text: string, inner: number): string {
		const clipped = truncateToWidth(text, inner);
		// Padding is computed on the *visible* width: wide characters, emoji and
		// ANSI escapes all make string length the wrong measure.
		return `${clipped}${" ".repeat(Math.max(0, inner - visibleWidth(clipped)))}`;
	}
}
