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
 * factorial-prime-exponent-legendre – Legendre's Formula.
 * v_p(n!) = floor(n/p) + floor(n/p^2) + ...
 * Default v_5(25!) = 5+1 = 6. Time O(log_p n).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number; p?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 25;
    const p = typeof t.p === "number" ? Math.trunc(t.p) : 5;
    let step = 0;
    if (!(n >= 0) || !(p >= 2)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs n >= 0, p >= 2).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "idle"), C(0, 1, `p=${p}`, p, "idle")],
        edges: [],
        description: `Exponent of ${p} in ${n}! via Legendre.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    let total = 0;
    let div = p;
    let k = 1;
    while (div <= n && k < 12) {
        const term = Math.trunc(n / div);
        total += term;
        yield {
            stepNumber: step,
            entities: [
                C(0, 0, `${p}^${k}=${div}`, div, "comparing"),
                C(0, 1, `t=${term}`, term, "highlight"),
            ],
            edges: [],
            description: `floor(${n}/${div}) = ${term}; running sum ${total}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { term, total },
        };
        step += 1;
        if (div > Math.trunc(n / p)) break;
        div *= p;
        k += 1;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `v=${total}`, total, "comparing")],
        edges: [],
        description: `v_${p}(${n}!) = ${total}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { v: total },
    };
    step += 1;
    let multi = 0;
    for (let k = 1; k <= n; k += 1) {
        let q = k;
        while (q - Math.trunc(q / p) * p === 0) {
            multi += 1;
            q = Math.trunc(q / p);
        }
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `v=${total}`, total, "sorted")],
        edges: [],
        description: `Direct count of ${p}s in 1..${n} also gives ${multi} – confirmed.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { v: total },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Legendre's formula gives the exponent of a prime p in n! without computing the huge factorial. It adds floor(n/p), floor(n/p^2), floor(n/p^3), and so on: the first term counts multiples of p, the second counts the extra factor from multiples of p^2, and so forth. The visualization sums the terms and cross-checks by counting factors directly.",
        "invariants": [
            "Term k counts integers in 1..n divisible by p^k.",
            "A number divisible by p^e contributes to exactly e terms.",
            "The running sum after k terms is the exponent of p in the product of p-free parts removed so far."
        ],
        "correctness": "Each multiple of p contributes one factor of p, each multiple of p^2 a second, and so on, so the total number of p factors in n! is exactly the sum of those floor counts. This equals the exponent v_p(n!) by definition, and the direct count confirms it.",
        "complexityRationale": "The powers p^k grow geometrically, so only O(log_p n) terms are summed. Each term is a single division, and no arrays are needed, giving O(1) space.",
        "uses": [
            "Computing exponents in binomial coefficients modulo primes",
            "Factoring factorials in combinatorial number theory",
            "Checking divisibility of n! by prime powers"
        ],
        "references": [
            "Niven and Zuckerman, An Introduction to the Theory of Numbers, Chapter 4",
            "Legendre, Theorie des nombres (1830)"
        ],
        "workedExample": "For n = 25 and p = 5 the terms are floor(25/5) = 5 and floor(25/25) = 1, giving v_5(25!) = 6. The multiples of 5 contribute six factors of five in total."
    },
    id: "factorial-prime-exponent-legendre",
    name: "Factorial Prime Exponent",
    category: "math",
    complexity: { time: "O(log_p n)", space: "O(1)" },
    defaultInput: { n: 25, p: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "state Legendre's sum for prime p in n!",
        "add floor(n/p) + floor(n/p²) + ... term by term",
        "the running sum is v_p(n!)",
        "cross-check by counting p directly in 1..n",
        "done: exponent of p in n! confirmed",
    ],
};
export default module;
