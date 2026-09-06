/**
 * suffix-array-doubling.ts – Suffix Array (doubling algorithm)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The suffix array of a string lists all its suffixes in lexicographic order.
 * The doubling algorithm computes it in O(n log² n) by comparing suffixes
 * based on their first 2^k characters: in each round, every position gets a
 * pair of ranks (rank of its 2^(k-1) prefix, rank of the next 2^(k-1) prefix),
 * and sorting these pairs gives the order of 2^k-character prefixes. Doubling
 * the window size eventually sorts all suffixes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log² n) with a comparison sort (O(n log n) with radix sort)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The suffixes are laid out as rows of characters.
 *   - The window being compared in the current round is YELLOW (comparing).
 *   - The current order of suffixes is tracked as the rounds progress.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The doubling pattern is used again in LCP and many string problems.
 *   - Suffix arrays are the workhorse behind full-text indexing tools.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
import { makeCharacters } from "./string-util";

/**
 * Build a grid of suffix rows, each a row of character cells.
 *
 * @param text The string whose suffixes are displayed.
 * @param activeRow The row to highlight this frame.
 * @returns Cell entities with row/col metadata (grid layout).
 */
function makeSuffixGrid(text: string, activeRow = -1): VisualEntity[] {
    const cells: VisualEntity[] = [];
    const n = text.length;
    for (let row = 0; row < n; row += 1) {
        const suffix = text.slice(row);
        for (let col = 0; col < n; col += 1) {
            const char = suffix[col] ?? "";
            cells.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: char,
                value: char,
                state: (activeRow === row ? "comparing" : "unvisited") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return cells;
}

/**
 * The Suffix Array (doubling) generator.
 *
 * @param input `{ text }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "banana";

    const n = text.length;
    let step = 0;

    // Frame 0: the untouched suffix grid.
    yield {
        stepNumber: step,
        entities: makeSuffixGrid(text),
        edges: [],
        description: `Computing the suffix array of "${text}".`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n },
    };
    step += 1;

    // Initial ranks: by first character.
    let suffix = text.split("").map((_, i) => i);
    let rank = text.split("").map((c) => c.charCodeAt(0));

    // Sorting suffixes by their first 2^k characters each round.
    let k = 1;
    while (k < n) {
        // Key = (rank of first half, rank of second half).
        suffix.sort((a, b) => {
            const ra = rank[a] ?? 0;
            const rb = rank[b] ?? 0;
            if (ra !== rb) {
                return ra - rb;
            }
            const ra2 = a + k < n ? (rank[a + k] ?? 0) : -1;
            const rb2 = b + k < n ? (rank[b + k] ?? 0) : -1;
            return ra2 - rb2;
        });

        // Assign new ranks based on the sorted order.
        const newRank = new Array<number>(n).fill(0);
        for (let i = 1; i < n; i += 1) {
            const prev = suffix[i - 1] as number;
            const cur = suffix[i] as number;
            const prevRank = rank[prev] ?? 0;
            const curRank = rank[cur] ?? 0;
            const prevSecond = prev + k < n ? (rank[prev + k] ?? 0) : -1;
            const curSecond = cur + k < n ? (rank[cur + k] ?? 0) : -1;
            newRank[cur] =
                newRank[prev]! + (prevRank === curRank && prevSecond === curSecond ? 0 : 1);
        }
        rank = newRank;

        yield {
            stepNumber: step,
            entities: makeSuffixGrid(text),
            edges: [],
            description: `Round k=${k}: suffix order is [${suffix.join(", ")}].`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { rows: n, cols: n, k },
        };
        step += 1;

        // If all ranks are distinct, the order is final.
        if (Math.max(...rank) === n - 1) {
            break;
        }
        k *= 2;
    }

    // Show the final suffix array as the sorted order.
    yield {
        stepNumber: step,
        entities: makeSuffixGrid(text),
        edges: [],
        description: `Suffix array: [${suffix.join(", ")}] meaning suffixes ${suffix.map((i) => `"${text.slice(i)}"`).join(", ")}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { rows: n, cols: n, suffixArray: [...suffix] },
    };
}

/** The Suffix Array (Doubling) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "suffix-array-doubling",
    name: "Suffix Array (Doubling)",
    category: "string",
    complexity: { time: "O(n log² n)", space: "O(n)" },
    // "banana" is the classic suffix-array teaching example.
    defaultInput: { text: "banana" },
    visualType: "grid",
    run,
};

export default module;
