/**
 * jump-search.ts – Jump Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Jump search walks a sorted array in fixed-size blocks instead of one element
 * at a time. It jumps forward by √n until it overshoots the target, then does
 * a linear scan within the final block. The block size √n balances the two
 * costs: there are at most n/√n = √n jumps and at most √n elements in the
 * final block, giving O(√n) total work.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(√n) worst/average
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current block's first element is YELLOW (comparing).
 *   - The block being linearly scanned is PINK (highlight).
 *   - A hit turns GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Requires a sorted array.
 *   - Middle ground between linear search (O(n)) and binary search (O(log n)).
 *   - The block size is always ⌊√n⌋, which is worth deriving in class.
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
 * The Jump Search generator.
 *
 * @param input The search task: `{ array, target }` with a sorted array.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Normalize the input; fall back to a fixed example when malformed.
    const task = (input as { array?: number[]; target?: number } | null) ?? {};
    const arr = Array.isArray(task.array)
        ? [...(task.array as number[])]
        : [2, 4, 6, 8, 10, 12, 14, 16, 18];
    const target = typeof task.target === "number" ? task.target : 14;

    let step = 0;
    let comparisons = 0;

    const n = arr.length;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Searching for ${target} – jump search uses blocks of √n.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, target },
    };
    step += 1;

    // The optimal block size is the square root of the array length.
    const blockSize = Math.floor(Math.sqrt(n));

    // ------------------------------------------------------------------
    // Phase 1: jump block by block until the target is within reach.
    // ------------------------------------------------------------------
    let prev = 0;
    let next = blockSize;

    // Keep jumping forward while the next block's first element is still
    // smaller than the target.
    while (next < n) {
        const value = arr[next];
        if (value === undefined) {
            break;
        }
        comparisons += 1;

        const jumpStates = new Map<number, EntityState>([[next, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, jumpStates),
            edges: [],
            description: `Jumping to block start at index ${next} – value is ${value}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, target, blockStart: next },
        };
        step += 1;

        // If this block's first element exceeds the target, the target (if
        // present) lies in the previous block.
        if (value >= target) {
            break;
        }

        prev = next;
        next += blockSize;
    }

    // If we jumped past the end, clamp `next` to the array bound.
    if (next >= n) {
        next = n;
    }

    // ------------------------------------------------------------------
    // Phase 2: linear scan inside the block [prev, next).
    // ------------------------------------------------------------------
    for (let i = prev; i < Math.min(next, n); i += 1) {
        const value = arr[i];
        if (value === undefined) {
            break;
        }
        comparisons += 1;

        const scanStates = new Map<number, EntityState>();
        for (let k = prev; k < Math.min(next, n); k += 1) {
            scanStates.set(k, "highlight");
        }
        scanStates.set(i, "comparing");

        yield {
            stepNumber: step,
            entities: makeBars(arr, scanStates),
            edges: [],
            description: `Scanning block [${prev}..${Math.min(next, n) - 1}] – checking ${value} at ${i}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: { comparisons, target, blockStart: prev },
        };
        step += 1;

        if (value === target) {
            const foundStates = new Map<number, EntityState>([[i, "sorted"]]);
            yield {
                stepNumber: step,
                entities: makeBars(arr, foundStates),
                edges: [],
                description: `Found ${target} at index ${i} after ${comparisons} comparisons.`,
                codeLineNumber: 5,
                layout: "array",
                meta: { comparisons, target, foundIndex: i },
            };
            return;
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

/** The Jump Search module, registered with the engine. */
const module: AlgorithmModule = {
    id: "jump-search",
    name: "Jump Search",
    category: "searching",
    complexity: { time: "O(√n)", space: "O(1)" },
    // 9 elements → √n = 3, making the block boundaries easy to see.
    defaultInput: { array: [2, 4, 6, 8, 10, 12, 14, 16, 18], target: 14 },
    visualType: "array",
    run,
};

export default module;
