/**
 * `/quick-win` command — mute switch, card limit, the deferred list, and a status readout.
 *
 * Completions follow the Trailing Space Contract: `off`, `on`, `info`, `later`, `clear` and the `limit` leaves
 * are terminal (no trailing space), while `limit` itself takes an argument and therefore offers one.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { saveConfig } from "../../shared/config.js";
import { paintBadge } from "../../shared/status.js";
import type { SelfQuickWinState } from "../../shared/state.js";
import { LOCALES, normalizeLocale, type Locale } from "../../shared/i18n.js";

/** True only for an explicit, supported locale token. */
function isLocale(raw: string): boolean {
	return (LOCALES as readonly string[]).includes(raw.trim().toLowerCase());
}

/** Operations the command needs, supplied by the composition root. */
export interface CommandDeps {
	describeLater(state: SelfQuickWinState): string;
	clearLater(pi: ExtensionAPI, state: SelfQuickWinState): void;
}

interface Row {
	label: string;
	value: string;
	description?: string;
}

const GLOBAL_ROW: Row = {
	label: "--global",
	value: "--global ",
	description: "Save the following setting globally (~/.pi/agent/)",
};

/** The two setting leaves, with the value currently in effect marked. */
function toggleRows(enabled: boolean): Row[] {
	return [
		{
			// `value` stays a clean token: it is inserted verbatim into the editor.
			label: enabled ? "on ✓" : "on",
			value: "on",
			description: `Unmute the plugin${enabled ? " · ● AKTIVNÍ" : ""}`,
		},
		{
			label: enabled ? "off" : "off ✓",
			value: "off",
			description: `Mute the plugin (no cards, no echo)${enabled ? "" : " · ● AKTIVNÍ"}`,
		},
	];
}

/** The card-limit leaves, with the value currently in effect marked. */
function limitRows(limit: number): Row[] {
	return [0, 1, 3, 10].map((value) => {
		const token = value === 0 ? "unlimited" : String(value);
		return {
			label: limit === value ? `${token} ✓` : token,
			value: token,
			description:
				value === 0
					? `No cap — every new increment may be announced${limit === 0 ? " · ● AKTIVNÍ" : ""}`
					: `At most ${value} card${value === 1 ? "" : "s"} per task${limit === value ? " · ● AKTIVNÍ" : ""}`,
		};
	});
}

/** The language leaves, with the value currently in effect marked. */
function langRows(lang: Locale): Row[] {
	return LOCALES.map((locale) => ({
		label: lang === locale ? `${locale} ✓` : locale,
		value: locale,
		description: `Card UI in ${locale === "cs" ? "Czech" : "English"}${lang === locale ? " · ● AKTIVNÍ" : ""}`,
	}));
}

/**
 * Setting catalogue, read live so the menu never shows a stale snapshot.
 * `off`/`on`/`limit`/`lang` are settings; `info`/`later`/`clear` are actions and carry no state.
 */
function catalogue(enabled: boolean, limit: number, lang: Locale): readonly Row[] {
	return [
		{ label: "info", value: "info", description: "Show state and the deferred count" },
		{ label: "later", value: "later", description: "List deferred quick wins" },
		{ label: "clear", value: "clear", description: "Empty the deferred list" },
		...toggleRows(enabled),
		// Non-terminal: `limit` and `lang` take a value, so they keep the trailing space.
		{ label: "limit", value: "limit ", description: `Cards per task [● ${limit === 0 ? "unlimited" : limit}]` },
		{ label: "lang", value: "lang ", description: `Language of the card UI [● ${lang}]` },
		GLOBAL_ROW,
	];
}

const SETTING_SUBS = new Set([
	"off",
	"on",
	"limit",
	"unlimited",
	"1",
	"3",
	"10",
	"lang",
	...LOCALES,
]);

/** `limit` or `lang` followed by whitespace: the argument reached the value level. */
const VALUE_LEVEL = /^(?:limit|lang)\s+/i;

/** First whitespace-delimited token of the typed prefix. */
function firstToken(text: string): string {
	const [head = ""] = text.split(/\s+/).filter(Boolean);
	return head;
}

/** The bare token of a row label, without the `✓` state marker. */
function bare(label: string): string {
	const [token = ""] = label.split(" ");
	return token;
}

/** Completion rows for everything after `/quick-win `. */
function completions(prefix: string, enabled: boolean, limit: number, lang: Locale): Row[] | null {
	const rows = catalogue(enabled, limit, lang);
	const trimmed = prefix.trimStart();
	const afterGlobal = trimmed.startsWith("--global") ? trimmed.slice(8).trimStart() : null;

	const clean = (text: string, global: boolean): Row[] | null => {
		const head = firstToken(text).toLowerCase();
		// `limit ` / `lang ` open a second level: the leaves, narrowed by the rest.
		if (VALUE_LEVEL.test(text)) {
			const typed = text.replace(VALUE_LEVEL, "").trim().toLowerCase();
			const leaves = (head === "lang" ? langRows(lang) : limitRows(limit)).filter((row) =>
				startsWith(row.label, typed),
			);
			return leaves.length > 0
				? leaves.map((row) => (global ? { ...row, value: `--global ${head} ${row.value}` } : row))
				: null;
		}
		const items = rows.filter((row) => row.label !== "--global" && startsWith(row.label, head));
		if (items.length === 0) return null;
		if (!global) return [...items];
		return items.map((row) =>
			// `value` replaces the whole argument string, so the prefix is re-applied.
			SETTING_SUBS.has(bare(row.label)) ? { ...row, value: `--global ${row.value}` } : row,
		);
	};

	if (afterGlobal === null) {
		// Without `--global` the whole argument is a plain first-level prefix —
		// except once it has reached a value level.
		if (VALUE_LEVEL.test(trimmed)) return clean(trimmed, false);
		const items = rows.filter((row) => startsWith(row.label, trimmed.toLowerCase()));
		return items.length > 0 ? [...items] : null;
	}

	// `--global` was typed: offer the setting leaves it can actually carry.
	if (afterGlobal === "" && !/\s$/.test(trimmed)) return [GLOBAL_ROW];
	const items = clean(afterGlobal, true).filter((row) => SETTING_SUBS.has(bare(row.label)));
	return items.length > 0 ? items : null;
}

/** Match on the bare token: the `✓` marker must not affect filtering. */
function startsWith(label: string, prefix: string): boolean {
	return bare(label).startsWith(prefix);
}

function handleToggle(
	state: SelfQuickWinState,
	value: string,
	ctx: ExtensionCommandContext,
	isGlobal: boolean,
): void {
	const enabled = value === "on";
	state.config.enabled = enabled;
	// Persist ONLY the changed key, so the nearer layer never freezes the rest.
	saveConfig({ enabled }, isGlobal, ctx.cwd, state.globalFile);

	if (!ctx.hasUI) return;
	const scope = isGlobal ? "globally" : "for this project";
	ctx.ui.notify(enabled ? `quick-win enabled ${scope}.` : `quick-win muted ${scope}.`, "info");
	// Repaint immediately: the mute state is visible without asking for it.
	paintBadge(state, ctx);
}

function describeInfo(state: SelfQuickWinState, ctx: ExtensionCommandContext): string {
	const limit = state.config.cardLimit;
	return (
		`quick-win: ${state.config.enabled ? "enabled" : "muted"}\n` +
		`closing echo: ${state.config.echo ? "on" : "off"}\n` +
		`card limit per task: ${limit === 0 ? "unlimited" : limit}\n` +
		`card UI language: ${state.config.lang}\n` +
		`deferred: ${state.later.length}\n` +
		`cards in this task: ${state.cardsShownThisTask}\n` +
		"scope: `--global` writes ~/.pi/agent/, otherwise <cwd>/.pi/."
	);
}

/** Parse `unlimited` / `0` / a positive count; anything else means "leave it". */
function parseLimit(raw: string | undefined): number | undefined {
	if (raw === undefined) return undefined;
	const token = raw.trim().toLowerCase();
	if (token === "unlimited" || token === "off" || token === "0") return 0;
	const value = Number.parseInt(token, 10);
	if (!Number.isInteger(value) || value < 0) return undefined;
	return value;
}

export function registerQuickWinCommand(
	pi: ExtensionAPI,
	state: SelfQuickWinState,
	deps: CommandDeps,
): void {
	pi.registerCommand("quick-win", {
		description:
			"Quick-win controls (/quick-win [info|later|clear|on|off|limit <n|unlimited>] [--global])",
		// Live state at completion time, never a snapshot from registration.
		getArgumentCompletions: (prefix) =>
			completions(prefix, state.config.enabled, state.config.cardLimit, state.config.lang),

		handler: async (args, ctx) => {
			// `--global` targets ~/.pi/agent/, its absence targets <cwd>/.pi/.
			const rawTokens = args.trim().split(/\s+/).filter(Boolean);
			const isGlobal = rawTokens.some((token) => token.toLowerCase() === "--global");
			const tokens = rawTokens.filter((token) => token.toLowerCase() !== "--global");
			const sub = (tokens[0] ?? "info").toLowerCase();

			if (sub === "off" || sub === "on") {
				handleToggle(state, sub, ctx, isGlobal);
				return;
			}

			if (sub === "limit") {
				const limit = parseLimit(tokens[1]);
				if (limit === undefined) {
					if (ctx.hasUI) {
						ctx.ui.notify(
							"Usage: /quick-win limit <n|unlimited> [--global]",
							"warning",
						);
					}
					return;
				}
				// Persist ONLY the changed key, so the nearer layer never freezes the rest.
				saveConfig({ cardLimit: limit }, isGlobal, ctx.cwd, state.globalFile);
				state.config = { ...state.config, cardLimit: limit };
				if (ctx.hasUI) {
					ctx.ui.notify(
						`Card limit per task: ${limit === 0 ? "unlimited" : limit}${isGlobal ? " (global)" : " (project)"}`,
						"info",
					);
				}
				return;
			}

			if (sub === "lang") {
				const locale = normalizeLocale(tokens[1]);
				// Only an explicit, recognised token may change it; a typo must not
				// silently reset the UI to English.
				if (tokens[1] === undefined || !isLocale(tokens[1])) {
					if (ctx.hasUI) {
						ctx.ui.notify(
							"Usage: /quick-win lang <cs|en> [--global]",
							"warning",
						);
					}
					return;
				}
				saveConfig({ lang: locale }, isGlobal, ctx.cwd, state.globalFile);
				state.config = { ...state.config, lang: locale };
				if (ctx.hasUI) {
					ctx.ui.notify(
						`Card UI language: ${locale}${isGlobal ? " (global)" : " (project)"}`,
						"info",
					);
				}
				return;
			}

			if (sub === "later") {
				if (ctx.hasUI) ctx.ui.notify(deps.describeLater(state), "info");
				return;
			}

			if (sub === "clear") {
				deps.clearLater(pi, state);
				paintBadge(state, ctx);
				if (ctx.hasUI) ctx.ui.notify("Deferred quick wins cleared.", "info");
				return;
			}

			if (sub !== "info") {
				if (ctx.hasUI) {
					ctx.ui.notify(`Unknown subcommand "${sub}". Use: /quick-win info`, "warning");
				}
				return;
			}

			if (ctx.hasUI) ctx.ui.notify(describeInfo(state, ctx), "info");
		},
	});
}