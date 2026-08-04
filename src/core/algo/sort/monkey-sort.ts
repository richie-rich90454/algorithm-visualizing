/**
 * monkey-sort.ts – Monkey Sort (Bogo Sort / stupid sort)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Monkey sort is the (in)famous joke sorting algorithm. It checks whether the
 * array is sorted; if not, it shuffles the array completely at random and
 * checks again. Repeat until, by pure luck, the shuffle happens to produce a
 * sorted array.
 *
 * Its expected time complexity is O(n · n!) – the number of permutations to
 * guess – which makes it slower than any sane algorithm for n ≥ 5. It is
 * included here purely for education and entertainment: it is a vivid
 * illustration of *why* algorithms need structure, and the visualization of a
 * random shuffle after random shuffle is quite fun to watch.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n · n!) expected; unbounded in the worst case (a fair coin could
 *          keep landing the wrong way forever)
 *   Space: O(n) auxiliary (each shuffle builds a new permutation)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The is-sorted check sweeps the array with YELLOW (comparing).
 *   - A failed check triggers a full random shuffle (bars dance).
 *   - Success turns the whole array GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Not stable, not adaptive, not practical.
 *   - The name comes from the infinite-monkey theorem: a monkey hammering a
 *     keyboard will eventually type Shakespeare; a monkey shuffling cards will
 *     eventually sort them.
 *   - The shuffles are limited here so the animation stays classroom-friendly.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Maximum number of shuffles before giving up gracefully. */
const MAX_SHUFFLES = 400;

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
 * The Monkey Sort generator.
 *
 * @param input The array of numbers to sort.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    // Work on a copy – the generator must never mutate its caller's input.
    const arr = Array.isArray(input) ? [...(input as number[])] : [3, 1, 4, 2];

    let step = 0;
    let shuffles = 0;

    const n = arr.length;

    // Frame 0: the untouched initial state.
    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: "Initial array – monkey sort will shuffle until, by luck, it is sorted.",
        codeLineNumber: 0,
        layout: "array",
        meta: { shuffles },
    };
    step += 1;

    // A helper to check whether the array is already sorted.
    const isSorted = (): boolean => {
        for (let i = 0; i < n - 1; i += 1) {
            const a = arr[i];
            const b = arr[i + 1];
            if (a !== undefined && b !== undefined && a > b) {
                return false;
            }
        }
        return true;
    };

    // Keep shuffling until sorted (or until the safety limit is reached).
    while (!isSorted() && shuffles < MAX_SHUFFLES) {
        // Show the failed check (the first disorder found).
        const checkStates = new Map<number, EntityState>();
        for (let i = 0; i < n - 1; i += 1) {
            const a = arr[i];
            const b = arr[i + 1];
            if (a !== undefined && b !== undefined && a > b) {
                checkStates.set(i, "comparing");
                checkStates.set(i + 1, "comparing");
                break;
            }
        }
        yield {
            stepNumber: step,
            entities: makeBars(arr, checkStates),
            edges: [],
            description: "Not sorted yet – shuffling the whole deck at random.",
            codeLineNumber: 2,
            layout: "array",
            meta: { shuffles },
        };
        step += 1;

        // Fisher–Yates shuffle: a uniformly random permutation.
        for (let i = n - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            const atI = arr[i];
            const atJ = arr[j];
            if (atI !== undefined && atJ !== undefined) {
                arr[i] = atJ;
                arr[j] = atI;
            }
        }
        shuffles += 1;

        yield {
            stepNumber: step,
            entities: makeBars(arr),
            edges: [],
            description: `Shuffle #${shuffles} complete – checking for luck.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { shuffles },
        };
        step += 1;
    }

    // The array is (finally) sorted – or we hit the safety limit.
    const doneStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted"]));
    const sortedNow = isSorted();
    yield {
        stepNumber: step,
        entities: makeBars(arr, doneStates),
        edges: [],
        description: sortedNow
            ? `Sorted by pure luck after ${shuffles} shuffle(s)!`
            : `Gave up after ${shuffles} shuffles – the monkey needs a break.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { shuffles },
    };
}

/** The Monkey Sort module, registered with the engine. */
const module: AlgorithmModule = {
    id: "monkey-sort",
    name: "Monkey Sort",
    category: "sorting",
    complexity: { time: "O(n · n!)", space: "O(n)" },
    // Deliberately tiny (n = 4) so a sorted shuffle is actually plausible.
    defaultInput: [3, 1, 4, 2],
    visualType: "array",
    run,
};

export default module;
