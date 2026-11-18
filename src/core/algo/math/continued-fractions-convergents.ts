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
 * continued-fractions-convergents – Continued Fraction Convergents.
 * Euclid quotients become partials; recurrence builds p_k/q_k.
 * Default 7/5 = [1;2,2] with convergents 1/1, 3/2, 7/5.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { num?: number; den?: number } | null) ?? {};
    const num = typeof t.num === "number" ? Math.trunc(t.num) : 7;
    const den = typeof t.den === "number" ? Math.trunc(t.den) : 5;
    let step = 0;
    if (!(den > 0) || !(num >= 0)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate fraction – need num >= 0, den > 0.`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const cf: number[] = [];
    let a = num,
        b = den;
    while (b !== 0 && cf.length < 12) {
        cf.push(Math.trunc(a / b));
        const r = a - Math.trunc(a / b) * b;
        a = b;
        b = r;
    }
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `${num}/${den}`, num / den, "idle"),
            ...cf.map((v, i) => C(1, i, `a${i}=${v}`, v, "idle")),
        ],
        edges: [],
        description: `${num}/${den} = [${cf}] via Euclid.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { cf },
    };
    step += 1;
    let pm2 = 0,
        pm1 = 1,
        qm2 = 1,
        qm1 = 0;
    for (let i = 0; i < cf.length; i += 1) {
        const ai = cf[i] as number;
        const p = ai * pm1 + pm2,
            q = ai * qm1 + qm2;
        pm2 = pm1;
        pm1 = p;
        qm2 = qm1;
        qm1 = q;
        yield {
            stepNumber: step,
            entities: [
                C(0, 0, `a${i}=${ai}`, ai, "comparing"),
                C(0, 1, `${p}/${q}`, p / q, i === cf.length - 1 ? "sorted" : "highlight"),
            ],
            edges: [],
            description: `Convergent ${i + 1}: ${p}/${q} = ${(p / q).toFixed(3)}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { p, q },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${pm1}/${qm1}`, pm1 / qm1, "sorted")],
        edges: [],
        description: `Final convergent ${pm1}/${qm1} equals ${num}/${den}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { p: pm1, q: qm1 },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Every rational number can be written as a finite continued fraction by repeatedly taking the integer part and reciprocating the remainder. The Euclidean algorithm produces the partial quotients, and a simple recurrence turns them into successive convergents. Each convergent is the best rational approximation to the value using numbers of its size.",
        "invariants": [
            "The partial quotients are exactly the quotients from Euclid's algorithm on numerator and denominator.",
            "The recurrence p_k = a_k*p_(k-1) + p_(k-2) (and likewise for q) holds for every convergent.",
            "Consecutive convergents satisfy p_k*q_(k-1) - p_(k-1)*q_k = plus or minus one."
        ],
        "correctness": "The Euclidean steps generate a finite continued fraction equal to the original ratio because reciprocating the remainder reconstructs the division chain. The standard recurrence is proven by induction to build numerator and denominator of each convergent. The final convergent therefore equals the starting fraction exactly.",
        "complexityRationale": "Euclid's algorithm takes O(log min(num, den)) divisions, and each produces one convergent via constant-time recurrence updates. Storing the convergent chain uses O(log min(num, den)) space.",
        "uses": [
            "Best rational approximation of real numbers",
            "Solving linear Diophantine equations via convergents",
            "Rational reconstruction in computer algebra and cryptography"
        ],
        "references": [
            "Hardy and Wright, An Introduction to the Theory of Numbers, Chapter 10",
            "Knuth, The Art of Computer Programming, Vol. 2, Section 4.5.3"
        ],
        "workedExample": "For 7/5 the Euclidean quotients are 1, 2, 2, giving [1; 2, 2]. The convergents are 1/1, 3/2, and 7/5; the last one recovers the original fraction."
    },
    id: "continued-fractions-convergents",
    name: "Continued Fraction Convergents",
    category: "math",
    complexity: { time: "O(log min(num, den))", space: "O(log min(num, den))" },
    defaultInput: { num: 7, den: 5 },
    visualType: "grid",
    run,
    pseudocode: [
        "run Euclid on num/den for partial quotients [a0; a1, ...]",
        "build each convergent p/q from the recurrence",
        "done: final convergent equals num/den",
        "each convergent is the best approximation so far",
        "done: full convergent chain for num/den",
    ],
};
export default module;
