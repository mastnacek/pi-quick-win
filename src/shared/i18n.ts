/**
 * i18n — the card's own vocabulary, in one place.
 *
 * The card *body* is model-authored English (the agent is forced to work in
 * English) and may be translated by a separate plugin; the vocabulary around it
 * — the three choices, the field labels, the footer, the effort unit — belongs
 * to this plugin and no one else can reach it. So it ships here, per locale.
 *
 * English stays the default: the plugin is installed from a public repo and the
 * model-facing tool result is English in every locale.
 *
 * Icons and colors stay in the view: they are language-neutral, and keeping them
 * here would only split one table across two files.
 */

import type { QuickWinEffort } from "./card.js";

export const LOCALES = ["en", "cs"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export interface ChoiceCopy {
	label: string;
	hint: string;
}

export interface CardStrings {
	/** Header brand. Kept identical across locales: it is the product name. */
	title: string;
	impact: string;
	proof: string;
	steps: string;
	alternative: string;
	effort: string;
	/** Aligned with CHOICES by index — a missing entry would mislabel a button. */
	choices: readonly ChoiceCopy[];
	footer: { move: string; pick: string; confirm: string; skip: string };
	/** Display units for the effort badge; the enum itself never changes. */
	effortUnits: Record<QuickWinEffort, string>;
}

const STRINGS: Record<Locale, CardStrings> = {
	en: {
		title: "QUICK WIN",
		impact: "Impact",
		proof: "Proof",
		steps: "Steps",
		alternative: "Other cut",
		effort: "Effort",
		choices: [
			{ label: "deliver now", hint: "implement exactly this increment" },
			{ label: "later", hint: "keep it for a later session" },
			{ label: "skip", hint: "not now — nothing is recorded" },
		],
		footer: { move: "move", pick: "pick", confirm: "confirm", skip: "close" },
		effortUnits: { minutes: "minutes", hour: "hour", hours: "hours", day: "day" },
	},
	cs: {
		title: "QUICK WIN",
		impact: "Dopad",
		proof: "Důkaz",
		steps: "Kroky",
		alternative: "Jiná varianta",
		effort: "Čas",
		choices: [
			{ label: "roznout ihned", hint: "implementovat přesně tento přírůstek" },
			{ label: "později", hint: "nechat na pozdější relaci" },
			{ label: "přeskočit", hint: "teď ne — neuloží se nic" },
		],
		footer: { move: "pohyb", pick: "vybrat", confirm: "potvrdit", skip: "zavřít" },
		effortUnits: { minutes: "minuty", hour: "hodina", hours: "hodiny", day: "den" },
	},
};

/** The string table for a locale; an unknown locale falls back to English. */
export function stringsFor(locale: string | undefined): CardStrings {
	return STRINGS[normalizeLocale(locale)];
}

/** Accept the obvious spellings; anything else is English, never a crash. */
export function normalizeLocale(raw: string | undefined): Locale {
	const token = (raw ?? "").trim().toLowerCase();
	if (token === "cs" || token === "cz" || token === "cze" || token === "cesky") return "cs";
	return DEFAULT_LOCALE;
}
