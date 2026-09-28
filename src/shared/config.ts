/**
 * Config — the mandatory cascade: defaults ← ~/.pi/agent/<plugin>.json ←
 * <cwd>/.pi/<plugin>.json (project wins).
 *
 * `saveConfig` takes a PARTIAL patch and merges it into the target layer only.
 * Writing a whole merged object here would freeze inherited values into the
 * nearer layer and silently shadow later edits to the outer one.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { normalizeLocale, type Locale } from "./i18n.js";

export interface QuickWinConfig {
	/** Master switch. Off means the tool answers, but the plugin shows nothing. */
	enabled: boolean;
	/** Close the loop with a short echo on real delivery. Never a score. */
	echo: boolean;
	/**
	 * How many cards one task may announce. 0 = unlimited: an all-day session
	 * keeps landing new increments, and nagging is prevented by the model's own
	 * judgement instead of a hard wall. A finite cap exists for the demo case,
	 * where one card per task is the whole point.
	 */
	cardLimit: number;
	/**
	 * Language of the card's own UI vocabulary (choices, field labels, footer).
	 * The card body stays model-authored English; the model-facing tool result is
	 * English in every locale.
	 */
	lang: Locale;
}

export const DEFAULT_CONFIG: QuickWinConfig = {
	enabled: true,
	echo: true,
	cardLimit: 0,
	lang: "en",
};

const CONFIG_DIR = join(homedir(), ".pi", "agent");
export const GLOBAL_CONFIG_FILE = join(CONFIG_DIR, "pi-quick-win.json");

/** Project override: <cwd>/.pi/pi-quick-win.json (wins over the global file). */
export function projectConfigPath(cwd: string): string {
	return join(cwd, ".pi", "pi-quick-win.json");
}

function readLayer(path: string): Partial<QuickWinConfig> {
	try {
		if (existsSync(path)) {
			return JSON.parse(readFileSync(path, "utf8")) as Partial<QuickWinConfig>;
		}
	} catch {
		// Corrupt layer — fall through to the next one.
	}
	return {};
}

export function loadConfig(cwd?: string, globalFile: string = GLOBAL_CONFIG_FILE): QuickWinConfig {
	const fromGlobal = normalizeConfig({ ...DEFAULT_CONFIG, ...readLayer(globalFile) });
	if (!cwd) return fromGlobal;
	return normalizeConfig({ ...fromGlobal, ...readLayer(projectConfigPath(cwd)) });
}

/** Coerce a persisted layer into a usable config; junk becomes the default. */
export function normalizeConfig(cfg: Partial<QuickWinConfig>): QuickWinConfig {
	const limit = Number(cfg.cardLimit);
	return {
		enabled: cfg.enabled !== false,
		echo: cfg.echo !== false,
		// Anything unparsable, negative or fractional means "no cap", never 1:
		// a broken config must not silence the plugin.
		cardLimit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0,
		// An unknown language is a typo, not a reason to fall back to silence: English.
		lang: normalizeLocale(cfg.lang),
	};
}

/**
 * Persist a patch: `--global` (isGlobal) writes ~/.pi/agent/, otherwise the
 * project file under <cwd>/.pi/. Without a cwd the global file is the target.
 */
export function saveConfig(
	patch: Partial<QuickWinConfig>,
	isGlobal = false,
	cwd?: string,
	globalFile: string = GLOBAL_CONFIG_FILE,
): void {
	const target = isGlobal || !cwd ? globalFile : projectConfigPath(cwd);
	try {
		mkdirSync(dirname(target), { recursive: true });
		const layer = readLayer(target);
		// Write-then-rename: a crash mid-write must not leave a truncated config
		// that the next session silently reads as corrupt.
		const tmp = `${target}.tmp`;
		writeFileSync(tmp, JSON.stringify({ ...layer, ...patch }, null, 2), "utf8");
		renameSync(tmp, target);
	} catch {
		// Silent fallback: an unwritable config must never break a session.
		try {
			rmSync(`${target}.tmp`, { force: true });
		} catch {
			// Nothing to clean up.
		}
	}
}