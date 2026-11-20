/**
 * gorosort.ts - Goro Sort (random relocation with acceptance)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Goro sort picks a random entry, lifts it out, and drops it at another random
 * position. It keeps the move only when the number of inverted pairs goes down
 * and undoes the move otherwise. The acceptance test turns a blind shuffle into
 * a monotone random search that reliably finishes on small inputs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) per accepted trial in the naive inversion count; the number
 *          of trials is unbounded in theory but small in practice
 *   Space: O(n) for the working copy
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The lifted entry is PINK (highlight) and its new home is YELLOW.
 *   - Accepted moves turn GREEN (swapped); rejected moves return to idle.
 *   - The inversion count is shown in the statistics panel on every frame.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GoroInput {
    values?: number[];
    seed?: number;
    maxAttempts?: number;
}

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

function inversions(arr: number[]): number {
    let count = 0;
    for (let i = 0; i < arr.length; i += 1) {
        for (let j = i + 1; j < arr.length; j += 1) {
            if ((arr[i] as number) > (arr[j] as number)) {
                count += 1;
            }
        }
    }
    return count;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GoroInput | null) ?? {};
    const arr = Array.isArray(task.values) ? [...task.values] : [5, 1, 4, 2, 3];
    const seed = typeof task.seed === "number" ? task.seed >>> 0 : 777;
    const maxAttempts = typeof task.maxAttempts === "number" ? Math.max(0, task.maxAttempts) : 500;
    let state = seed || 1;
    const random = (): number => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };

    let step = 0;
    let attempts = 0;
    let accepted = 0;
    let disorder = inversions(arr);

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Goro sort starts with ${disorder} inverted pair(s); each trial relocates one value and keeps the move only if disorder falls.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { attempts, accepted, inversions: disorder, seed },
    };
    step += 1;

    while (attempts < maxAttempts && disorder > 0 && arr.length > 1) {
        const from = Math.floor(random() * arr.length);
        const to = Math.floor(random() * arr.length);
        attempts += 1;
        const value = arr[from] as number;
        const moved = [...arr];
        moved.splice(from, 1);
        moved.splice(to, 0, value);
        const candidate = inversions(moved);
        const keep = candidate < disorder;
        if (keep) {
            arr.splice(0, arr.length, ...moved);
            disorder = candidate;
            accepted += 1;
        }
        const states = new Map<number, EntityState>([
            [keep ? to : from, keep ? "swapped" : "highlight"],
        ]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `Trial ${attempts}: moved ${value} from position ${from} to ${to}; disorder ${disorder} -> ${candidate} - ${keep ? "kept" : "reverted"}.`,
            codeLineNumber: keep ? 3 : 4,
            layout: "array",
            meta: { attempts, accepted, inversions: disorder, movedValue: value, from, to, kept: keep },
        };
        step += 1;
    }

    const done = disorder === 0;
    const finalStates = new Map<number, EntityState>(arr.map((_, i) => [i, done ? "sorted" : "idle"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, finalStates),
        edges: [],
        description: done
            ? `Sorted after ${attempts} trial(s) with ${accepted} accepted relocation(s).`
            : `Stopped after ${maxAttempts} trial(s) with ${disorder} inverted pair(s) remaining.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { attempts, accepted, inversions: disorder, sorted: done },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Treat sorting as a hill climb. Lift a random value and try it somewhere else. If the new arrangement has fewer out-of-order pairs, keep it; if not, put the value back. Because the disorder score only ever falls, the search cannot wander away from a good arrangement.",
        invariants: [
            "The values are a permutation of the input after every trial.",
            "The inversion count strictly decreases on an accepted move and is unchanged on a rejected one.",
            "The array is sorted exactly when the inversion count is zero.",
        ],
        correctness:
            "A permutation with zero inversions is nondecreasing by definition. For any permutation with at least one inversion there exists a relocation that lowers the inversion count, so the seeded random search has a positive probability of taking it on each trial; infinitely many trials therefore reach zero inversions with probability one.",
        complexityRationale:
            "Each trial scans all pairs to compute inversions, costing O(n^2), and the number of trials is unbounded in theory but empirically small for short arrays. The working copy uses O(n) extra space.",
        uses: [
            "An intuitive introduction to stochastic local search and hill climbing",
            "A demonstration that an acceptance test can rescue a blind random operator",
            "A teaching example for monotone optimization over permutations",
        ],
        references: [
            "Wikipedia, Goro sort",
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, local search chapter",
        ],
        workedExample:
            "From 3, 1, 2 there are two inversions. Lifting 3 and inserting it at the end gives 1, 2, 3 with zero inversions, so the move is kept and the run stops after one accepted relocation.",
    },
    id: "gorosort",
    name: "Goro Sort",
    category: "sorting",
    complexity: { time: "O(n^2) per trial", space: "O(n)" },
    defaultInput: { values: [5, 1, 4, 2, 3], seed: 777, maxAttempts: 500 },
    visualType: "array",
    run,
    pseudocode: [
        "copy the input and count inverted pairs",
        "while inversions remain and trials remain",
        "lift a random value and insert it at a random position",
        "count inversions in the candidate arrangement",
        "if the count fell, keep the move, otherwise undo it",
        "record the trial and repeat",
        "done: report the sorted array and accepted move count",
    ],
};

export default module;
