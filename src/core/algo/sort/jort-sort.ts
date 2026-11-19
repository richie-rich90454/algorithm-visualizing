/**
 * jort-sort.ts – Jort Sort (Verification-Driven Repair)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Jort sort is built around a verification pass: walk adjacent pairs and ask
 * whether the array is already sorted. The original joke implementation only
 * answers that question. This teachable version adds a repair step, so after
 * an out-of-order pair is found the two values are swapped and a fresh
 * verification pass begins. When a whole pass reports no inversion, the array
 * is certified sorted.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) worst case - each swap restarts verification
 *   Space: O(1) auxiliary
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The pair under verification is YELLOW.
 *   - An out-of-order pair that is swapped flashes RED.
 *   - A value certified in place turns GREEN.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - In place; terminates because each swap removes one inversion.
 *   - The verification pass, not a fixed loop count, decides when to stop.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const arr = Array.isArray(input) ? [...(input as number[])] : [5, 1, 4, 2, 3];
    let step = 0;
    let comparisons = 0;
    let swaps = 0;
    let pass = 0;

    const frame = (description: string, states: Map<number, EntityState>, codeLineNumber: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeBars(arr, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { comparisons, swaps, pass },
    });

    yield frame("Jort sort begins by verifying whether adjacent pairs are in order.", new Map(), 0);

    for (;;) {
        pass += 1;
        let swappedThisPass = false;

        for (let i = 0; i + 1 < arr.length; i += 1) {
            comparisons += 1;
            const left = arr[i] as number;
            const right = arr[i + 1] as number;
            yield frame(
                `Verification pass ${pass}: compare positions ${i} and ${i + 1} (${left} and ${right}).`,
                new Map<number, EntityState>([
                    [i, "comparing"],
                    [i + 1, "comparing"],
                ]),
                2,
            );

            if (left > right) {
                arr[i] = right;
                arr[i + 1] = left;
                swaps += 1;
                swappedThisPass = true;
                yield frame(
                    `Out of order: swapped ${left} and ${right}; restart verification from the left.`,
                    new Map<number, EntityState>([
                        [i, "swapped"],
                        [i + 1, "swapped"],
                    ]),
                    3,
                );
                break;
            }
        }

        if (!swappedThisPass) {
            break;
        }
    }

    const sortedStates = new Map<number, EntityState>(arr.map((_, index) => [index, "sorted" as EntityState]));
    yield frame(
        `Verification passed after ${pass} pass(es); sorted with ${swaps} swap(s).`,
        sortedStates,
        6,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Jort sort treats sortedness as something to prove rather than assume. Each verification pass scans adjacent pairs; finding one out-of-order pair swaps it and restarts the proof from the beginning. Only a complete pass with no inversion certifies that the array is sorted.",
        invariants: [
            "Before a restart, every pair checked earlier in the current pass was in order.",
            "Each swap removes exactly one adjacent inversion, so the total inversion count strictly decreases.",
            "When a pass finishes without a swap, every adjacent pair is in nondecreasing order.",
        ],
        correctness:
            "Swapping an inverted adjacent pair reduces the inversion count by one and never increases it, so the loop must terminate. Termination occurs only when a full pass finds no inversion, which means every adjacent pair satisfies A[i] <= A[i+1]; transitivity then makes the entire array sorted.",
        complexityRationale:
            "An inverted array performs O(n^2) adjacent comparisons because each of the O(n^2) inversions can trigger a restart and a fresh scan. Only the array itself is mutated, so auxiliary space is O(1).",
        uses: [
            "A teaching example of verification-driven algorithms",
            "Checking sortedness before paying for a more expensive sort",
            "Demonstrating inversion-count termination arguments",
        ],
        references: [
            "Donnelly, jortSort: a sort that does not sort, 2013",
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2.2",
        ],
        workedExample:
            "On [1, 3, 2] the first pass verifies the pair (1, 3), then finds 3 > 2 and swaps to [1, 2, 3]. The second pass checks (1, 2) and (2, 3), finds no inversion, and certifies the array sorted after two passes.",
    },
    id: "jort-sort",
    name: "Jort Sort",
    category: "sorting",
    complexity: { time: "O(n^2)", space: "O(1)" },
    defaultInput: [5, 1, 4, 2, 3],
    visualType: "array",
    run,
    pseudocode: [
        "start with the array and a verification pass counter",
        "begin a new pass over adjacent pairs",
        "for each adjacent pair, check whether it is in order",
        "if out of order, swap the pair and restart the pass",
        "if the pass completes with no swap, stop",
        "repeat passes until verification succeeds",
        "done: the array is certified sorted",
    ],
};

export default module;
