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
 * jacobi-symbol – Jacobi Symbol (a|n).
 * Quadratic-reciprocity reduction, no factoring needed.
 * Default (10|21) = -1. Time O(log a log n), space O(1).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { a?: number; n?: number } | null) ?? {};
    let x = typeof t.a === "number" ? Math.trunc(t.a) : 10;
    let y = typeof t.n === "number" ? Math.trunc(t.n) : 21;
    let step = 0;
    if (!(y >= 3) || y % 2 === 0) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs odd n >= 3).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    x = ((x % y) + y) % y;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `a=${x}`, x, "idle"), C(0, 1, `n=${y}`, y, "idle")],
        edges: [],
        description: `Compute (${x}|${y}) by reciprocity.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    let s = 1;
    for (let guard = 0; guard < 20 && x !== 0; guard += 1) {
        while (x % 2 === 0) {
            x = Math.trunc(x / 2);
            const r = y % 8;
            if (r === 3 || r === 5) s = -s;
            if (guard === 0) {
                yield {
                    stepNumber: step,
                    entities: [
                        C(0, 0, `a=${x}`, x, "comparing"),
                        C(0, 1, `s=${s}`, s, "highlight"),
                    ],
                    edges: [],
                    description: `Factor out 2: n mod 8 = ${r}, sign now ${s}.`,
                    codeLineNumber: 1,
                    layout: "grid",
                    meta: { s },
                };
                step += 1;
            }
        }
        const tmp = x;
        x = y;
        y = tmp;
        if (x % 4 === 3 && y % 4 === 3) s = -s;
        yield {
            stepNumber: step,
            entities: [
                C(0, 0, `a=${x}`, x, "comparing"),
                C(0, 1, `n=${y}`, y, "comparing"),
                C(0, 2, `s=${s}`, s, "highlight"),
            ],
            edges: [],
            description: `Reciprocity flip: sign ${s}, reduce ${x} mod ${y}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { s },
        };
        step += 1;
        x = x % y;
        if (step > 10) break;
    }
    const out = y === 1 ? s : 0;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${out}`, out, "sorted")],
        edges: [],
        description: `Jacobi symbol = ${out}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { jacobi: out },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "The Jacobi symbol generalizes the Legendre symbol to odd composite moduli. It is computed by repeatedly applying quadratic reciprocity: strip factors of two with a sign rule, flip the fraction and reduce modulo n, and accumulate the sign. The result is computed without factoring n, though a value of 1 does not guarantee a square exists when n is composite.",
        "invariants": [
            "Each reciprocity step preserves the value of the symbol while shrinking the arguments.",
            "The sign corrections for factors of two depend only on n modulo 8.",
            "The algorithm terminates when the numerator reaches 0 or 1."
        ],
        "correctness": "The laws of quadratic reciprocity and the supplementary laws for -1 and 2 exactly describe how the Jacobi symbol transforms under reduction. Applying them is equivalent to computing the product of Legendre symbols over the prime factors of n, even without knowing those factors. Termination at 0 or 1 therefore yields the correct symbol.",
        "complexityRationale": "Each step is a division akin to a Euclidean step, so the number of iterations is O(log a * log n) in the stated bound for these small inputs. Only a few integer variables and a sign are stored, giving O(1) space.",
        "uses": [
            "Euler and Solovay-Strassen primality tests",
            "Quadratic residuosity checks modulo composite numbers",
            "Foundations of the quadratic sieve factoring method"
        ],
        "references": [
            "Niven and Zuckerman, An Introduction to the Theory of Numbers, Chapter 5",
            "Cormen et al., Introduction to Algorithms, Section 31.4"
        ],
        "workedExample": "Compute (10|21). Strip the factor of two: since 21 mod 8 = 5, (2|21) = -1, leaving -(5|21). Reciprocity gives (5|21) = (21|5) = (1|5) = 1 because 21 mod 5 = 1. The Jacobi symbol is -1."
    },
    id: "jacobi-symbol",
    name: "Jacobi Symbol",
    category: "math",
    complexity: { time: "O(log a log n)", space: "O(1)" },
    defaultInput: { a: 10, n: 21 },
    visualType: "grid",
    run,
    pseudocode: [
        "state the symbol (a|n) to reduce",
        "strip factors of 2, fixing the sign by n mod 8",
        "flip by reciprocity and reduce a mod n",
        "done: Jacobi symbol = out",
        "done: accumulated sign gives the symbol",
    ],
};
export default module;
