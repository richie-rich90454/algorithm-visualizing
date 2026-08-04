/**
 * comb-sort.ts – Comb Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Comb sort improves on bubble sort by comparing elements that are *far*
 * apart rather than only neighbors. It starts with a large gap (roughly the
 * array length divided by 1.3) and shrinks the gap by the same factor each
 * pass until it reaches 1, at which point a final bubble-sort pass finishes
 * the job. The large gaps let "turtles" (small elements that crawl toward the
 * front) travel quickly across the array, which is exactly the case where
 * bubble sort is slow.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n²) worst, but average behavior is around O(n²/2^p) and often
 *          approaches O(n log n) in practice
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current gap is announced each pass.
 *   - The pair being compared across the gap is YELLOW (comparing).
 *   - A swapped pair flashes RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Stable when the final gap-1 pass is a bubble sort.
 *   - In place.
 *   - The magic shrink factor 1.3 (empirically optimal) is fun to explore.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Empirically-optimal shrink factor for the gap sequence. */
const SHRINK_FACTOR = 1.3;

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
 * The Comb Sort generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [8, 4, 1, 7, 3, 9, 2, 6];

    let step = 0;
    let comparisons = 0;
    let swaps = 0;

    const n = arr.length;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – comb sort will sweep across shrinking gaps.",
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, swaps },
    };
    step += 1;

    // Start with the widest gap and shrink by the factor each round.
    let gap = Math.floor(n / SHRINK_FACTOR);
    let swappedAny = true;

    // Continue until the gap is 1 AND a full pass performed no swaps.
    while (gap > 1 || swappedAny) {
        if (gap > 1) {
            gap = Math.floor(gap / SHRINK_FACTOR);
        }
        swappedAny = false;

        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `Starting a pass with gap ${gap}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, swaps, gap },
        };
        step += 1;

        // Bubble-style sweep across elements separated by `gap`.
        for (let i = 0; i + gap < n; i += 1) {
            const a = arr[i];
            const b = arr[i + gap];
            if (a === undefined || b === undefined) {
                continue;
            }
            comparisons += 1;

            const cmpStates = new Map<number, EntityState>([
                [i, "comparing"],
                [i + gap, "comparing"],
            ]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, cmpStates),
                edges: [],
                description: `Gap ${gap}: comparing ${a} and ${b}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, swaps, gap },
            };
            step += 1;

            if (a > b) {
                arr[i] = b;
                arr[i + gap] = a;
                swaps += 1;
                swappedAny = true;

                const swapStates = new Map<number, EntityState>([
                    [i, "swapped"],
                    [i + gap, "swapped"],
                ]);
                yield {
                    stepNumber: step,
                    entities: makeBars(arr, swapStates),
                    edges: [],
                    description: `Gap ${gap}: swapped ${a} and ${b}.`,
                    codeLineNumber: 3,
                    layout: "array",
                    meta: { comparisons, swaps, gap },
                };
                step += 1;
            }
        }
    }

    // Final frame: the entire array is green and fully sorted.
    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, sortedStates),
        edges: [],
        description: `Array sorted in ${comparisons} comparisons and ${swaps} swaps.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { comparisons, swaps },
    };
}

/** The Comb Sort module, registered with the engine. */
const module: AlgorithmModule = {
    id: "comb-sort",
    name: "Comb Sort",
    category: "sorting",
    complexity: { time: "O(n²)", space: "O(1)" },
    // The small element 1 at index 2 is a classic "turtle" for bubble sort.
    defaultInput: [8, 4, 1, 7, 3, 9, 2, 6],
    visualType: "array",
    run,
};

export default module;
