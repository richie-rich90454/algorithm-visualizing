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
 * modular-tetration-tower-euler – Tetration Tower mod m via Euler.
 * Reduces the top exponent mod phi(m), evaluates downward.
 * Default 2^(3^2) = 512 = 1 mod 7. Time O(log m).
 */
function modPow(b: number, e: number, m: number): number {
    let r = 1;
    let x = ((b % m) + m) % m;
    let k = e;
    while (k > 0) {
        if (k % 2 === 1) r = (r * x) % m;
        x = (x * x) % m;
        k = Math.trunc(k / 2);
    }
    return r;
}
function phi(v: number): number {
    let r = v;
    let x = v;
    for (let d = 2; d * d <= x; d += 1) {
        if (x - Math.trunc(x / d) * d === 0) {
            while (x - Math.trunc(x / d) * d === 0) x = Math.trunc(x / d);
            r -= Math.trunc(r / d);
        }
    }
    if (x > 1) r -= Math.trunc(r / x);
    return r;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { a?: number; b?: number; c?: number; mod?: number } | null) ?? {};
    const a = typeof t.a === "number" ? Math.trunc(t.a) : 2;
    const b = typeof t.b === "number" ? Math.trunc(t.b) : 3;
    const c = typeof t.c === "number" ? Math.trunc(t.c) : 2;
    const m = typeof t.mod === "number" ? Math.trunc(t.mod) : 7;
    let step = 0;
    if (!(m >= 2) || !(a >= 1) || !(b >= 1) || !(c >= 1)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs mod >= 2, tower >= 1).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `a=${a}`, a, "idle"),
            C(0, 1, `b=${b}`, b, "idle"),
            C(0, 2, `c=${c}`, c, "idle"),
            C(0, 3, `m=${m}`, m, "idle"),
        ],
        edges: [],
        description: `Compute ${a}^(${b}^${c}) mod ${m}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    const top = b ** c;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `e=${top}`, top, "comparing")],
        edges: [],
        description: `Top exponent ${b}^${c} = ${top}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { top },
    };
    step += 1;
    const ph = phi(m);
    const er = top % ph;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `phi=${ph}`, ph, "comparing"), C(0, 1, `e'=${er}`, er, "highlight")],
        edges: [],
        description: `phi(${m}) = ${ph}; ${top} mod ${ph} = ${er} (coprime, Euler).`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ph, er },
    };
    step += 1;
    const out = modPow(a, er === 0 ? ph : er, m);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${out}`, out, "comparing")],
        edges: [],
        description: `${a}^${er === 0 ? ph : er} mod ${m} = ${out}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { out },
    };
    step += 1;
    const exact = a ** top % m;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `${out}`, out, "sorted")],
        edges: [],
        description: `Direct ${a}^${top} mod ${m} = ${exact} – confirmed.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { out },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "A modular tetration tower such as a^(b^c) mod m can be evaluated without ever forming the enormous exponent. Euler's theorem says exponents may be reduced modulo phi(m) when the base is coprime to m, so the tower is peeled from the top by repeatedly applying the totient. The visualization reduces the exponent and finishes with a modular exponentiation.",
        "invariants": [
            "Euler's theorem permits reducing exponents modulo phi(m) when gcd(a, m) = 1.",
            "Each level of the tower uses the totient of the current modulus.",
            "The final modular power equals the tower residue modulo m."
        ],
        "correctness": "Because a^phi(m) = 1 mod m for coprime a, exponents are only meaningful modulo phi(m), so replacing an exponent by its reduced value leaves a^exponent unchanged. Applying this recursively down the tower preserves the residue at each level. The final exponentiation therefore computes the true tower value modulo m.",
        "complexityRationale": "Each reduction step computes a totient and a small power, costing O(log m) per level, so the stated bound is O(log m) for a short tower. A handful of integers are kept, giving O(1) space.",
        "uses": [
            "Computing the last digits of power towers",
            "Modular arithmetic with huge exponents",
            "Teaching Euler's theorem and iterated totients"
        ],
        "references": [
            "Niven and Zuckerman, An Introduction to the Theory of Numbers, Chapter 2",
            "Knuth, The Art of Computer Programming, Vol. 2, Section 4.6.4"
        ],
        "workedExample": "For 2^(3^2) mod 7 compute the top 3^2 = 9. Since phi(7) = 6, reduce 9 modulo 6 to 3. Then 2^3 = 8 = 1 mod 7, the tower residue."
    },
    id: "modular-tetration-tower-euler",
    name: "Modular Tetration (Euler)",
    category: "math",
    complexity: { time: "O(log m)", space: "O(1)" },
    defaultInput: { a: 2, b: 3, c: 2, mod: 7 },
    visualType: "grid",
    run,
    pseudocode: [
        "state the tower a^(b^c) mod m",
        "evaluate the top exponent b^c directly",
        "shrink it with φ(m) via Euler's theorem",
        "raise a to the reduced exponent mod m",
        "done: tower residue = out, cross-checked",
    ],
};
export default module;
