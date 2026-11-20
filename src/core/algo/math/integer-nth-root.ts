/**
 * integer-nth-root.ts - Integer Nth Root by Binary Search
 *
 * Computes the largest integer r with r^n <= x for a nonnegative integer x and
 * degree n >= 2. A binary search halves the candidate range each round, and an
 * exact BigInt power comparison avoids floating-point rounding near the root.
 *
 *   Time:  O(log x) comparisons
 *   Space: O(1)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface NthRootInput {
    x?: number;
    n?: number;
}

function powLeq(candidate: bigint, degree: number, limit: bigint): boolean {
    let value = 1n;
    for (let i = 0; i < degree; i += 1) {
        value *= candidate;
        if (value > limit) return false;
    }
    return value <= limit;
}

function makeEntities(low: number, high: number, mid: number, degree: number): VisualEntity[] {
    const values = [low, mid, high];
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: (index === 1 ? "active" : index === 0 ? "sorted" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { role: index === 0 ? "low" : index === 1 ? "mid" : "high", value, degree },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as NthRootInput | null) ?? {};
    const x = typeof task.x === "number" && Number.isFinite(task.x) && task.x >= 0 ? Math.floor(task.x) : 1024;
    const n = typeof task.n === "number" && Number.isFinite(task.n) && task.n >= 2 ? Math.trunc(task.n) : 3;
    const limit = BigInt(x);
    let low = 0;
    let high = 1;
    while (powLeq(BigInt(high), n, limit)) {
        low = high;
        high *= 2;
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(low, high, Math.floor((low + high) / 2), n),
        edges: [],
        description: `Find floor(${x} ^ (1/${n})) by binary search over [${low}, ${high}].`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows: 1, cols: 3, x, n, low, high, iterations: 0 },
    };
    step += 1;

    let iterations = 0;
    while (low + 1 < high) {
        const mid = Math.floor((low + high) / 2);
        const fits = powLeq(BigInt(mid), n, limit);
        iterations += 1;
        yield {
            stepNumber: step,
            entities: makeEntities(low, high, mid, n),
            edges: [],
            description: `Midpoint ${mid}: ${mid}^${n} ${fits ? "fits" : "exceeds"} ${x}, so ${fits ? "raise low" : "lower high"}.`,
            codeLineNumber: fits ? 2 : 3,
            layout: "array",
            meta: { rows: 1, cols: 3, x, n, low, high, mid, fits, iterations },
        };
        step += 1;
        if (fits) {
            low = mid;
        } else {
            high = mid;
        }
    }

    const result = low;
    yield {
        stepNumber: step,
        entities: makeEntities(low, high, result, n),
        edges: [],
        description: `Done: the integer ${n}th root of ${x} is ${result}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { rows: 1, cols: 3, x, n, root: result, iterations, check: powLeq(BigInt(result), n, limit) },
    };
}

const module: AlgorithmModule = {
    id: "integer-nth-root",
    name: "Integer Nth Root",
    category: "math",
    complexity: { time: "O(log x)", space: "O(1)" },
    defaultInput: { x: 1024, n: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "set low to 0 and find a high bound with high^n > x",
        "while low + 1 is less than high",
        "set mid to floor((low + high) / 2)",
        "if mid^n is at most x set low to mid, else set high to mid",
        "done: report low as the integer nth root",
    ],
    education: {
        intuition:
            "The nth root of an integer is the largest whole number whose nth power still fits inside it. Instead of trying every candidate, keep a bracket that always contains the answer and cut it in half: test the midpoint, then throw away the half that cannot contain the root.",
        invariants: [
            "Throughout the search low^n is at most x and high^n is greater than x.",
            "The true integer root always lies in the closed bracket [low, high).",
            "Each iteration strictly shrinks the bracket width.",
        ],
        correctness:
            "Binary search maintains the invariant because testing the midpoint either raises the lower bound (when its power fits) or lowers the upper bound (when it does not). When the bracket collapse condition low plus one equals high holds, no integer can lie between them, and because low^n fits while high^n does not, low is exactly the largest integer whose power is at most x.",
        complexityRationale:
            "The initial bound doubles until it exceeds the root, taking O(log x) steps. Each halving of the bracket is one BigInt power computation of n multiplications, so the search uses O(log x) iterations and constant auxiliary space.",
        uses: [
            "Exact integer arithmetic in computer algebra systems",
            "Avoiding floating-point error in cryptographic key checks",
            "Computing perfect-power thresholds in number theory code",
        ],
        references: [
            "Knuth, The Art of Computer Programming Volume 2, Section 4.2",
            "Wikipedia, Integer nth root",
        ],
        workedExample:
            "For x = 1024 and n = 3 the bracket starts near [8, 16]. The midpoint 12 gives 1728 which is too large, so high drops; 10 gives 1000 which fits, so low rises. The search settles on 10 because 10 cubed is 1000 and 11 cubed is 1331.",
    },
};

export default module;
