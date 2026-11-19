/**
 * slope-trick.ts - Slope Trick for Monotone L1 Regression
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This module solves the classic DP
 *     dp[i](x) = min over y <= x of dp[i-1](y) + |x - a[i]|,
 * which finds a nondecreasing sequence closest to the data in total absolute
 * deviation. The derivative of each dp layer is a nondecreasing step function.
 * Slope trick stores its breakpoints in one max-heap: add a breakpoint twice
 * for the absolute value, then discard the largest one to enforce the prefix
 * minimum. The accumulated discarded gaps are the optimal cost.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) with a heap, O(n^2) for the small classroom array here
 *   Space: O(n) breakpoints
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars are the current derivative breakpoints kept in the max-heap.
 *   - The bar being added is highlighted while the largest is discarded.
 *   - The final frame reports the minimum total absolute deviation.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function insertSorted(sorted: number[], value: number): void {
    let low = 0;
    let high = sorted.length;
    while (low < high) {
        const mid = (low + high) >> 1;
        if ((sorted[mid] ?? 0) < value) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    sorted.splice(low, 0, value);
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
    const fallback = [3, 1, 4, 1, 5, 9, 2, 6];
    const raw = Array.isArray(input)
        ? (input as number[])
        : ((input as { arr?: number[] } | null)?.arr ?? fallback);
    const arr = raw.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0)).slice();
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(arr),
        edges: [],
        description: `Slope trick on ${arr.length} values: enforce one nondecreasing DP layer per value.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { processed: 0, answer: 0 },
    };
    step += 1;

    if (arr.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "Empty input - zero layers, so the minimum cost is zero.",
            codeLineNumber: 0,
            layout: "array",
            meta: { processed: 0, answer: 0 },
        };
        return;
    }

    const breakpoints: number[] = [];
    let answer = 0;
    for (let i = 0; i < arr.length; i += 1) {
        const value = arr[i] ?? 0;
        const largest = breakpoints.length > 0 ? breakpoints[breakpoints.length - 1] : undefined;
        const states = new Map<number, EntityState>();
        if (largest !== undefined && largest > value) {
            answer += largest - value;
            breakpoints.pop();
            insertSorted(breakpoints, value);
            insertSorted(breakpoints, value);
            states.set(breakpoints.length - 1, "swapped");
        } else {
            insertSorted(breakpoints, value);
            states.set(breakpoints.length - 1, "comparing");
        }
        yield {
            stepNumber: step,
            entities: makeBars(breakpoints, states),
            edges: [],
            description:
                largest !== undefined && largest > value
                    ? `Value ${value} falls below largest breakpoint ${largest}: add ${largest - value} to the cost and replace ${largest}.`
                    : `Value ${value} is at least the largest breakpoint: add one breakpoint at ${value}.`,
            codeLineNumber: largest !== undefined && largest > value ? 3 : 2,
            layout: "array",
            meta: {
                processed: i + 1,
                answer,
                plateau: breakpoints[breakpoints.length - 1] ?? value,
                discarded: largest !== undefined && largest > value,
            },
        };
        step += 1;
    }

    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < breakpoints.length; i += 1) {
        finalStates.set(i, "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeBars(breakpoints, finalStates),
        edges: [],
        description: `Done: minimum total absolute deviation is ${answer}, with the flat optimum starting at ${breakpoints[breakpoints.length - 1] ?? 0}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: {
            processed: arr.length,
            answer,
            plateau: breakpoints[breakpoints.length - 1] ?? 0,
            breakpoints: [...breakpoints],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Each DP layer is a convex piecewise-linear function whose slope rises by one at every breakpoint. Adding an absolute value contributes two breakpoints and lowers the left slope by one. Taking a prefix minimum throws away every breakpoint after the slope reaches zero, which is exactly the largest breakpoint. So one max-heap and a running sum are enough to track the whole function.",
        invariants: [
            "After i layers the heap holds exactly i breakpoints and the leftmost slope is -i.",
            "The slope is zero to the right of the largest stored breakpoint, so that point begins the optimum plateau.",
            "The running answer equals the minimum value of the current DP layer.",
        ],
        correctness:
            "Differentiating the recurrence shows that adding |x-a| shifts the derivative down by one on the left and up by one on the right, a net jump of two at a. The prefix minimum clamps the derivative at zero, deleting precisely the rightmost breakpoint. By induction on layers the heap encodes the true derivative and the accumulated deleted gaps encode the true minimum, so the reported cost is optimal.",
        complexityRationale:
            "Each of the n values performs one insertion and at most one deletion in a heap of size at most n, giving O(n log n) time and O(n) space; the classroom version keeps a sorted array for clarity.",
        uses: [
            "Isotonic regression under absolute-error loss",
            "DP optimization when a transition is a prefix minimum plus an absolute value",
            "Calibrating predictions with a monotonicity constraint",
        ],
        references: [
            "Watanabe, Slope Trick and Its Applications (2010)",
            "KACTL handbook, slide minimum and slope trick chapter",
        ],
        workedExample:
            "For values 5 then 1, the first layer keeps breakpoint 5 and cost 0. The second value 1 is smaller than 5, so the algorithm replaces 5 with two copies of 1 and adds the gap 4. The optimum nondecreasing sequence has total absolute deviation 4, which a direct two-layer DP confirms.",
    },
    id: "slope-trick",
    name: "Slope Trick (Monotone L1 DP)",
    category: "dynamic-programming",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { arr: [3, 1, 4, 1, 5, 9, 2, 6] },
    visualType: "array",
    run,
    pseudocode: [
        "start with an empty max-heap of breakpoints and cost zero",
        "for each data value a, add two breakpoints at a",
        "if the largest breakpoint exceeds a, the prefix minimum deletes it",
        "add the gap between that largest breakpoint and a to the cost",
        "otherwise keep just one new breakpoint at a",
        "the largest remaining breakpoint starts the flat optimum",
        "done: report the accumulated minimum cost",
    ],
};

export default module;
