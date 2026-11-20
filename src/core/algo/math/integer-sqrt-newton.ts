import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
function C(
    r: number,
    c: number,
    label: string,
    value: number,
    state: EntityState = "idle",
): VisualEntity {
    return {
        id: `cell-${r}-${c}`,
        type: "cell" as const,
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: r, col: c },
    };
}
/**
 * integer-sqrt-newton – Newton's Integer Square Root.
 * Halves via x = (x + n/x)/2 until stable, floors honestly.
 * Default isqrt(50) = 7. Time O(log n), space O(1).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 50;
    let step = 0;
    if (!(n >= 0)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs n >= 0).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    if (n < 2) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, `${n}`, n, "sorted")],
            edges: [],
            description: `isqrt(${n}) = ${n} trivially.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { root: n },
        };
        return;
    }
    let x = Math.trunc(n / 2) || 1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "idle"), C(0, 1, `x0=${x}`, x, "highlight")],
        edges: [],
        description: `Newton for sqrt(${n}) from x0 = ${x}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    for (let guard = 0; guard < 10; guard += 1) {
        const nx = Math.trunc((x + Math.trunc(n / x)) / 2);
        yield {
            stepNumber: step,
            entities: [C(0, 0, `${x}`, x, "comparing"), C(0, 1, `${nx}`, nx, "highlight")],
            edges: [],
            description: `x -> (${x} + ${Math.trunc(n / x)})/2 = ${nx}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { x: nx },
        };
        step += 1;
        if (nx >= x) {
            x = nx;
            break;
        }
        x = nx;
    }
    while ((x + 1) * (x + 1) <= n) x += 1;
    while (x * x > n) x -= 1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${x}`, x, "sorted")],
        edges: [],
        description: `isqrt(${n}) = ${x}: ${x}^2 = ${x * x} <= ${n} < ${(x + 1) * (x + 1)}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { root: x },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Integer square root uses Newton's method on the function x^2 - n to converge quickly to the floor of sqrt(n). The iteration x <- (x + n/x)/2 halves the error each round once close, so it needs only O(log n) steps. When the guess stops improving it is pinned between x^2 <= n and (x+1)^2 > n.",
        "invariants": [
            "Once the guess is at least sqrt(n), every later iterate stays at or above sqrt(n).",
            "The sequence of guesses strictly decreases until convergence.",
            "At termination x^2 <= n < (x+1)^2, so x is the integer square root."
        ],
        "correctness": "Newton's iteration for x^2 - n has local quadratic, hence at least linear, convergence from a starting guess above the root, so the values descend toward sqrt(n). The integer version stops when the next iterate would not decrease, which is exactly when the floor condition holds. Thus the returned x is floor(sqrt(n)).",
        "complexityRationale": "The number of iterations is O(log n) because the error is roughly squared each step near the root. Each iteration is one division and one addition, with O(1) space.",
        "uses": [
            "Computing exact integer roots without floating point",
            "Primality and factorization routines needing sqrt bounds",
            "Fixing rounding errors of floating-point square root"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 2, Section 4.6.4",
            "Crandall and Pomerance, Prime Numbers, Section 2.1"
        ],
        "workedExample": "For n = 50 start from x = 50: next is (50 + 1)/2 = 25, then (25 + 2)/2 = 13, then (13 + 3)/2 = 8, then (8 + 6)/2 = 7. Since 7^2 = 49 <= 50 and 8^2 = 64 > 50, the answer is 7."
    },
    id: "integer-sqrt-newton",
    name: "Integer Square Root (Newton)",
    category: "math",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: { n: 50 },
    visualType: "grid",
    run,
    pseudocode: [
        "guess x0 for √n (trivial cases return at once)",
        "refine x ← (x + n/x)/2 each round",
        "done: isqrt(n) = x",
        "stop when the guess stops improving",
        "done: x² ≤ n < (x+1)² pins x",
    ],
};
export default module;
