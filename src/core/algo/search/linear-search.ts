/**
 * linear-search.ts – Linear Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Linear search scans the array from left to right, comparing each element to
 * the target until either a match is found or the end of the array is
 * reached. It is the simplest search algorithm and the only one that works on
 * unsorted data. The visualisation walks a highlight across the array, so the
 * worst-case cost is plainly visible: every element gets examined when the
 * target is absent.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) worst/average – every element may need checking
 *          O(1) best – target is the first element
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The element currently being checked is YELLOW (comparing).
 *   - A match flashes GREEN (sorted) and the search stops.
 *   - If the search fails, the final frame is all IDLE with an error message.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Works on any array, sorted or not.
 *   - Also great for tiny arrays where the constant factors of binary search
 *     outweigh the asymptotics.
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
 * The Linear Search generator.
 *
 * The input is an object `{ array: number[], target: number }` so the search
 * target travels with the data.
 *
 * @param input The search task: an array plus the value to find.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Normalise the input; fall back to a fixed example when malformed.
    const task = (input as { array?: number[]; target?: number } | null) ?? {};
    const arr = Array.isArray(task.array)
        ? [...(task.array as number[])]
        : [5, 3, 8, 1, 9, 2, 7, 4];
    const target = typeof task.target === "number" ? task.target : 7;

    let step = 0;
    let comparisons = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Searching for ${target} in the array.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, target },
    };
    step += 1;

    // Scan every position in order.
    for (let i = 0; i < arr.length; i += 1) {
        const value = arr[i];
        if (value === undefined) {
            continue;
        }
        comparisons += 1;

        // Mark the current element as being examined.
        const cmpStates = new Map<number, EntityState>([[i, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, cmpStates),
            edges: [],
            description: `Checking index ${i}: is ${value} the target ${target}?`,
            codeLineNumber: 1,
            layout: "array",
            meta: { comparisons, target },
        };
        step += 1;

        // Found it – celebrate and stop early.
        if (value === target) {
            const foundStates = new Map<number, EntityState>([[i, "sorted"]]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, foundStates),
                edges: [],
                description: `Found ${target} at index ${i} after ${comparisons} comparisons.`,
                codeLineNumber: 2,
                layout: "array",
                meta: { comparisons, target, foundIndex: i },
            };
            return;
        }
    }

    // Exhausted the array without a match.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `${target} is not in the array – checked all ${comparisons} elements.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { comparisons, target },
    };
}

/** The Linear Search module, registered with the engine. */
const module: AlgorithmModule = {
    id: "linear-search",
    name: "Linear Search",
    category: "searching",
    complexity: { time: "O(n)", space: "O(1)" },
    // Target 7 sits near the right so several elements get checked first.
    defaultInput: { array: [5, 3, 8, 1, 9, 2, 7, 4], target: 7 },
    visualType: "array",
    run,
};

export default module;
