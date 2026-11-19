/**
 * bozo-sort.ts - Bozo Sort (random pair swaps)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bozo sort repeatedly picks two positions at random. If the value on the left
 * is larger than the value on the right it swaps them; otherwise it leaves the
 * array alone. Once a full scan finds the array in nondecreasing order the
 * algorithm stops. Unlike bogo sort (monkey-sort in this catalog), which
 * reshuffles the whole array, bozo sort only ever swaps one pair at a time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2) expected pair draws until order is reached; unbounded worst
 *   Space: O(n) for the working copy
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The two drawn positions are YELLOW (comparing) or GREEN (swapped).
 *   - The final sorted array is GREEN.
 *   - A seeded pseudo-random generator makes the replay deterministic.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BozoInput {
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

function isSorted(arr: number[]): boolean {
    return arr.every((v, i) => i === 0 || (arr[i - 1] as number) <= v);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BozoInput | null) ?? {};
    const arr = Array.isArray(task.values) ? [...task.values] : [5, 1, 4, 2, 3];
    const seed = typeof task.seed === "number" ? task.seed >>> 0 : 777;
    const maxAttempts = typeof task.maxAttempts === "number" ? Math.max(0, task.maxAttempts) : 600;
    let state = seed || 1;
    const random = (): number => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };

    let step = 0;
    let attempts = 0;
    let swaps = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Bozo sort starts on ${arr.length} value(s); each step draws two positions and swaps only if they are out of order.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { attempts, swaps, sorted: isSorted(arr), seed },
    };
    step += 1;

    while (attempts < maxAttempts && !isSorted(arr)) {
        const i = Math.floor(random() * arr.length);
        const j = Math.floor(random() * arr.length);
        attempts += 1;
        if (i === j) {
            continue;
        }
        const left = arr[i] as number;
        const right = arr[j] as number;
        const inverted = left > right;
        if (inverted) {
            arr[i] = right;
            arr[j] = left;
            swaps += 1;
        }
        const states = new Map<number, EntityState>([
            [i, inverted ? "swapped" : "comparing"],
            [j, inverted ? "swapped" : "comparing"],
        ]);
        yield {
            stepNumber: step,
            entities: makeBars(arr, states),
            edges: [],
            description: `Attempt ${attempts}: positions ${i} and ${j} held ${left} and ${right} - ${inverted ? "swapped them" : "already in order"}.`,
            codeLineNumber: inverted ? 2 : 1,
            layout: "array",
            meta: { attempts, swaps, sorted: false, i, j },
        };
        step += 1;
    }

    const done = isSorted(arr);
    const finalStates = new Map<number, EntityState>(arr.map((_, i) => [i, done ? "sorted" : "idle"]));
    yield {
        stepNumber: step,
        entities: makeBars(arr, finalStates),
        edges: [],
        description: done
            ? `Sorted after ${attempts} random pair draw(s) and ${swaps} swap(s).`
            : `Stopped after ${maxAttempts} attempt(s) before reaching sorted order.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { attempts, swaps, sorted: done, maxAttempts },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Close your eyes, point at two entries, and put the smaller one on the left. Do it again and again. Every successful swap removes one inversion, so although the choices are random the array steadily improves until no pair is out of order.",
        invariants: [
            "The multiset of values never changes because the only write is a swap.",
            "A swap is performed only when the left value is strictly greater than the right value.",
            "The number of inversions strictly decreases on every accepted swap.",
        ],
        correctness:
            "Each swap of an inverted pair reduces the inversion count by at least one and never creates a new inversion elsewhere, so the count cannot increase. If the array is not sorted an inverted pair exists, and random sampling eventually draws such a pair with probability one; when the inversion count reaches zero the array is nondecreasing.",
        complexityRationale:
            "There are at most n(n-1)/2 inversions, and a random draw hits an inverted pair with probability bounded away from zero for small n, so the expected number of draws is quadratic in the number of inversions. Only the working array is stored, giving O(n) space.",
        uses: [
            "A classroom contrast with bogo sort that shows why local random progress can work",
            "A toy model for random-walk search over permutations",
            "Demonstrating Markov-chain convergence on a finite state space",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 5.2 (sorting folklore)",
            "Wikipedia, Bozo sort",
        ],
        workedExample:
            "Starting from 5, 1, 4, 2, 3 with seed 777, a draw might pick positions 0 and 1: 5 is greater than 1, so they swap to give 1, 5, 4, 2, 3. Repeated draws of inverted pairs reduce the disorder until the run ends in 1, 2, 3, 4, 5.",
    },
    id: "bozo-sort",
    name: "Bozo Sort",
    category: "sorting",
    complexity: { time: "O(n^2) expected", space: "O(n)" },
    defaultInput: { values: [5, 1, 4, 2, 3], seed: 777, maxAttempts: 600 },
    visualType: "array",
    run,
    pseudocode: [
        "copy the input and seed the random generator",
        "while the array is not sorted and attempts remain",
        "draw two distinct positions at random",
        "if the left value exceeds the right value, swap them",
        "record the attempt and repeat",
        "done: report the final order and the swap count",
    ],
};

export default module;
