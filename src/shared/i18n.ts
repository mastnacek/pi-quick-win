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
	footer: { move: string; pick: string; confirm: string; skip: string; scroll: string };
	/** Display units for the effort badge; the enum itself never changes. */
	effortUnits: Record<QuickWinEffort, string>;
}

/** Where a setting was persisted; the command feedback names it. */
export type CommandScope = "global" | "project";

/**
 * Command feedback and completion-menu copy. The tool result text stays
 * English (model-facing); everything a *user* reads from /quick-win comes
 * from here, per locale.
 */
export interface CommandStrings {
	enabled(scope: CommandScope): string;
	muted(scope: CommandScope): string;
	usageLimit: string;
	usageLang: string;
	limitSet(value: string, scope: CommandScope): string;
	langSet(lang: string, scope: CommandScope): string;
	laterEmpty: string;
	laterItem(index: number, title: string): string;
	cleared: string;
	unknown(sub: string): string;
	/** The `/quick-win info` readout, one labeled line per key. */
	info: {
		state(enabled: boolean): string;
		echo(on: boolean): string;
		limit(value: string): string;
		lang(locale: string): string;
		deferred(count: number): string;
		cards(count: number): string;
		scopeHint: string;
	};
	/** Completion-picker copy, including the active-value marker. */
	menu: {
		commandDescription: string;
		active: string;
		global: string;
		info: string;
		later: string;
		clear: string;
		on: string;
		off: string;
		limitParent(value: string): string;
		langParent(value: string): string;
		limitUnlimited: string;
		limitCount(n: number): string;
		langEn: string;
		langCs: string;
	};
}

const STRINGS: Record<Locale, CardStrings & { commands: CommandStrings }> = {
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
		footer: { move: "move", pick: "pick", confirm: "confirm", skip: "close", scroll: "scroll" },
		effortUnits: { minutes: "minutes", hour: "hour", hours: "hours", day: "day" },
		commands: {
			enabled: (scope) => `quick-win enabled ${scope === "global" ? "globally" : "for this project"}.`,
		muted: (scope) => `quick-win muted ${scope === "global" ? "globally" : "for this project"}.`,
		usageLimit: "Usage: /quick-win limit <n|unlimited> [--global]",
		usageLang: "Usage: /quick-win lang <cs|en> [--global]",
		limitSet: (value, scope) =>
			`Card limit per task: ${value}${scope === "global" ? " (global)" : " (project)"}`,
		langSet: (lang, scope) =>
			`Card UI language: ${lang}${scope === "global" ? " (global)" : " (project)"}`,
		laterEmpty: "No deferred quick wins.",
		laterItem: (index, title) => `${index}. ${title}`,
		cleared: "Deferred quick wins cleared.",
		unknown: (sub) => `Unknown subcommand "${sub}". Use: /quick-win info`,
		info: {
			state: (enabled) => `quick-win: ${enabled ? "enabled" : "muted"}`,
			echo: (on) => `closing echo: ${on ? "on" : "off"}`,
			limit: (value) => `card limit per task: ${value}`,
			lang: (locale) => `card UI language: ${locale}`,
			deferred: (count) => `deferred: ${count}`,
			cards: (count) => `cards in this task: ${count}`,
			scopeHint: "scope: `--global` writes ~/.pi/agent/, otherwise <cwd>/.pi.",
		},
		menu: {
			commandDescription:
				"Quick-win controls (/quick-win [info|later|clear|on|off|limit <n|unlimited>] [--global])",
			active: " · ● ACTIVE",
			global: "Save the following setting globally (~/.pi/agent/)",
			info: "Show state and the deferred count",
			later: "List deferred quick wins",
			clear: "Empty the deferred list",
			on: "Unmute the plugin",
			off: "Mute the plugin (no cards, no echo)",
			limitParent: (value) => `Cards per task [● ${value}]`,
			langParent: (value) => `Language of the card UI [● ${value}]`,
			limitUnlimited: "No cap — every new increment may be announced",
			limitCount: (n) => `At most ${n} card${n === 1 ? "" : "s"} per task`,
			langEn: "Card UI in English",
			langCs: "Card UI in Czech",
		},
	},
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
		footer: { move: "pohyb", pick: "vybrat", confirm: "potvrdit", skip: "zavřít", scroll: "rolovat" },
		effortUnits: { minutes: "minuty", hour: "hodina", hours: "hodiny", day: "den" },
		commands: {
		enabled: (scope) => `quick-win zapnuto ${scope === "global" ? "globálně" : "pro tento projekt"}.`,
		muted: (scope) => `quick-win ztlumeno ${scope === "global" ? "globálně" : "pro tento projekt"}.`,
		usageLimit: "Použití: /quick-win limit <n|unlimited> [--global]",
		usageLang: "Použití: /quick-win lang <cs|en> [--global]",
		limitSet: (value, scope) =>
			`Limit karet na úkol: ${value}${scope === "global" ? " (globálně)" : " (v projektu)"}`,
		langSet: (lang, scope) =>
			`Jazyk karet: ${lang}${scope === "global" ? " (globálně)" : " (v projektu)"}`,
		laterEmpty: "Žádné odložené quick winy.",
		laterItem: (index, title) => `${index}. ${title}`,
		cleared: "Odložené quick winy byly vymazány.",
		unknown: (sub) => `Neznámý podpříkaz "${sub}". Použijte: /quick-win info`,
		info: {
			state: (enabled) => `quick-win: ${enabled ? "zapnuto" : "ztlumeno"}`,
			echo: (on) => `uzavírací echo: ${on ? "zapnuto" : "vypnuto"}`,
			limit: (value) => `limit karet na úkol: ${value}`,
			lang: (locale) => `jazyk karet: ${locale}`,
			deferred: (count) => `odloženo: ${count}`,
			cards: (count) => `karet v této úloze: ${count}`,
			scopeHint: "scope: `--global` zapíše do ~/.pi/agent/, jinak <cwd>/.pi.",
		},
		menu: {
			commandDescription:
				"Ovládání quick-win (/quick-win [info|later|clear|on|off|limit <n|unlimited>] [--global])",
			active: " · ● AKTIVNÍ",
			global: "Uloží následující nastavení globálně (~/.pi/agent/)",
			info: "Zobrazí stav a počet odložených",
			later: "Vypíše odložené quick winy",
			clear: "Vymaže seznam odložených",
			on: "Zapne plugin",
			off: "Ztlumí plugin (žádné karty, žádné echo)",
			limitParent: (value) => `Karet na úkol [● ${value}]`,
			langParent: (value) => `Jazyk karet [● ${value}]`,
			limitUnlimited: "Bez limitu — každý nový přírůstek může být ohlášen",
			limitCount: (n) =>
				n === 1 ? "Nejvýše 1 karta na úkol" : n < 5 ? `Nejvýše ${n} karty na úkol` : `Nejvýše ${n} karet na úkol`,
			langEn: "Karty v angličtině",
			langCs: "Karty v češtině",
		},
	},
	},
};

/** The string table for a locale; an unknown locale falls back to English. */
export function stringsFor(locale: string | undefined): CardStrings {
	return STRINGS[normalizeLocale(locale)];
}

/** The command feedback + completion-menu table for a locale. */
export function commandsFor(locale: string | undefined): CommandStrings {
	return STRINGS[normalizeLocale(locale)].commands;
}

/** Accept the obvious spellings; anything else is English, never a crash. */
export function normalizeLocale(raw: string | undefined): Locale {
	const token = (raw ?? "").trim().toLowerCase();
	if (token === "cs" || token === "cz" || token === "cze" || token === "cesky") return "cs";
	return DEFAULT_LOCALE;
}
