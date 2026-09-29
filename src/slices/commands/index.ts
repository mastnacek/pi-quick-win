/**
 * `/quick-win` command — mute switch, card limit, the deferred list, and a status readout.
 *
 * Completions follow the Trailing Space Contract: `off`, `on`, `info`, `later`, `clear` and the `limit`
 * leaves are terminal (no trailing space), while `limit` itself takes an argument and therefore offers one.
 *
 * Lazy Parameter Completion: a fully typed non-terminal token (`limit`, `lang`, `--global`, no trailing
 * space) immediately reveals its child list — Tab-confirming the trailing-space form closes the picker and
 * would otherwise strand the parameters.
 *
 * Every user-visible string comes from the locale table (`commandsFor`); the model-facing surfaces stay
 * English.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { loadConfig, saveConfig } from "../../shared/config.js";
import { paintBadge } from "../../shared/status.js";
import type { SelfQuickWinState } from "../../shared/state.js";
import {
	commandsFor,
	LOCALES,
	normalizeLocale,
	type CommandScope,
	type CommandStrings,
	type Locale,
} from "../../shared/i18n.js";
import type { LaterItem } from "../../shared/state.js";

/** True only for an explicit, supported locale token. */
function isLocale(raw: string): boolean {
	return (LOCALES as readonly string[]).includes(raw.trim().toLowerCase());
}

/** Operations the command needs, supplied by the composition root. */
export interface CommandDeps {
	describeLater(items: LaterItem[], strings: CommandStrings): string;
	clearLater(pi: ExtensionAPI, state: SelfQuickWinState): void;
}

interface Row {
	label: string;
	value: string;
	description?: string;
}

/** The two setting leaves, with the value currently in effect marked. */
function toggleRows(enabled: boolean, s: CommandStrings): Row[] {
	return [
		{
			// `value` stays a clean token: it is inserted verbatim into the editor.
			label: enabled ? "on ✓" : "on",
			value: "on",
			description: `${s.menu.on}${enabled ? s.menu.active : ""}`,
		},
		{
			label: enabled ? "off" : "off ✓",
			value: "off",
			description: `${s.menu.off}${enabled ? "" : s.menu.active}`,
		},
	];
}

/** The card-limit leaves, with the value currently in effect marked. */
function limitRows(limit: number, s: CommandStrings): Row[] {
	return [0, 1, 3, 10].map((value) => {
		const token = value === 0 ? "unlimited" : String(value);
		return {
			label: limit === value ? `${token} ✓` : token,
			value: token,
			description:
				value === 0
					? `${s.menu.limitUnlimited}${limit === 0 ? s.menu.active : ""}`
					: `${s.menu.limitCount(value)}${limit === value ? s.menu.active : ""}`,
		};
	});
}

/** The language leaves, with the value currently in effect marked. */
function langRows(lang: Locale, s: CommandStrings): Row[] {
	return LOCALES.map((locale) => ({
		label: lang === locale ? `${locale} ✓` : locale,
		value: locale,
		description: `${locale === "cs" ? s.menu.langCs : s.menu.langEn}${lang === locale ? s.menu.active : ""}`,
	}));
}

/**
 * Setting catalogue, read live so the menu never shows a stale snapshot.
 * `off`/`on`/`limit`/`lang` are settings; `info`/`later`/`clear` are actions and carry no state.
 */
function catalogue(enabled: boolean, limit: number, lang: Locale, s: CommandStrings): readonly Row[] {
	return [
		{ label: "info", value: "info", description: s.menu.info },
		{ label: "later", value: "later", description: s.menu.later },
		{ label: "clear", value: "clear", description: s.menu.clear },
		...toggleRows(enabled, s),
		// Non-terminal: `limit` and `lang` take a value, so they keep the trailing space.
		{
			label: "limit",
			value: "limit ",
			description: s.menu.limitParent(limit === 0 ? "unlimited" : String(limit)),
		},
		{ label: "lang", value: "lang ", description: s.menu.langParent(lang) },
		{ label: "--global", value: "--global ", description: s.menu.global },
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

/** `limit`/`lang` followed by whitespace — or fully typed, no space: the value level. */
const VALUE_LEVEL = /^(?:limit|lang)(?:\s+|$)/i;

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

/** Match on the bare token: the `✓` marker must not affect filtering. */
function startsWith(label: string, prefix: string): boolean {
	return bare(label).startsWith(prefix);
}

/** Completion rows for everything after `/quick-win `. */
function completions(prefix: string, enabled: boolean, limit: number, lang: Locale): Row[] | null {
	const s = commandsFor(lang);
	const rows = catalogue(enabled, limit, lang, s);
	const trimmed = prefix.trimStart();
	const afterGlobal = trimmed.startsWith("--global") ? trimmed.slice(8).trimStart() : null;

	const clean = (text: string, global: boolean): Row[] | null => {
		const head = firstToken(text).toLowerCase();
		// `limit` / `lang` — with or without the trailing space — open the value level:
		// the leaves, narrowed by the rest, with the whole prefix re-applied to `value`.
		if (VALUE_LEVEL.test(text)) {
			const typed = text.replace(VALUE_LEVEL, "").trim().toLowerCase();
			const leaves = (head === "lang" ? langRows(lang, s) : limitRows(limit, s)).filter((row) =>
				startsWith(row.label, typed),
			);
			return leaves.length > 0
				? leaves.map((row) => ({
						...row,
						value: global ? `--global ${head} ${row.value}` : `${head} ${row.value}`,
					}))
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

	// `--global` was typed (even bare, no trailing space): offer the setting
	// leaves it can actually carry, each with the full prefix in `value`.
	const items = clean(afterGlobal, true).filter((row) => SETTING_SUBS.has(bare(row.label)));
	return items.length > 0 ? items : null;
}

function handleToggle(
	state: SelfQuickWinState,
	value: string,
	ctx: ExtensionCommandContext,
	isGlobal: boolean,
	s: CommandStrings,
): void {
	const enabled = value === "on";
	state.config.enabled = enabled;
	// Persist ONLY the changed key, so the nearer layer never freezes the rest.
	saveConfig({ enabled }, isGlobal, ctx.cwd, state.globalFile);

	if (!ctx.hasUI) return;
	ctx.ui.notify(enabled ? s.enabled(isGlobal ? "global" : "project") : s.muted(isGlobal ? "global" : "project"), "info");
	// Repaint immediately: the mute state is visible without asking for it.
	paintBadge(state, ctx);
}

function describeInfo(state: SelfQuickWinState, s: CommandStrings): string {
	const limit = state.config.cardLimit;
	return [
		s.info.state(state.config.enabled),
		s.info.echo(state.config.echo),
		s.info.limit(limit === 0 ? "unlimited" : String(limit)),
		s.info.lang(state.config.lang),
		s.info.deferred(state.later.length),
		s.info.cards(state.cardsShownThisTask),
		s.info.scopeHint,
	].join("\n");
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
	// The command description is static, so it uses the language the global
	// layer already persists; the live completions re-read the config per call.
	const boot = commandsFor(loadConfig(undefined, state.globalFile).lang);

	pi.registerCommand("quick-win", {
		description: boot.menu.commandDescription,
		// Live state at completion time, never a snapshot from registration.
		getArgumentCompletions: (prefix) =>
			completions(prefix, state.config.enabled, state.config.cardLimit, state.config.lang),

		handler: async (args, ctx) => {
			const s = commandsFor(state.config.lang);
			// `--global` targets ~/.pi/agent/, its absence targets <cwd>/.pi/.
			const rawTokens = args.trim().split(/\s+/).filter(Boolean);
			const isGlobal = rawTokens.some((token) => token.toLowerCase() === "--global");
			const tokens = rawTokens.filter((token) => token.toLowerCase() !== "--global");
			const sub = (tokens[0] ?? "info").toLowerCase();
			const scope: CommandScope = isGlobal ? "global" : "project";

			if (sub === "off" || sub === "on") {
				handleToggle(state, sub, ctx, isGlobal, s);
				return;
			}

			if (sub === "limit") {
				const limit = parseLimit(tokens[1]);
				if (limit === undefined) {
					if (ctx.hasUI) ctx.ui.notify(s.usageLimit, "warning");
					return;
				}
				// Persist ONLY the changed key, so the nearer layer never freezes the rest.
				saveConfig({ cardLimit: limit }, isGlobal, ctx.cwd, state.globalFile);
				state.config = { ...state.config, cardLimit: limit };
				if (ctx.hasUI) ctx.ui.notify(s.limitSet(limit === 0 ? "unlimited" : String(limit), scope), "info");
				return;
			}

			if (sub === "lang") {
				const locale = normalizeLocale(tokens[1]);
				// Only an explicit, recognised token may change it; a typo must not
				// silently reset the UI to English.
				if (tokens[1] === undefined || !isLocale(tokens[1])) {
					if (ctx.hasUI) ctx.ui.notify(s.usageLang, "warning");
					return;
				}
				saveConfig({ lang: locale }, isGlobal, ctx.cwd, state.globalFile);
				state.config = { ...state.config, lang: locale };
				if (ctx.hasUI) ctx.ui.notify(s.langSet(locale, scope), "info");
				return;
			}

			if (sub === "later") {
				if (ctx.hasUI) ctx.ui.notify(deps.describeLater(state.later, s), "info");
				return;
			}

			if (sub === "clear") {
				deps.clearLater(pi, state);
				paintBadge(state, ctx);
				if (ctx.hasUI) ctx.ui.notify(s.cleared, "info");
				return;
			}

			if (sub !== "info") {
				if (ctx.hasUI) ctx.ui.notify(s.unknown(sub), "warning");
				return;
			}

			if (ctx.hasUI) ctx.ui.notify(describeInfo(state, s), "info");
		},
	});
}
