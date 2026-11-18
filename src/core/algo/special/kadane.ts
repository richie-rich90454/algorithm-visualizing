/**
 * kadane.ts – Kadane's Algorithm (maximum subarray sum)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Kadane's algorithm finds the maximum sum of any contiguous subarray in O(n).
 * It walks the array once, maintaining `best` = the best subarray sum ending
 * at the current position. When adding the next element, it keeps either the
 * element alone (restarting the subarray) or extends the previous best.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n)
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current element is YELLOW (comparing).
 *   - The running best subarray is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The "restart or extend" decision is the entire idea.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of cells for the array.
 *
 * @param values The array values.
 * @param states Optional index → state overrides.
 * @returns Cell entities in a single row.
 */
function makeCells(values: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return values.map((value, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index },
    }));
}

/**
 * The Kadane generator.
 *
 * @param input `{ array }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[] } | null) ?? {};
    const array = task.array ?? [-2, 1, -3, 4, -1, 2, 1, -5, 4];

    let step = 0;

    // Edge case: empty array.
    if (array.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "Empty array – no subarray exists.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { bestOverall: -Infinity },
        };
        return;
    }

    let bestEndingHere = -Infinity;
    let bestOverall = -Infinity;
    let bestStart = 0;
    let bestEnd = 0;
    let currentStart = 0;

    // Frame 0: the array.
    yield {
        stepNumber: step,
        entities: makeCells(array),
        edges: [],
        description: `Kadane's algorithm – maximum subarray sum of [${array.join(", ")}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { bestOverall: -Infinity },
    };
    step += 1;

    for (let i = 0; i < array.length; i += 1) {
        const value = array[i] ?? 0;

        // Restart or extend?
        if (bestEndingHere + value > value) {
            bestEndingHere += value;
        } else {
            bestEndingHere = value;
            currentStart = i;
        }

        if (bestEndingHere > bestOverall) {
            bestOverall = bestEndingHere;
            bestStart = currentStart;
            bestEnd = i;
        }

        // Highlight the current element and the best subarray so far.
        const states = new Map<number, EntityState>([[i, "comparing"]]);
        for (let k = bestStart; k <= bestEnd; k += 1) {
            states.set(k, "sorted");
        }

        yield {
            stepNumber: step,
            entities: makeCells(array, states),
            edges: [],
            description: `At index ${i} (${value}): best ending here = ${bestEndingHere}, best overall = ${bestOverall}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { bestEndingHere, bestOverall },
        };
        step += 1;
    }

    const finalStates = new Map<number, EntityState>();
    for (let k = bestStart; k <= bestEnd; k += 1) {
        finalStates.set(k, "sorted");
    }

    yield {
        stepNumber: step,
        entities: makeCells(array, finalStates),
        edges: [],
        description: `Maximum subarray sum = ${bestOverall}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { bestOverall },
    };
}

/** The Kadane module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Kadane's algorithm finds the largest sum of any contiguous subarray in a single pass. At each position it decides whether to extend the best subarray ending at the previous index or to start fresh at the current element. A running maximum of these ending-here values gives the answer.",
        "invariants": [
            "bestEndingHere is the maximum sum of any subarray ending at the current index.",
            "bestOverall is the largest bestEndingHere seen so far.",
            "The recorded start and end bracket a subarray whose sum equals bestOverall."
        ],
        "correctness": "Any maximum subarray ending at i either extends the best one ending at i-1 by adding a[i], or consists of a[i] alone; taking the larger gives bestEndingHere, which is optimal by induction on i. Tracking the maximum over all indices then yields the global maximum subarray.",
        "complexityRationale": "The algorithm scans the array once, doing constant work per element, so O(n) time. It stores only a few scalar variables and indices, O(1) space.",
        "uses": [
            "Finding maximum profit from a single stock buy and sell",
            "Locating the brightest or highest-sum region in an image or signal",
            "Maximum-scoring segments in bioinformatics",
            "A building block for dynamic-programming solutions"
        ],
        "references": [
            "Bentley, Programming Pearls, Column 7",
            "Cormen et al., Introduction to Algorithms (CLRS), Chapter 4"
        ],
        "workedExample": "For [-2,1,-3,4,-1,2,1,-5,4], walking left to right gives a best ending here of 4 at the value 4, then 3 after -1, 5 after 2 and 6 after 1, which becomes the best overall. The maximum subarray is [4,-1,2,1] with sum 6."
    },
    id: "kadane",
    name: "Kadane's Algorithm",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { array: [-2, 1, -3, 4, -1, 2, 1, -5, 4] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize best ending here and best overall",
        "scan array values from left to right",
        "restart at current value or extend prior run",
        "update best overall when ending here exceeds it",
        "remember start and end of best subarray",
        "continue until every index is processed",
        "done: maximum subarray sum with bounds reported",
    ],
};

export default module;
