/**
 * QuickWinState — session-scoped kernel shared by the composition root and
 * every slice. One instance per session; nothing module-global, so concurrent
 * or mocked registrations stay isolated (and tests need no reset hook).
 *
 * Two pieces of state carry real rules:
 * - `cardsShownThisTask` counts the cards announced since the last user prompt,
 *   compared against `config.cardLimit` (0 = unlimited). An all-day session must
 *   be able to keep landing new increments, so the default is no cap at all.
 * - `pendingEcho` is the increment the user approved and that is still
 *   unverified. It exists so the closing echo can be *true*: no approval or no
 *   evidence, no echo (§3.3, §9.5).
 */

import { DEFAULT_CONFIG, GLOBAL_CONFIG_FILE, loadConfig, type QuickWinConfig } from "./config.js";
import type { QuickWinCard } from "./card.js";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** A deferred card, restored from the session so it survives /reload. */
export interface LaterItem {
	title: string;
	proof: string;
	recordedAt: number;
}

export interface SelfQuickWinState {
	// --- lifecycle plumbing ---
	unsubscribers: Array<() => void>;
	/** Retain a `pi.on()` return value; older engine typings declare it void. */
	track(result: unknown): void;

	// --- config ---
	config: QuickWinConfig;
	/** Overridable so tests never write the developer's real ~/.pi/agent file. */
	globalFile: string;

	// --- live session state ---
	/** Cards announced since the last user prompt; compared with config.cardLimit. */
	cardsShownThisTask: number;
	/** Approved increment awaiting verified delivery. */
	pendingEcho: QuickWinCard | undefined;
	/** Echo currently painted in the statusline; cleared on the next turn. */
	echoVisible: boolean;
	/** `later` cards restored from the session branch. */
	later: LaterItem[];

	// --- helpers ---
	ifLive(cb: () => void): void;
	/** True when this task has already spent its whole card budget. */
	cardLimitReached(): boolean;
}

export function createQuickWinState(_pi: ExtensionAPI): SelfQuickWinState {
	const unsubscribers: Array<() => void> = [];
	const track = (result: unknown): void => {
		if (typeof result === "function") unsubscribers.push(result as () => void);
	};
	const ifLive = (cb: () => void): void => {
		try {
			cb();
		} catch {
			// Session closed or UI unavailable.
		}
	};
	const state: SelfQuickWinState = {
		unsubscribers,
		track,
		config: { ...DEFAULT_CONFIG },
		globalFile: GLOBAL_CONFIG_FILE,
		cardsShownThisTask: 0,
		pendingEcho: undefined,
		echoVisible: false,
		later: [],
		ifLive,
		cardLimitReached() {
			// 0 is unlimited: a long session keeps announcing new increments, and
			// the model — not a wall — decides what counts as a new one.
			return state.config.cardLimit > 0 && state.cardsShownThisTask >= state.config.cardLimit;
		},
	};
	return state;
}

/** Reload the cascading config for a session rooted at `cwd`. */
export function reloadConfig(state: SelfQuickWinState, cwd?: string): void {
	state.config = loadConfig(cwd, state.globalFile);
}