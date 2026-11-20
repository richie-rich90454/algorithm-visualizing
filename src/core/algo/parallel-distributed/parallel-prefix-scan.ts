/**
 * parallel-prefix-scan.ts - Hillis-Steele Parallel Prefix Scan
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A prefix scan turns a sequence into the sequence of running totals. The
 * Hillis-Steele version performs the work in logarithmic depth: on round k
 * every slot adds the value from k positions to its left, and all additions in
 * a round happen simultaneously. After log2(n) rounds each slot holds the
 * inclusive sum of the prefix ending there.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) work, O(log n) depth on n processors
 *   Space: O(n) for the double-buffered array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each slot is a bar showing its current value.
 *   - Slots updated in the current round are yellow.
 *   - The final prefix sums are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build the slot bars for the current round. */
function makeBars(
    values: number[],
    active: Set<number> = new Set(),
    state: EntityState = "idle",
): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: active.has(index) ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** The parallel prefix scan generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = Array.isArray(task.values) ? [...task.values] : [1, 2, 3, 4, 5, 6, 7, 8];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(values),
        edges: [],
        description: `Starting a parallel prefix scan over ${values.length} slots.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { offset: 0, updates: 0, result: [...values] },
    };
    step += 1;

    let current = [...values];
    let updates = 0;
    for (let offset = 1; offset < values.length; offset *= 2) {
        const next = [...current];
        const active = new Set<number>();
        for (let i = offset; i < values.length; i += 1) {
            next[i] = (current[i] ?? 0) + (current[i - offset] ?? 0);
            active.add(i);
            updates += 1;
        }
        current = next;
        yield {
            stepNumber: step,
            entities: makeBars(current, active),
            edges: [],
            description: `Round with offset ${offset}: slots ${offset} onward add the value ${offset} place(s) to their left.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { offset, updates, result: [...current] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(current, new Set(), "sorted"),
        edges: [],
        description: `Scan complete: ${current.join(", ")} in ${updates} parallel updates.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { offset: values.length, updates, result: [...current] },
    };
}

/** The parallel prefix scan module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of accumulating a running total one slot at a time, have every slot add a neighbor a fixed distance away, then double that distance each round. Because one round's additions only read the previous round's values, all of them can run at once.",
        invariants: [
            "At the start of a round with offset k, each slot holds the sum of up to k consecutive input values.",
            "All reads in a round come from the previous buffer, so updates never interfere.",
            "After log2(n) rounds each slot covers the whole prefix up to it.",
        ],
        correctness:
            "Induction on the offset: with offset 1 each slot holds the sum of itself and its left neighbor. If after offset k each slot holds the last k inputs, doubling the offset reads two adjacent k-blocks and produces the last 2k inputs. When the offset reaches n the block covers the entire prefix.",
        complexityRationale:
            "There are log2(n) rounds and at most n additions per round, so the work is O(n log n) with O(log n) depth on n processors. A second buffer of size n is needed because each round reads the previous values.",
        uses: [
            "Parallel implementation of cumulative sums",
            "Compaction and radix sort on GPUs",
            "Work-efficient parallel algorithms as a building block",
        ],
        references: [
            "Hillis and Steele, Data Parallel Algorithms, 1986",
            "Blelloch, Prefix Sums and Their Applications, 1990",
        ],
        workedExample:
            "Starting from [1, 2, 3, 4], offset 1 gives [1, 3, 5, 7] and offset 2 gives [1, 3, 6, 10]. Those are exactly the running sums of the original sequence.",
    },
    id: "parallel-prefix-scan",
    name: "Parallel Prefix Scan",
    category: "parallel-distributed",
    complexity: { time: "O(n log n) work, O(log n) depth", space: "O(n)" },
    defaultInput: { values: [1, 2, 3, 4, 5, 6, 7, 8] },
    visualType: "array",
    run,
    pseudocode: [
        "copy the input into the working array",
        "set the offset to one",
        "for every slot at or beyond the offset",
        "add the value offset places to the left into a new array",
        "swap the arrays and double the offset",
        "repeat until the offset reaches the array length",
        "done: each slot holds its inclusive prefix sum",
    ],
};

export default module;
