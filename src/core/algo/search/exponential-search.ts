/**
 * exponential-search.ts – Exponential Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Exponential search finds an element in a sorted, possibly *unbounded* array.
 * It first grows a search window by doubling an index (1, 2, 4, 8, …) until
 * it finds a position whose value exceeds the target. That position brackets
 * the target, and the final binary search over the window nails down the exact
 * index. The doubling phase is O(log i) where i is the target's index, so
 * targets near the front are found almost immediately.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log i) for the growing phase plus O(log i) binary search =
 *          O(log i), i being the found index; at worst O(log n)
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The doubling probe positions are YELLOW (comparing).
 *   - The bracketing window is PINK (highlight).
 *   - The final binary search probes within it; a hit turns GREEN.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires a sorted array.
 *   - Also called "galloping search"; it is how Tim Sort merges runs with
 *     wildly different lengths.
 *   - Great for "search in an unknown-length (but sorted) stream" problems.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build the array of bar entities for a frame.
 *
 * @param arr The array values, in display order.
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
 * The Exponential Search generator.
 *
 * @param input The search task: `{ array, target }` with a sorted array.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Normalize the input; fall back to a fixed example when malformed.
    const task = (input as { array?: number[]; target?: number } | null) ?? {};
    const arr = Array.isArray(task.array)
        ? [...(task.array as number[])]
        : [2, 4, 6, 8, 10, 12, 14, 16];
    const target = typeof task.target === "number" ? task.target : 12;

    let step = 0;
    let comparisons = 0;

    const n = arr.length;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Searching for ${target} – exponential search will double its probe index.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, target },
    };
    step += 1;

    // Corner case: the target might sit at index 0.
    if (arr[0] === target) {
        const foundStates = new Map<number, EntityState>([[0, "sorted"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, foundStates),
            edges: [],
            description: `Found ${target} at index 0 immediately.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons: 1, target, foundIndex: 0 },
        };
        return;
    }

    // ------------------------------------------------------------------
    // Phase 1: grow the probe index by doubling until we overshoot.
    // ------------------------------------------------------------------
    let bound = 1;
    while (bound < n) {
        const value = arr[bound];
        if (value === undefined) {
            break;
        }
        comparisons += 1;

        const probeStates = new Map<number, EntityState>([[bound, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, probeStates),
            edges: [],
            description: `Probing index ${bound} – value is ${value}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, target, bound },
        };
        step += 1;

        // Overshoot: the target must live before this index.
        if (value >= target) {
            break;
        }
        bound *= 2;
    }

    // Bracket the target: it lies in [bound/2, min(bound, n-1)].
    const low = Math.floor(bound / 2);
    const high = Math.min(bound, n - 1);

    // ------------------------------------------------------------------
    // Phase 2: classic binary search inside the bracketing window.
    // ------------------------------------------------------------------
    let lo = low;
    let hi = high;

    while (lo <= hi) {
        const mid = lo + Math.floor((hi - lo) / 2);
        const midValue = arr[mid];
        if (midValue === undefined) {
            break;
        }
        comparisons += 1;

        const states = new Map<number, EntityState>();
        for (let i = lo; i <= hi; i += 1) {
            states.set(i, "highlight");
        }
        states.set(mid, "comparing");

        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `Binary searching window [${lo}..${hi}] – probing ${midValue} at ${mid}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { comparisons, target, lo, hi, mid },
        };
        step += 1;

        if (midValue === target) {
            const foundStates = new Map<number, EntityState>([[mid, "sorted"]]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, foundStates),
                edges: [],
                description: `Found ${target} at index ${mid} after ${comparisons} comparisons.`,
                codeLineNumber: 5,
                layout: "array",
                meta: { comparisons, target, foundIndex: mid },
            };
            return;
        }
        if (midValue < target) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `${target} is not in the array after ${comparisons} comparisons.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { comparisons, target },
    };
}

/** The Exponential Search module, registered with the engine. */
const module: AlgorithmModule = {
    id: "exponential-search",
    name: "Exponential Search",
    category: "searching",
    complexity: { time: "O(log i)", space: "O(1)" },
    // Even numbers with the target (12) at index 5 – a few doublings needed.
    defaultInput: { array: [2, 4, 6, 8, 10, 12, 14, 16], target: 12 },
    visualType: "array",
    run,
};

export default module;
