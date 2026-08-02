/**
 * interpolation-search.ts – Interpolation Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Interpolation search is binary search with a better guess. Where binary
 * search always probes the middle of the interval, interpolation search
 * estimates the probe position using a linear formula that assumes the values
 * are roughly uniformly distributed: the closer the target is to the low end,
 * the closer the probe lands to the low end.
 *
 *   probe = low + ⌊((target − arr[low]) × (high − low)) / (arr[high] − arr[low])⌋
 *
 * On uniformly distributed data this converges to O(log log n) comparisons –
 * extraordinarily fast. On adversarial distributions it degrades to O(n).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log log n) average, O(n) worst
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The interpolated probe position is YELLOW (comparing).
 *   - The surviving interval is PINK (highlight).
 *   - A hit turns GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires a sorted array *and* assumes roughly uniform values.
 *   - Perfect example of an algorithm whose constant factors matter and whose
 *     worst case hides a surprising cost.
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
 * The Interpolation Search generator.
 *
 * @param input The search task: `{ array, target }` with a sorted array.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Normalise the input; fall back to a fixed example when malformed.
    const task = (input as { array?: number[]; target?: number } | null) ?? {};
    const arr = Array.isArray(task.array)
        ? [...(task.array as number[])]
        : [10, 20, 30, 40, 50, 60, 70, 80];
    const target = typeof task.target === "number" ? task.target : 60;

    let step = 0;
    let comparisons = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Searching for ${target} – interpolation search guesses the probe position.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, target },
    };
    step += 1;

    let low = 0;
    let high = arr.length - 1;

    // Search while the interval is valid and the target is within its values.
    while (low <= high) {
        const lowVal = arr[low];
        const highVal = arr[high];
        if (lowVal === undefined || highVal === undefined) {
            break;
        }

        // Bail out when the interval is degenerate (division by zero).
        if (highVal === lowVal) {
            break;
        }

        // The heart of the algorithm: interpolate the probe position between
        // the two endpoints, scaled by how far the target sits between them.
        const pos = low + Math.floor(((target - lowVal) * (high - low)) / (highVal - lowVal));

        // Clamp the probe into the current interval.
        const mid = Math.min(Math.max(pos, low), high);
        const midValue = arr[mid];
        if (midValue === undefined) {
            break;
        }
        comparisons += 1;

        const states = new Map<number, EntityState>();
        for (let i = low; i <= high; i += 1) {
            states.set(i, "highlight");
        }
        states.set(mid, "comparing");

        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `Interpolated probe at index ${mid} – value is ${midValue}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, target, low, high, mid },
        };
        step += 1;

        if (midValue === target) {
            const foundStates = new Map<number, EntityState>([[mid, "sorted"]]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, foundStates),
                edges: [],
                description: `Found ${target} at index ${mid} after ${comparisons} comparisons.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { comparisons, target, foundIndex: mid },
            };
            return;
        }

        if (midValue < target) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `${target} is not in the array after ${comparisons} comparisons.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { comparisons, target },
    };
}

/** The Interpolation Search module, registered with the engine. */
const module: AlgorithmModule = {
    id: "interpolation-search",
    name: "Interpolation Search",
    category: "searching",
    complexity: { time: "O(log log n)", space: "O(1)" },
    // An arithmetic progression (uniform distribution) plays to its strengths.
    defaultInput: { array: [10, 20, 30, 40, 50, 60, 70, 80], target: 60 },
    visualType: "array",
    run,
};

export default module;
