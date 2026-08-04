/**
 * rabin-karp-single.ts – Rabin-Karp (single rolling hash)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Rabin-Karp searches for a pattern by hashing: it computes the hash of the
 * pattern and the hash of every length-m window of the text, sliding the
 * window one character at a time. The rolling-hash trick recomputes the next
 * window's hash from the previous one in O(1) by removing the leading
 * character and appending the trailing one. Only when hashes collide is a
 * (cheap) direct comparison made.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + m) average; O(n·m) worst (hash collisions everywhere)
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current window of the text is PINK (highlight).
 *   - The window's leading character being dropped is YELLOW (comparing).
 *   - A hash match (verified) is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The rolling-hash idea extends to 2D (image) matching.
 *   - Hash collisions make the direct comparison step necessary.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

/** Prime base for the polynomial hash. */
const BASE = 31;
/** Large prime modulus to reduce collisions. */
const MOD = 1_000_000_007;

/**
 * Build a frame's character entities with per-character states.
 *
 * @param text The text string.
 * @param states Optional index → state overrides.
 * @returns Character entities for the text layout.
 */
function makeText(text: string, states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return makeCharacters(text).map((char) => {
        const index = Number(char.metadata["index"]);
        return { ...char, state: states.get(index) ?? "idle" };
    });
}

/**
 * The Rabin-Karp (single) generator.
 *
 * @param input `{ text, pattern }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; pattern?: string } | null) ?? {};
    const text = task.text ?? "ababcabababcab";
    const pattern = task.pattern ?? "ababcab";

    const n = text.length;
    const m = pattern.length;
    const matches: number[] = [];
    let step = 0;

    // Frame 0: the untouched text.
    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description: `Rabin-Karp: searching for "${pattern}" with a rolling hash.`,
        codeLineNumber: 0,
        layout: "text",
        meta: {},
    };
    step += 1;

    // Precompute BASE^(m-1) mod MOD for the rolling hash.
    let basePow = 1;
    for (let i = 0; i < m - 1; i += 1) {
        basePow = (basePow * BASE) % MOD;
    }

    // Hash function for a window: sum of char·BASE^k.
    const hash = (s: string): number => {
        let h = 0;
        for (const char of s) {
            h = (h * BASE + (char.charCodeAt(0) + 1)) % MOD;
        }
        return h;
    };

    // The pattern hash and the first window hash.
    const patternHash = hash(pattern);
    let windowHash = hash(text.slice(0, m));

    // Slide the window across the text.
    for (let i = 0; i + m <= n; i += 1) {
        // Highlight the current window.
        const states = new Map<number, EntityState>();
        for (let k = i; k < i + m; k += 1) {
            states.set(k, "highlight");
        }
        yield {
            stepNumber: step,
            entities: makeText(text, states),
            edges: [],
            description: `Window [${i}..${i + m - 1}] has hash ${windowHash}.`,
            codeLineNumber: 2,
            layout: "text",
            meta: { matches: matches.length },
        };
        step += 1;

        // Hash match → verify with a direct comparison.
        if (windowHash === patternHash) {
            const slice = text.slice(i, i + m);
            if (slice === pattern) {
                matches.push(i);
                const foundStates = new Map<number, EntityState>();
                for (let k = i; k < i + m; k += 1) {
                    foundStates.set(k, "sorted");
                }
                yield {
                    stepNumber: step,
                    entities: makeText(text, foundStates),
                    edges: [],
                    description: `Hash matched and verified – pattern at index ${i}!`,
                    codeLineNumber: 3,
                    layout: "text",
                    meta: { matches: matches.length },
                };
                step += 1;
            }
        }

        // Roll the window forward (unless it was the last one).
        if (i + m < n) {
            const first = text.charCodeAt(i) + 1;
            const next = text.charCodeAt(i + m) + 1;
            windowHash = ((windowHash - ((first * basePow) % MOD) + MOD) * BASE + next) % MOD;
        }
    }

    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description:
            matches.length === 0
                ? `"${pattern}" does not occur in the text.`
                : `"${pattern}" occurs at ${matches.join(", ")}.`,
        codeLineNumber: 4,
        layout: "text",
        meta: { matches: matches.length },
    };
}

/** The Rabin-Karp (Single) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "rabin-karp-single",
    name: "Rabin-Karp (Single)",
    category: "string",
    complexity: { time: "O(n + m)", space: "O(1)" },
    // Same input as KMP/Z for a direct comparison.
    defaultInput: { text: "ababcabababcab", pattern: "ababcab" },
    visualType: "text",
    run,
};

export default module;
