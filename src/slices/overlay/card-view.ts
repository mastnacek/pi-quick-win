/**
 * CardView — the overlay card: one increment, its cost, its steps, its proof,
 * and three typed choices.
 *
 * Every rendered line is truncated to the supplied width, because the terminal
 * may be arbitrarily narrow and an overflowing line corrupts the whole frame
 * (docs/tui.md: "Every rendered line must fit within the supplied width").
 * Styling is applied per line at render time — Pi resets styles after each
 * line, so nothing is cached with ANSI embedded.
 */

import type { Component } from "@earendil-works/pi-tui";
import { matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { CHOICES, type QuickWinCard, type QuickWinChoice } from "../../shared/card.js";

/** Short labels for the three choices, in CHOICES order. */
const LABELS: ReadonlyArray<{ label: string; hint: string }> = [
	{ label: "deliver now", hint: "implement exactly this increment" },
	{ label: "later", hint: "keep it for a later session" },
	{ label: "skip", hint: "not today, stop asking in this task" },
];

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
		const body: string[] = [];

		body.push(th.bold(this.card.title));
		body.push("");
		body.push(...this.field("Impact", this.card.impact, width));
		body.push(`${th.fg("muted", "Effort")}  ${this.card.effort}`);
		body.push(`${th.fg("muted", "Proof")}   ${this.card.proof}`);
		body.push("");
		body.push(th.fg("muted", "Steps"));
		this.card.steps.forEach((step, i) => {
			body.push(`  ${i + 1}. ${step}`);
		});
		if (this.card.alternative) {
			body.push("");
			body.push(...this.field("Other cut", this.card.alternative, width));
		}

		body.push("");
		for (const [i, label] of LABELS.entries()) {
			const selected = i === this.index;
			const cursor = selected ? th.fg("accent", "▸") : " ";
			const text = `${i + 1} ${label.label}`;
			const painted = selected ? th.fg("accent", text) : text;
			body.push(`${cursor} ${painted}  ${th.fg("dim", label.hint)}`);
		}
		body.push("");
		body.push(th.fg("dim", "↑↓ select · 1-3 or enter confirm · esc skip"));

		return this.frame(body, width);
	}

	/** A labelled, width-wrapped field. */
	private field(label: string, value: string, width: number): string[] {
		const indent = " ".repeat(label.length + 2);
		const wrapped = wrapTextWithAnsi(value, Math.max(8, width - 4 - label.length));
		return wrapped.map((line, i) =>
			i === 0 ? `${this.theme.fg("muted", label)}  ${line}` : `${indent}${line}`,
		);
	}

	/** Draw the card border, clamping every interior line to the usable width. */
	private frame(body: string[], width: number): string[] {
		const inner = Math.max(1, width - 2);
		const title = " quick win ";
		const topFill = "─".repeat(Math.max(0, inner - title.length));
		const lines: string[] = [`┌${title}${topFill}┐`];

		for (const line of body) {
			for (const piece of line.split("\n")) {
				lines.push(`│${this.pad(piece, inner)}│`);
			}
		}
		lines.push(`└${"─".repeat(inner)}┘`);
		return lines.map((line) => truncateToWidth(line, width));
	}

	private pad(text: string, inner: number): string {
		const clipped = truncateToWidth(text, inner);
		// Padding is computed on the *visible* width: wide characters, emoji and
		// ANSI escapes all make string length the wrong measure.
		return `${clipped}${ " ".repeat(Math.max(0, inner - visibleWidth(clipped))) }`;
	}
}