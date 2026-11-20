/**
 * binary-search-on-answer.ts - Binary Search on the Answer
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Many optimization questions can be rephrased as a decision question: is a
 * candidate value x large enough to satisfy a monotonic condition? Once the
 * condition is monotonic (false up to some point, true after it), binary
 * search over the numeric domain finds the smallest feasible x. This module
 * demonstrates the technique on the integer square-root question: find the
 * smallest integer x with x*x >= target.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log R) decision calls, R is the width of the answer range
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current low and high bounds are YELLOW (comparing).
 *   - The tested mid value is PURPLE (pivot).
 *   - The confirmed answer is GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(lo: number, hi: number, states: Map<number, EntityState>): VisualEntity[] {
    const bars: VisualEntity[] = [];
    for (let v = lo; v <= hi; v += 1) {
        bars.push({
            id: `bar-${v}`,
            type: "bar" as const,
            label: String(v),
            value: v,
            state: states.get(v) ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: v },
        });
    }
    return bars;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { lo?: number; hi?: number; target?: number } | null) ?? {};
    const lo = typeof task.lo === "number" ? Math.floor(task.lo) : 0;
    const hi = typeof task.hi === "number" ? Math.floor(task.hi) : 20;
    const target = typeof task.target === "number" ? task.target : 63;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(lo, hi, new Map()),
        edges: [],
        description: `Find the smallest integer whose square is at least ${target}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { lo, hi, target, calls: 0 },
    };
    step += 1;

    let low = lo;
    let high = hi;
    let answer: number | null = null;
    let calls = 0;

    // If not even the largest candidate works, there is no feasible answer.
    if (hi * hi < target) {
        yield {
            stepNumber: step,
            entities: makeBars(lo, hi, new Map()),
            edges: [],
            description: `No value in [${lo}..${hi}] has a square of at least ${target}.`,
            codeLineNumber: 6,
            layout: "array",
            meta: { lo, hi, target, calls, answer: "none" },
        };
        return;
    }

    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        calls += 1;
        const feasible = mid * mid >= target;
        const states = new Map<number, EntityState>([
            [low, "comparing"],
            [high, "comparing"],
            [mid, "pivot"],
        ]);
        if (feasible) {
            answer = mid;
            high = mid - 1;
        } else {
            low = mid + 1;
        }
        yield {
            stepNumber: step,
            entities: makeBars(lo, hi, states),
            edges: [],
            description: `Test x=${mid}: ${mid} squared is ${mid * mid}, ${feasible ? "at least" : "below"} ${target} - ${feasible ? "feasible, try smaller" : "too small, try larger"}.`,
            codeLineNumber: feasible ? 3 : 4,
            layout: "array",
            meta: { lo, hi, target, calls, mid, feasible, low, high },
        };
        step += 1;
    }

    const finalStates = new Map<number, EntityState>();
    if (answer !== null) {
        finalStates.set(answer, "sorted");
    }
    yield {
        stepNumber: step,
        entities: makeBars(lo, hi, finalStates),
        edges: [],
        description: `Smallest feasible value is ${String(answer)} after ${calls} decision call(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { lo, hi, target, calls, answer: answer ?? "none" },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of searching for an item, search for the answer itself. Define a yes-or-no question about a candidate value, such as is x squared at least the target. If the answer is always no up to some point and always yes afterward, you can binary search the numeric range to find the first value where it turns yes.",
        invariants: [
            "The predicate is monotone: once true for some x, it is true for every larger x.",
            "The feasible answer always lies inside the current [low, high] bounds.",
            "Each accepted mid records the best known feasible value before shrinking high.",
        ],
        correctness:
            "Because the predicate is monotone, every value below the first feasible one fails and every value at or above it succeeds. Standard binary search compares the predicate at mid and discards the half that cannot contain the boundary, so low eventually crosses high with answer equal to the smallest feasible value.",
        complexityRationale:
            "Each iteration makes one predicate call and halves the numeric range, so the number of calls is O(log R) where R is the range width; storage is a handful of integers, O(1).",
        uses: [
            "Integer square root and real-valued root finding",
            "Capacity problems such as the minimum ship size to pack containers",
            "Allocating the largest page size or batch size that meets a limit",
        ],
        references: [
            "Kleinberg and Tardos, Algorithm Design, binary search on the answer",
            "CP-algorithms, Binary search on the answer",
        ],
        workedExample:
            "For target 63 over zero to 20, mid 10 gives 100 which is feasible so the answer is at most 10; mid 5 gives 25 which is too small; narrowing continues until x=8 (64) is the smallest value whose square reaches 63.",
    },
    id: "binary-search-on-answer",
    name: "Binary Search on the Answer",
    category: "searching",
    complexity: { time: "O(log R)", space: "O(1)" },
    defaultInput: { lo: 0, hi: 20, target: 63 },
    visualType: "array",
    run,
    pseudocode: [
        "set low to the range start and high to the range end",
        "if even high fails, report no feasible answer",
        "while low is at most high",
        "let mid be the midpoint; test the predicate at mid",
        "if feasible, record mid and search the lower half",
        "otherwise search the upper half",
        "done: report the smallest feasible value found",
    ],
};

export default module;
