/**
 * rabin-karp-double.ts – Rabin-Karp (double rolling hash)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The single-hash Rabin-Karp is vulnerable to hash collisions (two different
 * windows can share a hash). The double-hash variant computes *two*
 * independent rolling hashes with different bases/moduli and only considers a
 * window a candidate when both hashes agree. This makes collisions
 * astronomically unlikely and is the standard practical fix.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + m) average; O(n·m) worst
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current window is PINK (highlight).
 *   - Both hash values are shown in the description.
 *   - A double-hash verified match is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Two hashes are better than one" – collision resistance via redundancy.
 *   - The two-modulus pattern is common in competitive programming.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

/** Two independent bases and moduli. */
const BASE1 = 31;
const BASE2 = 37;
const MOD1 = 1_000_000_007;
const MOD2 = 998_244_353;

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
 * The Rabin-Karp (double) generator.
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
        description: `Rabin-Karp (double hash): searching for "${pattern}".`,
        codeLineNumber: 0,
        layout: "text",
        meta: {},
    };
    step += 1;

    // Precompute BASE^(m-1) under both moduli.
    let pow1 = 1;
    let pow2 = 1;
    for (let i = 0; i < m - 1; i += 1) {
        pow1 = (pow1 * BASE1) % MOD1;
        pow2 = (pow2 * BASE2) % MOD2;
    }

    // Hash under one base/modulus pair.
    const hashUnder = (s: string, base: number, mod: number): number => {
        let h = 0;
        for (const char of s) {
            h = (h * base + (char.charCodeAt(0) + 1)) % mod;
        }
        return h;
    };

    const pat1 = hashUnder(pattern, BASE1, MOD1);
    const pat2 = hashUnder(pattern, BASE2, MOD2);
    let win1 = hashUnder(text.slice(0, m), BASE1, MOD1);
    let win2 = hashUnder(text.slice(0, m), BASE2, MOD2);

    // Slide the window.
    for (let i = 0; i + m <= n; i += 1) {
        const states = new Map<number, EntityState>();
        for (let k = i; k < i + m; k += 1) {
            states.set(k, "highlight");
        }
        yield {
            stepNumber: step,
            entities: makeText(text, states),
            edges: [],
            description: `Window [${i}..${i + m - 1}] – hashes (${win1}, ${win2}).`,
            codeLineNumber: 2,
            layout: "text",
            meta: { matches: matches.length },
        };
        step += 1;

        // Both hashes must match before verifying directly.
        if (win1 === pat1 && win2 === pat2 && text.slice(i, i + m) === pattern) {
            matches.push(i);
            const foundStates = new Map<number, EntityState>();
            for (let k = i; k < i + m; k += 1) {
                foundStates.set(k, "sorted");
            }
            yield {
                stepNumber: step,
                entities: makeText(text, foundStates),
                edges: [],
                description: `Double hash matched – pattern at index ${i}!`,
                codeLineNumber: 3,
                layout: "text",
                meta: { matches: matches.length },
            };
            step += 1;
        }

        // Roll both hashes forward.
        if (i + m < n) {
            const first1 = (text.charCodeAt(i) + 1) * pow1;
            const first2 = (text.charCodeAt(i) + 1) * pow2;
            const next1 = text.charCodeAt(i + m) + 1;
            const next2 = text.charCodeAt(i + m) + 1;
            win1 = ((win1 - (first1 % MOD1) + MOD1) * BASE1 + next1) % MOD1;
            win2 = ((win2 - (first2 % MOD2) + MOD2) * BASE2 + next2) % MOD2;
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

/** The Rabin-Karp (Double) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "rabin-karp-double",
    name: "Rabin-Karp (Double)",
    category: "string",
    complexity: { time: "O(n + m)", space: "O(1)" },
    // Same input as the single-hash version for comparison.
    defaultInput: { text: "ababcabababcab", pattern: "ababcab" },
    visualType: "text",
    run,
};

export default module;
