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
            description: `Not sorted yet – shuffle #${shuffles + 1} coming up (pure luck).`,
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
    // Only claim green when the array truly is sorted; a gave-up run keeps
    // its bars unmarked so the final frame never lies.
    const sortedNow = isSorted();
    const doneStates = new Map<number, EntityState>(
        arr.map((_, index) => [
            index,
            sortedNow ? ("sorted" as EntityState) : ("idle" as EntityState),
        ]),
    );
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

    education: {
        "intuition": "Monkey sort, also called bogosort, checks whether the array is sorted and, if not, shuffles it randomly and checks again. It relies on luck rather than structure: eventually a random permutation happens to be sorted. It exists to show why algorithms need a plan.",
        "invariants": [
            "Each shuffle produces some permutation of the original multiset of values.",
            "The loop ends only when the current permutation is sorted."
        ],
        "correctness": "Every permutation has a nonzero chance of being produced, so with probability one a sorted permutation is eventually drawn and the check terminates. There is no deterministic progress guarantee, which is precisely the lesson.",
        "complexityRationale": "There are n! permutations and each is equally likely, so the expected number of shuffles is n!, each costing O(n), giving O(n * n!) expected time. Only the array and a shuffling buffer are stored, O(n) space.",
        "uses": [
            "Teaching why brute-force randomness is not an algorithm",
            "Entertainment and classroom demos",
            "A baseline that no practical method would ever choose"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2 (sorting folklore)",
            "Sedgewick and Wayne, Algorithms, Section 2.5 exercises"
        ],
        "workedExample": "For [3, 1, 4, 2], a shuffle might give [1, 3, 2, 4], still unsorted, then [2, 4, 1, 3], and eventually by chance [1, 2, 3, 4], which passes the sorted check."
    },
    id: "monkey-sort",
    name: "Monkey Sort",
    category: "sorting",
    complexity: { time: "O(n · n!)", space: "O(n)" },
    // Deliberately tiny (n = 4) so a sorted shuffle is actually plausible.
    defaultInput: [3, 1, 4, 2],
    visualType: "array",
    run,
    pseudocode: [
        "start with unsorted array and shuffle count ← 0",
        "scan for the first adjacent disorder",
        "if disordered: show the failing pair",
        "shuffle the whole array at random (Fisher-Yates)",
        "done: array is sorted by luck or limit reached",
    ],
};

export default module;
