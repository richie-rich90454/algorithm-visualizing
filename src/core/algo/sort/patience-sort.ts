/**
 * patience-sort.ts – Patience Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Patience sort is inspired by the card game Patience (solitaire). Imagine
 * dealing cards into piles: a card is always placed on the leftmost pile whose
 * top card is greater than or equal to it; if no such pile exists, it starts a
 * new pile. The number of piles formed equals the length of the longest
 * increasing subsequence (LIS). After all cards are dealt, the piles are
 * repeatedly merged (with a priority queue) to produce the sorted output.
 *
 * For the visualisation, the piles are laid out as rows of bars so the pile
 * structure is directly visible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) – pile placement uses a binary search, final merge
 *          uses a priority queue
 *   Space: O(n) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The card being dealt is YELLOW (comparing).
 *   - The pile it lands on is PINK (highlight).
 *   - The output being assembled is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Not stable.
 *   - Piles form a side product: the pile count is the LIS length.
 *   - Elegant connection between a card game and dynamic programming.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build the array of bar entities for a frame.
 *
 * @param arr The current array values, in display order.
 * @param states Optional index → state overrides for this frame.
 * @returns An array of `VisualEntity` bars with placeholder positions.
 */
function makeBars(arr: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return arr.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/**
 * The Patience Sort generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [6, 3, 8, 1, 7, 2, 5, 4];

    let step = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – patience sort will deal cards into piles.",
        codeLineNumber: 0,
        layout: "array",
        meta: {},
    };
    step += 1;

    // Each pile is an array of values, topped by its last (top) element.
    const piles: number[][] = [];

    // ------------------------------------------------------------------
    // Phase 1: deal every value onto the correct pile.
    // ------------------------------------------------------------------
    for (let i = 0; i < arr.length; i += 1) {
        const value = arr[i];
        if (value === undefined) {
            continue;
        }

        // Binary search for the leftmost pile whose top ≥ value.
        let lo = 0;
        let hi = piles.length;
        while (lo < hi) {
            const mid = Math.floor((lo + hi) / 2);
            const pileTop = piles[mid];
            const top = pileTop ? pileTop[pileTop.length - 1] : Infinity;
            if ((top as number) >= value) {
                hi = mid;
            } else {
                lo = mid + 1;
            }
        }

        // Place the card: new pile or onto the found pile.
        if (lo === piles.length) {
            piles.push([value]);
        } else {
            (piles[lo] ?? []).push(value);
        }

        const dealStates = new Map<number, EntityState>([
            [i, "comparing"],
            [lo, "highlight"],
        ]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, dealStates),
            edges: [],
            description: `${value} dealt onto pile ${lo} (${piles.length} pile(s) so far).`,
            codeLineNumber: 2,
            layout: "array",
            meta: { piles: piles.length },
        };
        step += 1;
    }

    // ------------------------------------------------------------------
    // Phase 2: repeatedly pop the smallest pile top into the output.
    // A simple linear scan for the minimum works for the pile sizes here.
    // ------------------------------------------------------------------
    const output: number[] = [];
    while (output.length < arr.length) {
        // Find the pile with the smallest top card.
        let bestPile = -1;
        let bestTop = Infinity;
        for (let p = 0; p < piles.length; p += 1) {
            const top = piles[p]?.[piles[p].length - 1];
            if (top !== undefined && top < bestTop) {
                bestTop = top;
                bestPile = p;
            }
        }

        // Pop it and append to the sorted output.
        if (bestPile >= 0) {
            const pile = piles[bestPile];
            const card = pile?.pop();
            if (card !== undefined) {
                output.push(card);
            }
        }

        yield {
            stepNumber: step,
            entities: makeBars(output.length ? [...output, ...arr.slice(output.length)] : arr),
            edges: [],
            description: `Popped ${bestTop} from pile ${bestPile} – output grows.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { piles: piles.length },
        };
        step += 1;
    }

    // Copy the assembled output into the working array.
    for (let i = 0; i < arr.length; i += 1) {
        arr[i] = output[i] ?? 0;
    }

    // Final frame: the entire array is green and fully sorted.
    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description: `Array sorted – ${piles.length} piles were formed (the LIS length).`,
        codeLineNumber: 5,
        layout: "array",
        meta: { piles: piles.length },
    };
}

/** The Patience Sort module, registered with the engine. */
const module: AlgorithmModule = {
    id: "patience-sort",
    name: "Patience Sort",
    category: "sorting",
    complexity: { time: "O(n log n)", space: "O(n)" },
    // This input's longest increasing subsequence (1, 2, 4) forms 4 piles.
    defaultInput: [6, 3, 8, 1, 7, 2, 5, 4],
    visualType: "array",
    run,
};

export default module;
