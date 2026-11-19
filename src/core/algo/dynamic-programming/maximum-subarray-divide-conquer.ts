/**
 * maximum-subarray-divide-conquer.ts - Maximum Subarray by Divide and Conquer
 *
 * The maximum-sum contiguous subarray lies either entirely in the left half,
 * entirely in the right half, or crosses the midpoint. Recursively solving the
 * two halves and computing the best crossing subarray gives the answer as the
 * best of those three candidates.
 *
 * Time: O(n log n)
 * Space: O(log n) recursion depth, plus O(n) for the frame records
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Span {
    sum: number;
    lo: number;
    hi: number;
}

interface Event {
    lo: number;
    hi: number;
    left: Span;
    right: Span;
    crossing: Span;
    best: Span;
}

function better(a: Span, b: Span): Span {
    if (a.sum !== b.sum) {
        return a.sum > b.sum ? a : b;
    }
    if (a.lo !== b.lo) {
        return a.lo < b.lo ? a : b;
    }
    return a.hi <= b.hi ? a : b;
}

function makeBars(arr: number[], segment: [number, number] | null, winner: Span | null): VisualEntity[] {
    const states = new Map<number, EntityState>();
    if (segment) {
        for (let i = segment[0]; i <= segment[1]; i += 1) {
            states.set(i, "comparing");
        }
    }
    if (winner) {
        for (let i = winner.lo; i <= winner.hi; i += 1) {
            states.set(i, "path");
        }
    }
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
    const arr = Array.isArray(input) ? [...(input as number[])] : [4, -1, 2, -7, 3, 9, -2, 5];
    const n = arr.length;
    const events: Event[] = [];

    const solve = (lo: number, hi: number): Span => {
        if (lo === hi) {
            return { sum: arr[lo] as number, lo, hi };
        }
        const mid = Math.floor((lo + hi) / 2);
        const left = solve(lo, mid);
        const right = solve(mid + 1, hi);

        let leftSum = -Infinity;
        let leftStart = mid;
        let running = 0;
        for (let i = mid; i >= lo; i -= 1) {
            running += arr[i] as number;
            if (running >= leftSum) {
                leftSum = running;
                leftStart = i;
            }
        }
        let rightSum = -Infinity;
        let rightEnd = mid + 1;
        running = 0;
        for (let i = mid + 1; i <= hi; i += 1) {
            running += arr[i] as number;
            if (running >= rightSum) {
                rightSum = running;
                rightEnd = i;
            }
        }
        const crossing: Span = { sum: leftSum + rightSum, lo: leftStart, hi: rightEnd };
        const best = better(better(left, right), crossing);
        events.push({ lo, hi, left, right, crossing, best });
        return best;
    };

    let answer: Span = { sum: 0, lo: -1, hi: -1 };
    if (n > 0) {
        answer = solve(0, n - 1);
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(arr, null, null),
        edges: [],
        description: "Dividing the array to find the best subarray in each half and across the midpoint.",
        codeLineNumber: 0,
        layout: "array",
        meta: { bestSum: 0, bestLo: -1, bestHi: -1, merges: 0 },
    };
    step += 1;

    for (const event of events) {
        yield {
            stepNumber: step,
            entities: makeBars(arr, [event.lo, event.hi], event.best),
            edges: [],
            description:
                `Range ${event.lo}-${event.hi}: left ${event.left.sum}, right ${event.right.sum}, ` +
                `crossing ${event.crossing.sum}; best is ${event.best.sum}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: {
                bestSum: event.best.sum,
                bestLo: event.best.lo,
                bestHi: event.best.hi,
                merges: step,
                left: event.left.sum,
                right: event.right.sum,
                crossing: event.crossing.sum,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(arr, null, answer),
        edges: [],
        description:
            n === 0
                ? "The array is empty, so no subarray exists and the maximum sum is zero."
                : `Maximum subarray sum ${answer.sum} spans indices ${answer.lo} to ${answer.hi}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { bestSum: answer.sum, bestLo: answer.lo, bestHi: answer.hi, merges: events.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Split the array in half. The best subarray is either wholly on the left, wholly on the right, or it crosses the split. The crossing case is easy to find: take the best suffix ending at the midpoint and the best prefix starting just after it, then join them. Recursing on each half gives a clean divide-and-conquer solution.",
        invariants: [
            "The three candidates cover every possible contiguous subarray of the current range.",
            "A crossing subarray consists of a suffix of the left half and a prefix of the right half.",
            "The returned span is the best of the left, right, and crossing spans.",
        ],
        correctness:
            "Every subarray of the current range either stays on one side of the midpoint or crosses it, so the three cases are exhaustive. Recursion gives optimal spans within each half by induction, and scanning suffixes and prefixes finds the optimum crossing span because its two parts are independent. Taking the best candidate therefore returns the globally best subarray.",
        complexityRationale:
            "At each of the log n recursion levels the crossing scan touches every element at most once, so total work is O(n log n). Recursion depth is O(log n), and the visualization stores one record per merge, O(n) frames in total.",
        uses: [
            "Finding the peak of a running profit or signal window",
            "A teaching example of divide-and-conquer on arrays",
            "A baseline for comparing with the linear-time Kadane algorithm",
        ],
        references: [
            "CLRS, Introduction to Algorithms, Chapter 4.1",
            "Bentley, Programming Pearls, maximum subarray column",
        ],
        workedExample:
            "For [4, -1, 2, -7, 3, 9, -2, 5], the left half's best is 5 (indices 0 to 2) and the right half's best is 12 (3 to 7). The best crossing span is 3 + 9 - 2 + 5 = 15 from indices 4 to 7, which is the overall answer.",
    },
    id: "maximum-subarray-divide-conquer",
    name: "Maximum Subarray (Divide and Conquer)",
    category: "dynamic-programming",
    complexity: { time: "O(n log n)", space: "O(log n)" },
    defaultInput: [4, -1, 2, -7, 3, 9, -2, 5],
    visualType: "array",
    run,
    pseudocode: [
        "if the range holds one value, return that value as the best span",
        "recursively find the best span in the left and right halves",
        "find the best suffix ending at the midpoint",
        "find the best prefix starting after the midpoint and join them",
        "return the best of the left, right, and crossing spans",
        "done: report the maximum sum and its indices",
    ],
};

export default module;
