/**
 * max-product-subarray.ts - Maximum Product Subarray
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Finds the contiguous subarray with the largest product. Because a negative
 * value can flip a small product into a large one, the scan keeps both the
 * largest and the smallest product ending at the current position. When the
 * next value is negative the two swap roles before being multiplied.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) - one constant-time update per element
 *   Space: O(1) - a handful of running values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the input; the current index flashes YELLOW (comparing).
 *   - The best subarray found so far is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - currMax and currMin are the best products of any subarray ending here.
 *   - Swapping on a negative value is what restores the correct extremes.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(
    values: number[],
    current: number,
    bestStart: number,
    bestEnd: number,
): VisualEntity[] {
    return values.map((value, index) => {
        let state: EntityState = "idle";
        if (index >= bestStart && index <= bestEnd) state = "sorted";
        else if (index === current) state = "comparing";
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
            metadata: { index },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values: number[] = Array.isArray(task.values)
        ? task.values.map((v) => Number(v))
        : [2, 3, -2, 4, -1, 5, -3, 2];
    const n = values.length;
    let step = 0;

    if (n === 0) {
        yield {
            stepNumber: step,
            entities: makeBars([0], -1, 0, -1),
            edges: [],
            description: "Empty array - no contiguous subarray exists.",
            codeLineNumber: 0,
            layout: "array",
            meta: { best: 0, bestStart: 0, bestEnd: -1, currMin: 0, currMax: 0 },
        };
        return;
    }

    let maxVal = values[0] as number;
    let minVal = maxVal;
    let maxStart = 0;
    let minStart = 0;
    let best = maxVal;
    let bestStart = 0;
    let bestEnd = 0;

    yield {
        stepNumber: step,
        entities: makeBars(values, -1, 0, 0),
        edges: [],
        description: `Scanning ${n} values for the contiguous subarray with the largest product.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { best, bestStart, bestEnd, currMin: minVal, currMax: maxVal },
    };
    step += 1;

    for (let i = 1; i < n; i += 1) {
        const v = values[i] as number;
        const prevMax = maxVal;
        const prevMin = minVal;
        const prevMaxStart = maxStart;
        const prevMinStart = minStart;

        if (v < 0) {
            maxVal = prevMin * v;
            maxStart = prevMinStart;
            minVal = prevMax * v;
            minStart = prevMaxStart;
        } else {
            maxVal = prevMax * v;
            maxStart = prevMaxStart;
            minVal = prevMin * v;
            minStart = prevMinStart;
        }
        if (v > maxVal) {
            maxVal = v;
            maxStart = i;
        }
        if (v < minVal) {
            minVal = v;
            minStart = i;
        }
        if (maxVal > best) {
            best = maxVal;
            bestStart = maxStart;
            bestEnd = i;
        }

        yield {
            stepNumber: step,
            entities: makeBars(values, i, bestStart, bestEnd),
            edges: [],
            description: `Index ${i}: best product so far is ${best} over indices ${bestStart} to ${bestEnd}.`,
            codeLineNumber: v < 0 ? 4 : 5,
            layout: "array",
            meta: { best, bestStart, bestEnd, currMin: minVal, currMax: maxVal, index: i },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(values, -1, bestStart, bestEnd),
        edges: [],
        description: `Done: maximum product ${best} from index ${bestStart} to ${bestEnd}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { best, bestStart, bestEnd, currMin: minVal, currMax: maxVal },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A running product grows or shrinks depending on the sign of the next value. Multiplying a very negative product by a negative number can produce the largest product seen, so a single running best is not enough. Track both the largest and smallest product ending at each position and swap them whenever a negative value arrives.",
        invariants: [
            "maxVal is the largest product of any subarray ending at the current index.",
            "minVal is the smallest product of any subarray ending at the current index.",
            "best is the largest product over all subarrays seen so far.",
        ],
        correctness:
            "Any subarray ending at i either extends a subarray ending at i-1 or starts at i. Extending uses prevMax times v, or prevMin times v when v is negative, so keeping both extremes captures every candidate; comparing with v alone starts a fresh subarray. Updating best with maxVal at each index therefore yields the global maximum product.",
        complexityRationale:
            "The loop performs a constant number of arithmetic operations per element, so the time is O(n); only the running extremes and their start indices are stored, giving O(1) space.",
        uses: [
            "Financial analysis of cumulative returns with gains and losses",
            "Signal processing where gain and inversion change sign",
            "A canonical exercise in one-dimensional dynamic programming",
        ],
        references: [
            "CLRS, Chapter 15, exercises on maximum subarrays",
            "Bentley, Programming Pearls, Column 8",
        ],
        workedExample:
            "For [2, 3, -2, 4, -1, 5] the scan reaches product 24 over 2, 3, -2, 4 and later 20 over -2, 4, -1, 5. The largest stays 24, so the answer is the subarray from index 0 to index 3.",
    },
    id: "max-product-subarray",
    name: "Maximum Product Subarray",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { values: [2, 3, -2, 4, -1, 5, -3, 2] },
    visualType: "array",
    run,
    pseudocode: [
        "initialize maxVal, minVal and best to the first value",
        "for each remaining value v from left to right",
        "if v is negative swap the roles of maxVal and minVal",
        "multiply the extremes by v and remember their start indices",
        "reset an extreme to v alone when v is larger or smaller",
        "update best and its bounds when maxVal exceeds best",
        "continue to the next value",
        "done: report the best product and its subarray bounds",
    ],
};

export default module;
