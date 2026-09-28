/**
 * `/quick-win` command — mute switch, the deferred list, and a status readout.
 *
 * Completions follow the Trailing Space Contract: `off`, `on`, `later`, `clear`
 * and `info` are terminal leaves (no trailing space), while nothing here takes a
 * second argument, so the only non-terminal token is the `--global` prefix that
 * every setting command must accept.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { saveConfig } from "../../shared/config.js";
import { paintBadge } from "../../shared/status.js";
import type { SelfQuickWinState } from "../../shared/state.js";

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

/**
 * Setting catalogue, read live so the menu never shows a stale snapshot.
 * `off`/`on` are settings; `info`/`later`/`clear` are actions and carry no state.
 */
function catalogue(enabled: boolean): readonly Row[] {
	return [
		{ label: "info", value: "info", description: "Show state and the deferred count" },
		{ label: "later", value: "later", description: "List deferred quick wins" },
		{ label: "clear", value: "clear", description: "Empty the deferred list" },
		...toggleRows(enabled),
		GLOBAL_ROW,
	];
}

const SETTING_SUBS = new Set(["off", "on"]);

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
function completions(prefix: string, enabled: boolean): Row[] | null {
	const rows = catalogue(enabled);
	const trimmed = prefix.trimStart();
	const afterGlobal = trimmed.startsWith("--global") ? trimmed.slice(8).trimStart() : null;

	const clean = (text: string, global: boolean): Row[] | null => {
		const head = firstToken(text).toLowerCase();
		const items = rows.filter((row) => row.label !== "--global" && startsWith(row.label, head));
		if (items.length === 0) return null;
		if (!global) return [...items];
		return items.map((row) =>
			// `value` replaces the whole argument string, so the prefix is re-applied.
			SETTING_SUBS.has(bare(row.label)) ? { ...row, value: `--global ${row.value}` } : row,
		);
	};

	if (afterGlobal === null) {
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
	return (
		`quick-win: ${state.config.enabled ? "enabled" : "muted"}\n` +
		`closing echo: ${state.config.echo ? "on" : "off"}\n` +
		`deferred: ${state.later.length}\n` +
		`card shown in this task: ${state.cardShownThisTask ? "yes" : "no"}\n` +
		"scope: `--global` writes ~/.pi/agent/, otherwise <cwd>/.pi/."
	);
}

export function registerQuickWinCommand(
	pi: ExtensionAPI,
	state: SelfQuickWinState,
	deps: CommandDeps,
): void {
	pi.registerCommand("quick-win", {
		description: "Quick-win controls (/quick-win [info|later|clear|on|off] [--global])",
		// Live state at completion time, never a snapshot from registration.
		getArgumentCompletions: (prefix) => completions(prefix, state.config.enabled),

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