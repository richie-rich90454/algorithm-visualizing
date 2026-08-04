/**
 * ternary-search.ts – Ternary Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Ternary search finds the position of a value in a sorted array, or the
 * extremum of a unimodal function, by splitting the search space into *three*
 * parts instead of two. On each step it compares the target to two probes at
 * the 1/3 and 2/3 positions and discards the third of the interval that
 * cannot contain the target.
 *
 * While binary search needs ⌈log₂ n⌉ comparisons, ternary search needs
 * ⌈2·log₃ n⌉ probes (two per step), so it is *slower* for array search
 * despite dividing by three – a nice subtlety worth teaching. Its real home
 * is finding the peak of a unimodal (single-humped) function.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log₃ n) steps, but 2 comparisons per step ⇒ effectively O(2·log₃n)
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The two probes (m1, m2) are YELLOW (comparing).
 *   - The surviving third of the interval is PINK (highlight).
 *   - A hit turns GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires a sorted array for value search.
 *   - More naturally applied to continuous, unimodal functions.
 *   - Demonstrates that "more splits" does not automatically mean "faster".
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
 * The Ternary Search generator.
 *
 * @param input The search task: `{ array, target }` with a sorted array.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Normalize the input; fall back to a fixed example when malformed.
    const task = (input as { array?: number[]; target?: number } | null) ?? {};
    const arr = Array.isArray(task.array)
        ? [...(task.array as number[])]
        : [2, 5, 8, 11, 14, 17, 20, 23];
    const target = typeof task.target === "number" ? task.target : 17;

    let step = 0;
    let comparisons = 0;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Searching for ${target} using ternary search.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, target },
    };
    step += 1;

    let low = 0;
    let high = arr.length - 1;

    // Search while the interval holds at least three elements.
    while (low <= high) {
        // Split the interval into thirds at the 1/3 and 2/3 points.
        const m1 = low + Math.floor((high - low) / 3);
        const m2 = high - Math.floor((high - low) / 3);
        const v1 = arr[m1];
        const v2 = arr[m2];
        if (v1 === undefined || v2 === undefined) {
            break;
        }
        comparisons += 2;

        // Show the interval and the two probes.
        const states = new Map<number, EntityState>();
        for (let i = low; i <= high; i += 1) {
            states.set(i, "highlight");
        }
        states.set(m1, "comparing");
        states.set(m2, "comparing");

        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `Probing ${v1} at ${m1} and ${v2} at ${m2} – interval [${low}..${high}].`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, target, low, high, m1, m2 },
        };
        step += 1;

        if (target === v1) {
            const foundStates = new Map<number, EntityState>([[m1, "sorted"]]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, foundStates),
                edges: [],
                description: `Found ${target} at index ${m1}.`,
                codeLineNumber: 3,
                layout: "array",
                meta: { comparisons, target, foundIndex: m1 },
            };
            return;
        }
        if (target === v2) {
            const foundStates = new Map<number, EntityState>([[m2, "sorted"]]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, foundStates),
                edges: [],
                description: `Found ${target} at index ${m2}.`,
                codeLineNumber: 4,
                layout: "array",
                meta: { comparisons, target, foundIndex: m2 },
            };
            return;
        }

        // Discard the third that cannot hold the target.
        if (target < v1) {
            high = m1 - 1; // target lives in the left third
        } else if (target > v2) {
            low = m2 + 1; // target lives in the right third
        } else {
            low = m1 + 1; // target lives in the middle third
            high = m2 - 1;
        }
    }

    // The interval collapsed without a match.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `${target} is not in the array after ${comparisons} comparisons.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { comparisons, target },
    };
}

/** The Ternary Search module, registered with the engine. */
const module: AlgorithmModule = {
    id: "ternary-search",
    name: "Ternary Search",
    category: "searching",
    complexity: { time: "O(log₃ n)", space: "O(1)" },
    // Arithmetic progression with the target (17) in the right half.
    defaultInput: { array: [2, 5, 8, 11, 14, 17, 20, 23], target: 17 },
    visualType: "array",
    run,
};

export default module;
