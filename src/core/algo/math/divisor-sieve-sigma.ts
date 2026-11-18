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
 * divisor-sieve-sigma – Divisor Sieve (Sigma Function).
 * Adds each d to multiples 2d, 3d...; sigma(n) sums divisors.
 * Default sigma(12) = 1+2+3+4+6+12 = 28. Time O(n log n).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 12;
    let step = 0;
    if (!(n >= 1)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs n >= 1).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const sig = new Array<number>(n + 1).fill(0);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "idle")],
        edges: [],
        description: `Sieve divisor sums up to ${n}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    for (let d = 1; d <= n; d += 1) {
        for (let m = d; m <= n; m += d) sig[m] = (sig[m] as number) + d;
        if (d <= 3) {
            yield {
                stepNumber: step,
                entities: [
                    C(0, 0, `d=${d}`, d, "comparing"),
                    C(0, 1, `s[${n}]=${sig[n]}`, sig[n] as number, "highlight"),
                ],
                edges: [],
                description: `Add ${d} to its multiples; partial sigma(${n}) = ${sig[n]}.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { d },
            };
            step += 1;
        }
    }
    const divs: number[] = [];
    for (let d = 1; d <= n; d += 1) if (n - Math.trunc(n / d) * d === 0) divs.push(d);
    yield {
        stepNumber: step,
        entities: divs.map((d, i) => C(0, i, `${d}`, d, "comparing")),
        edges: [],
        description: `Divisors of ${n}: [${divs}].`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `s=${sig[n]}`, sig[n] as number, "sorted")],
        edges: [],
        description: `sigma(${n}) = ${divs.join("+")} = ${sig[n]}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { sigma: sig[n] },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Instead of factoring one number at a time, a divisor sieve builds the sum-of-divisors function for every value up to n at once. It starts from a zero table and, for each divisor d, adds d to the running total of every multiple of d. After all passes the entry for n is the sum of all its divisors.",
        "invariants": [
            "After processing divisors up to d, sig[x] is the sum of all divisors of x not exceeding d.",
            "Each divisor d is added exactly once to each of its multiples.",
            "sig[n] equals the divisor-sum function sigma(n) once every d <= n is processed."
        ],
        "correctness": "The divisors of x are precisely those d for which x is a multiple of d, so the sieve visits each divisor of x exactly once and adds it to sig[x]. Induction over d keeps each entry equal to the partial divisor sum. When all d up to n are done, sig[n] is the full sigma(n).",
        "complexityRationale": "For divisor d the inner loop touches n/d multiples, so the total work is sum over d of n/d, which is O(n log n). The sigma table occupies O(n) space.",
        "uses": [
            "Computing divisor sums over a whole range efficiently",
            "Classifying perfect, abundant, and deficient numbers",
            "Precomputing arithmetic functions for number-theory queries"
        ],
        "references": [
            "Niven and Zuckerman, An Introduction to the Theory of Numbers, Chapter 3",
            "Knuth, The Art of Computer Programming, Vol. 1, Section 1.2.4"
        ],
        "workedExample": "For n = 12 the sieve adds 1, 2, 3, 4, 6, and 12 to sig[12] when processing each of those divisors. The total is 28, so sigma(12) = 28 and the divisors are 1, 2, 3, 4, 6, 12."
    },
    id: "divisor-sieve-sigma",
    name: "Divisor Sieve (Sigma)",
    category: "math",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { n: 12 },
    visualType: "grid",
    run,
    pseudocode: [
        "zero the sigma table sig[1..n]",
        "add each d to sig[d], sig[2d], ... (sieve pass)",
        "read off the divisors of n from the table",
        "sum the divisors into sigma(n)",
        "done: sigma(n) = sum of its divisors",
    ],
};
export default module;
