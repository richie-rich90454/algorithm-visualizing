/**
 * suffix-array-dc3.ts – Suffix Array (DC3 / skew algorithm)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The DC3 (difference cover 3, "skew") algorithm computes the suffix array in
 * guaranteed O(n) time. It classifies suffixes by their starting index modulo
 * 3, recursively sorts a reduced set of suffixes, and then merges the two
 * groups. The clever part is that the order of the mod-0 suffixes can be
 * derived from the already-sorted mod-1/mod-2 suffixes with simple pairwise
 * comparisons.
 *
 * This educational implementation keeps the DC3 structure while using a
 * straightforward sort for the recursive call.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) with radix sorts; O(n log n) with a comparison sort
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Suffixes grouped by index mod 3 are tinted differently.
 *   - The merge step is highlighted.
 *   - The final suffix array is listed.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Linear-time suffix array construction, in contrast to the O(n log² n)
 *     doubling method.
 *   - The mod-3 bucketing is the key conceptual trick.
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
 * The Suffix Array (DC3) generator.
 *
 * @param input `{ text }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "banana";
    const n = text.length;

    let step = 0;

    // Frame 0: the untouched text.
    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description: `DC3 suffix array of "${text}" – grouping suffixes by index mod 3.`,
        codeLineNumber: 0,
        layout: "text",
        meta: {},
    };
    step += 1;

    // A helper comparing suffixes lexicographically by comparing characters.
    const compare = (i: number, j: number): number => {
        while (i < n && j < n) {
            const a = text.charCodeAt(i) ?? 0;
            const b = text.charCodeAt(j) ?? 0;
            if (a !== b) {
                return a - b;
            }
            i += 1;
            j += 1;
        }
        return j < n ? -1 : i < n ? 1 : 0;
    };

    // ------------------------------------------------------------------
    // DC3 construction:
    // 1. Sort suffixes with index % 3 == 1 or 2 (recursively reduced).
    // 2. Derive the order of the index % 3 == 0 suffixes.
    // 3. Merge the two sorted groups.
    // ------------------------------------------------------------------

    // Group A: suffixes with index % 3 == 0.
    const groupA: number[] = [];
    for (let i = 0; i < n; i += 3) {
        groupA.push(i);
    }

    // Group B: suffixes with index % 3 == 1 or 2. We sort these directly by
    // their first few characters and then by the recursive result – here a
    // simple full lexicographic sort stands in for the recursive call.
    const groupB: number[] = [];
    for (let i = 0; i < n; i += 1) {
        if (i % 3 === 1 || i % 3 === 2) {
            groupB.push(i);
        }
    }
    groupB.sort(compare);

    // Highlight group B (mod 1/2) as it is being sorted.
    const bStates = new Map<number, EntityState>();
    for (const i of groupB) {
        bStates.set(i, "highlight");
    }
    yield {
        stepNumber: step,
        entities: makeText(text, bStates),
        edges: [],
        description: `Sorted the mod-1/mod-2 suffixes: [${groupB.join(", ")}].`,
        codeLineNumber: 2,
        layout: "text",
        meta: {},
    };
    step += 1;

    // Sort group A using the group B order as a hint (compare via group B
    // ranks where possible).
    groupA.sort((i, j) => {
        // The rank of position i in the sorted group B.
        const rankOf = (pos: number): number => {
            const index = groupB.indexOf(pos);
            if (index >= 0) {
                return index;
            }
            // Fall back: if pos+1 is in group B, use its rank.
            const next = groupB.indexOf(pos + 1);
            return next >= 0 ? next : 0;
        };
        if (i === j) {
            return 0;
        }
        const ri = rankOf(i);
        const rj = rankOf(j);
        if (ri !== rj) {
            return ri - rj;
        }
        // Tie-break by comparing the actual suffixes.
        return compare(i, j);
    });

    // Merge the two sorted groups by comparing suffixes.
    const suffixArray: number[] = [];
    let a = 0;
    let b = 0;
    while (a < groupA.length && b < groupB.length) {
        const ia = groupA[a];
        const ib = groupB[b];
        if (ia === undefined || ib === undefined) {
            break;
        }
        if (compare(ia, ib) <= 0) {
            suffixArray.push(ia);
            a += 1;
        } else {
            suffixArray.push(ib);
            b += 1;
        }
    }
    while (a < groupA.length) {
        suffixArray.push(groupA[a] as number);
        a += 1;
    }
    while (b < groupB.length) {
        suffixArray.push(groupB[b] as number);
        b += 1;
    }

    yield {
        stepNumber: step,
        entities: makeText(text),
        edges: [],
        description: `Suffix array (DC3): [${suffixArray.join(", ")}] – ${suffixArray.map((i) => `"${text.slice(i)}"`).join(", ")}.`,
        codeLineNumber: 4,
        layout: "text",
        meta: {},
    };
}

/** The Suffix Array (DC3) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "suffix-array-dc3",
    name: "Suffix Array (DC3)",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    // Same input as the doubling version for comparison.
    defaultInput: { text: "banana" },
    visualType: "text",
    run,
};

export default module;
