/**
 * binary-search-recursive.ts – Binary Search (Recursive)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The recursive twin of the iterative binary search. Instead of an explicit
 * while loop, the search function calls itself on the surviving half of the
 * array: compare the middle element to the target, then recurse into the left
 * or right sub-array. The base case is an empty interval, meaning the target
 * is absent. Recursion makes the divide-and-conquer structure visually obvious.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) worst/average, O(1) best
 *   Space: O(log n) stack depth – each recursive call holds a frame
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The middle element of the current call is YELLOW (comparing).
 *   - The surviving half (chosen for the next call) is PINK (highlight).
 *   - A hit turns GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Same asymptotic behaviour as the iterative version, at the cost of
 *     O(log n) call-stack space.
 *   - The recursion depth here is tiny (log n), so there is no stack-overflow
 *     worry for classroom-sized inputs.
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
 * The recursive Binary Search generator.
 *
 * @param input The search task: `{ array, target }` with a sorted array.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Normalize the input; fall back to a fixed example when malformed.
    const task = (input as { array?: number[]; target?: number } | null) ?? {};
    const arr = Array.isArray(task.array)
        ? [...(task.array as number[])]
        : [1, 3, 5, 7, 9, 11, 13, 15];
    const target = typeof task.target === "number" ? task.target : 11;

    let step = 0;
    let comparisons = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Searching for ${target} in a sorted array (recursively).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, target },
    };
    step += 1;

    /**
     * Recursive helper: search the sub-array [low, high].
     *
     * The generator pattern means each recursive descent yields its frames
     * into the same stream, so the animation shows the recursion's call chain.
     *
     * @returns true if the target was found (to stop the search early).
     */
    function* search(low: number, high: number): Generator<VisualFrame, boolean, unknown> {
        // Base case: an empty interval means the target is absent.
        if (low > high) {
            return false;
        }

        const mid = low + Math.floor((high - low) / 2);
        const midValue = arr[mid];
        if (midValue === undefined) {
            return false;
        }
        comparisons += 1;

        // Show the interval and the middle being examined.
        const states = new Map<number, EntityState>();
        for (let i = low; i <= high; i += 1) {
            states.set(i, "highlight");
        }
        states.set(mid, "comparing");

        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `Searching [${low}..${high}] – middle is ${midValue} at index ${mid}.`,
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
            return true;
        }

        // Recurse into the surviving half – the target decides which one.
        if (midValue < target) {
            return yield* search(mid + 1, high);
        }
        return yield* search(low, mid - 1);
    }

    const found = yield* search(0, arr.length - 1);

    // The recursion returned false without a match.
    if (!found) {
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
}

/** The Binary Search (Recursive) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "binary-search-recursive",
    name: "Binary Search (Recursive)",
    category: "searching",
    complexity: { time: "O(log n)", space: "O(log n)" },
    // A sorted array with the target (11) near the right so several calls run.
    defaultInput: { array: [1, 3, 5, 7, 9, 11, 13, 15], target: 11 },
    visualType: "array",
    run,
};

export default module;
