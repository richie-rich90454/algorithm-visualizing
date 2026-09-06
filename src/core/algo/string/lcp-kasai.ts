/**
 * lcp-kasai.ts – Longest Common Prefix array (Kasai's algorithm)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The LCP array stores, for each adjacent pair in the suffix array, the length
 * of the longest common prefix of those two suffixes. Kasai's algorithm
 * computes it in O(n) using a beautiful invariant: instead of recomputing LCPs
 * from scratch, it walks the suffixes in *text order* and observes that the
 * LCP of suffix i and its SA-neighbor is at least (LCP of suffix i+1 minus
 * one). This reuse makes the algorithm linear.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) – each position advances the shared prefix pointer O(n) total
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The suffix pair being compared is YELLOW (comparing).
 *   - The common prefix characters are PINK (highlight).
 *   - The resulting LCP value is shown.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - LCP array + suffix array power most string indexing tasks.
 *   - The "reuse from the previous suffix" step is the heart to teach.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

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
 * The LCP (Kasai) generator.
 *
 * @param input `{ text, suffixArray }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; suffixArray?: number[] } | null) ?? {};
    const text = task.text ?? "banana";
    const n = text.length;

    // A default suffix array for "banana": [5, 3, 1, 0, 4, 2].
    const suffixArray: number[] = task.suffixArray ?? [5, 3, 1, 0, 4, 2];

    let step = 0;
    const lcp = new Array<number>(Math.max(0, n - 1)).fill(0);

    // Frame 0: the untouched text.
    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description: `Computing the LCP array of the suffix array [${suffixArray.join(", ")}].`,
        codeLineNumber: 0,
        layout: "text",
        meta: {},
    };
    step += 1;

    // rank[i] = position of suffix i in the suffix array.
    const rank = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        rank[suffixArray[i] as number] = i;
    }

    let h = 0; // the current LCP length (reused across iterations).

    // Walk suffixes in text order (Kasai's trick).
    for (let i = 0; i < n; i += 1) {
        const pos = rank[i] ?? 0;
        if (pos > 0) {
            const prev = suffixArray[pos - 1] as number;
            // Extend the shared prefix as far as possible.
            while (i + h < n && prev + h < n && text[i + h] === text[prev + h]) {
                h += 1;
            }
            lcp[pos - 1] = h;

            // Show the compared suffix pair and their common prefix.
            const states = new Map<number, EntityState>();
            for (let k = 0; k < h; k += 1) {
                states.set(i + k, "highlight");
                states.set(prev + k, "highlight");
            }
            yield {
                stepNumber: step,
                entities: makeText(text, states),
                edges: [],
                description: `LCP of suffix ${i} ("${text.slice(i)}") and suffix ${prev} ("${text.slice(prev)}") is ${h}.`,
                codeLineNumber: 2,
                layout: "text",
                meta: { maxLcp: Math.max(0, ...lcp) },
            };
            step += 1;

            // Kasai's reuse: the next iteration starts h one smaller.
            if (h > 0) {
                h -= 1;
            }
        } else {
            h = 0;
        }
    }

    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description: `LCP array: [${lcp.join(", ")}].`,
        codeLineNumber: 4,
        layout: "text",
        meta: { maxLcp: Math.max(0, ...lcp), lcp: [...lcp] },
    };
}

/** The LCP (Kasai) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "lcp-kasai",
    name: "LCP Array (Kasai)",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    // The "banana" suffix array pairs with the LCP array.
    defaultInput: { text: "banana", suffixArray: [5, 3, 1, 0, 4, 2] },
    visualType: "text",
    run,
};

export default module;
