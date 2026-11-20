/**
 * meta-binary-search.ts - Meta Binary Search (One-Sided Binary Search)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Meta binary search, also called one-sided binary search, does not keep a low
 * and high bound. Instead it grows a step size until it brackets the answer,
 * then halves that step each round. At every round it tentatively advances the
 * position by the current step and keeps the move only when the element still
 * does not exceed the target. After the step reaches zero, the position is the
 * number of elements at most the target, so one final check decides the match.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) - one probe per bit of the array length
 *   Space: O(n) for the emitted bar entities, O(1) working space
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The tentatively tested bar is YELLOW (comparing).
 *   - Accepted positions keep a RED (path) trail of the accepted prefix.
 *   - A matching final bar turns GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SearchTask {
    values?: number[];
    target?: number;
}

function readValues(input: unknown): number[] {
    if (Array.isArray(input)) {
        return input.filter((v): v is number => typeof v === "number").map((v) => v);
    }
    const task = input as SearchTask | null;
    if (task && Array.isArray(task.values)) {
        return task.values.filter((v): v is number => typeof v === "number").map((v) => v);
    }
    return [1, 3, 5, 7, 9, 11, 13, 15];
}

function makeBars(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
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
    const task = (input as SearchTask | null) ?? {};
    const values = readValues(input);
    const target = typeof task.target === "number" ? task.target : 9;
    let step = 0;
    let comparisons = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values),
        edges: [],
        description: `Meta binary search for ${target} in ${values.length} sorted value(s), using halving steps.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { comparisons, found: false, n: values.length, target },
    };
    step += 1;

    if (values.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars(values),
            edges: [],
            description: "Empty array: there is no element to search, so the target is absent.",
            codeLineNumber: 5,
            layout: "array",
            meta: { comparisons, found: false, n: 0, target },
        };
        return;
    }

    let bit = 1;
    while (bit * 2 <= values.length) {
        bit *= 2;
    }
    let position = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values),
        edges: [],
        description: `Largest power-of-two step is ${bit}; growing the accepted prefix from position 0.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { comparisons, found: false, bit, position },
    };
    step += 1;

    while (bit > 0) {
        const candidate = position + bit;
        const inside = candidate <= values.length;
        const candidateValue = inside ? (values[candidate - 1] as number) : Infinity;
        comparisons += 1;
        const accept = inside && candidateValue <= target;

        const states = new Map<number, EntityState>();
        for (let i = 0; i < position; i += 1) {
            states.set(i, "path");
        }
        if (inside) {
            states.set(candidate - 1, "comparing");
        }
        yield {
            stepNumber: step,
            entities: makeBars(values, states),
            edges: [],
            description: `Step ${bit}: testing index ${candidate - 1} with value ${inside ? candidateValue : "out of range"}; ${accept ? "accepted" : "rejected"}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { comparisons, found: false, bit, position, candidate, accepted: accept },
        };
        step += 1;

        if (accept) {
            position = candidate;
        }
        bit = Math.floor(bit / 2);
    }

    const index = position - 1;
    const found = index >= 0 && values[index] === target;
    const states = new Map<number, EntityState>();
    for (let i = 0; i < position; i += 1) {
        states.set(i, "path");
    }
    if (found) {
        states.set(index, "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeBars(values, states),
        edges: [],
        description:
            found
                ? `Found ${target} at index ${index} after ${comparisons} probe(s).`
                : `${target} is absent; ${comparisons} probe(s) placed it after index ${index}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { comparisons, found, index, target },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than maintaining both ends of a search interval, meta binary search grows a step until it passes the answer and then halves the step repeatedly. At each round it tentatively moves the current position forward by the step and keeps the move only if the value there is still no larger than the target. The remaining position counts how many elements are at most the target.",
        invariants: [
            "After every round, values[position-1] is at most the target when position is positive.",
            "Every element at an index strictly beyond position plus the current step is greater than the target.",
            "The step size halves each round and eventually reaches zero.",
        ],
        correctness:
            "When a tentative advance stays within the array and lands on a value at most the target, the target cannot be before that landing spot, so keeping the move is safe. When the advance is rejected, all positions up to the tentative one hold larger values, so the answer stays put. Once the step is zero no further advance is possible, leaving the largest index whose value is at most the target; comparing that value with the target settles membership.",
        complexityRationale:
            "The initial step is the largest power of two not exceeding n, and it is halved once per probe, so exactly floor(log2(n)) plus one comparisons are made. Only the position, step, and a few counters are needed, giving constant working space apart from the visualization entities.",
        uses: [
            "Searching in settings where only a one-sided test is cheap",
            "Finding an insertion point in a sorted array",
            "A compact alternative to classic binary search in competitive programming",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Vol. 3, Section 6.1 (searching)",
            "Wikipedia, Binary search algorithm (exponential and one-sided variants)",
        ],
        workedExample:
            "In [1,3,5,7,9,11,13,15] searching for 12, the first step is 8, rejected because 15 exceeds 12. Step 4 is kept at value 7, moving to position 4; step 2 is kept at value 11, moving to position 6; step 1 is rejected at value 13. The final position 6 leaves value 11 at index 5, so 12 is absent.",
    },
    id: "meta-binary-search",
    name: "Meta Binary Search",
    category: "searching",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { values: [1, 3, 5, 7, 9, 11, 13, 15], target: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "if the array is empty, report the target absent",
        "set step to the largest power of two not exceeding n",
        "tentatively advance position by step and test that index",
        "keep the advance only when its value is at most the target",
        "halve step and repeat until step is zero",
        "compare the final position's value with the target",
        "done: report the index or that the target is absent",
    ],
};

export default module;
