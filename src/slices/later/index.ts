/**
 * `later` queue — cards the user deferred.
 *
 * Stored with `pi.appendEntry()` so it survives `/reload` and compaction while
 * costing **zero model tokens**: appended entries never enter the LLM context
 * (skill: state-persistence.md §2). Restoring reads session entries on
 * `session_start`; the statusline shows the count so a deferred win is not
 * silently forgotten.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { QuickWinCard } from "../../shared/card.js";
import type { CommandStrings } from "../../shared/i18n.js";
import type { LaterItem, SelfQuickWinState } from "../../shared/state.js";

export const LATER_ENTRY = "quick-win-later";

/** Marker title for the entry that empties the queue. */
const CLEAR_MARKER = "__clear__";

interface LaterEntryData {
	title?: unknown;
	proof?: unknown;
	recordedAt?: unknown;
}

function isLaterData(data: unknown): data is LaterEntryData {
	return typeof data === "object" && data !== null;
}

/** Read the deferred queue out of the session's entries, oldest first. */
export function restoreLater(ctx: ExtensionContext): LaterItem[] {
	const items: LaterItem[] = [];
	try {
		for (const entry of ctx.sessionManager.getEntries()) {
			if (entry.type !== "custom" || entry.customType !== LATER_ENTRY) continue;
			const data = (entry as { data?: unknown }).data;
			if (!isLaterData(data)) continue;
			if (data.title === CLEAR_MARKER) {
				items.length = 0;
				continue;
			}
			if (typeof data.title === "string" && data.title.length > 0) {
				items.push({
					title: data.title,
					proof: typeof data.proof === "string" ? data.proof : "",
					recordedAt: typeof data.recordedAt === "number" ? data.recordedAt : 0,
				});
			}
		}
	} catch {
		// Unreadable session history must not break the session.
	}
	return items;
}

/** Append a deferred card and return the new queue length. */
export function recordLater(pi: ExtensionAPI, state: SelfQuickWinState, card: QuickWinCard): number {
	const item: LaterItem = { title: card.title, proof: card.proof, recordedAt: Date.now() };
	state.later.push(item);
	try {
		pi.appendEntry(LATER_ENTRY, { ...item });
	} catch {
		// Session already closed; the in-memory queue still holds it.
	}
	return state.later.length;
}

export function clearLater(pi: ExtensionAPI, state: SelfQuickWinState): void {
	state.later = [];
	try {
		pi.appendEntry(LATER_ENTRY, { title: CLEAR_MARKER, recordedAt: Date.now() });
	} catch {
		// See recordLater.
	}
}

/** Compact list for `/quick-win later`; the wording comes from the locale table. */
export function describeLater(items: LaterItem[], strings: CommandStrings): string {
	if (items.length === 0) return strings.laterEmpty;
	return items.map((item, i) => strings.laterItem(i + 1, item.title)).join("\n");
}