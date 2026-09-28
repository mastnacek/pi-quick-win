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

export interface QuickWinConfig {
	/** Master switch. Off means the tool answers, but the plugin shows nothing. */
	enabled: boolean;
	/** Close the loop with a short echo on real delivery. Never a score. */
	echo: boolean;
}

export const DEFAULT_CONFIG: QuickWinConfig = {
	enabled: true,
	echo: true,
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
	const fromGlobal = { ...DEFAULT_CONFIG, ...readLayer(globalFile) };
	if (!cwd) return fromGlobal;
	return { ...fromGlobal, ...readLayer(projectConfigPath(cwd)) };
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