/**
 * spaghetti-sort.ts - Spaghetti Sort
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Spaghetti sort is the classic linear-time physical sort. Each number is cut
 * as a strand of spaghetti whose length equals the value. All strands stand
 * upright in a bundle, a flat hand is lowered from above, and every strand the
 * hand touches is plucked out in top-to-bottom order. Repeating gives the
 * values from largest to smallest with one pass of the hand.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) plucks on a physical parallel hand; O(n^2) in this sequential
 *          replay, which lowers the hand once per remaining strand
 *   Space: O(n) for the standing strands and the output order
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each value is a bar whose height is its spaghetti length.
 *   - The current hand level is highlighted; plucked strands turn green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build one bar per strand, marking the ones already plucked. */
function makeBars(values: number[], plucked: Set<number>, hand: number): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (plucked.has(index)) state = "sorted";
        else if (Math.abs(value - hand) < 1e-12) state = "active";
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: String(value),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, length: value },
        };
    });
}

/** The spaghetti-sort generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = Array.isArray(task.values) && task.values.length > 0
        ? task.values.map(Number)
        : [3, 1, 4, 1, 5, 9, 2, 6];
    const plucked = new Set<number>();
    const order: number[] = [];

    yield {
        stepNumber: 0,
        entities: makeBars(values, plucked, -1),
        edges: [],
        description: `${values.length} spaghetti strands stand upright; lower the hand to pluck the longest first.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { count: values.length, hand: 0, order: [] },
    };
    let step = 1;

    while (plucked.size < values.length) {
        let bestIndex = -1;
        let bestValue = -Infinity;
        for (let i = 0; i < values.length; i += 1) {
            if (!plucked.has(i) && (values[i] ?? -Infinity) > bestValue) {
                bestValue = values[i] as number;
                bestIndex = i;
            }
        }
        if (bestIndex < 0) break;
        plucked.add(bestIndex);
        order.push(bestValue);
        yield {
            stepNumber: step,
            entities: makeBars(values, plucked, bestValue),
            edges: [],
            description: `Hand at length ${bestValue}: pluck strand ${bestIndex} (the tallest remaining); ${plucked.size} of ${values.length} removed.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { count: values.length, hand: bestValue, order: [...order] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(values, plucked, -1),
        edges: [],
        description: `All strands plucked: longest-to-shortest order [${order.join(", ")}].`,
        codeLineNumber: 3,
        layout: "array",
        meta: { count: values.length, hand: 0, order: [...order], sorted: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Cut one strand of spaghetti per number, with the strand length equal to the value. Stand them on a table and lower a flat hand from above. The strands the hand touches first are the longest, so plucking them off one level at a time reads the numbers from largest to smallest without ever comparing two strands directly.",
        invariants: [
            "A plucked strand is never touched again by the hand.",
            "The hand level is always the largest length among the remaining strands.",
            "The output is a permutation of the input values.",
        ],
        correctness:
            "At any hand level the strands touched are exactly those whose top equals the current maximum remaining length, because all taller strands have already been removed. Plucking them therefore emits values in nonincreasing order. Since every strand is eventually the maximum of what remains, each value is emitted exactly once and the final sequence is the input sorted descending.",
        complexityRationale:
            "With a physical hand all strands are tested in parallel, so n plucks take O(n) time. This sequential replay scans the remaining strands to find the maximum at each pluck, costing O(n^2) time and O(n) space for the output.",
        uses: [
            "A teaching demonstration of parallel comparison-free sorting",
            "Explaining linear-time sorting when a physical operation is O(1) across all items",
            "Priority selection where the largest remaining item is repeatedly removed",
        ],
        references: [
            "Aho, Hopcroft, and Ullman, The Design and Analysis of Computer Algorithms, spaghetti sort exercise",
            "Dewdney, The Turing Omnibus, spaghetti sorting",
        ],
        workedExample:
            "For strands of lengths 3, 1, 4, 1, 5, the hand first meets the length-5 strand and plucks it. It then meets 4, then 3, then the two length-1 strands together, producing 5, 4, 3, 1, 1.",
    },
    id: "spaghetti-sort",
    name: "Spaghetti Sort",
    category: "sorting",
    complexity: { time: "O(n^2) replay (O(n) physically)", space: "O(n)" },
    defaultInput: { values: [3, 1, 4, 1, 5, 9, 2, 6] },
    visualType: "array",
    run,
    pseudocode: [
        "stand one strand per value with length equal to the value",
        "while strands remain",
        "lower the hand to the tallest remaining strand",
        "pluck every strand touched at that level",
        "append the plucked values to the output",
        "done: report the values in longest-to-shortest order",
    ],
};

export default module;
