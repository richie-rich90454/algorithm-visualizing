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
 * pollard-p-minus-1 – Pollard's p-1 Factoring.
 * Raises a to L = lcm(1..B); gcd(a^L-1, n) splits n if p-1 divides L.
 * Default n=91, B=3 finds 7. Time O(B log n) for smooth p-1.
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
function gg(a: number, b: number): number {
    let x = a,
        y = b;
    while (y !== 0) {
        const r = x - Math.trunc(x / y) * y;
        x = y;
        y = r;
    }
    return x;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number; B?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 91;
    const B = typeof t.B === "number" ? Math.trunc(t.B) : 3;
    let step = 0;
    if (!(n >= 4) || !(B >= 2)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs n >= 4, B >= 2).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const gcd = (u: number, v: number): number => gg(u, v);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "idle"), C(0, 1, `B=${B}`, B, "highlight")],
        edges: [],
        description: `Factor ${n} with smoothness bound B=${B}, base a=2.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    let a = 2;
    for (let j = 2; j <= B; j += 1) {
        // raise a = a^j mod n stepwise (accumulates 2^(j!) mod n)
        let acc = 1;
        for (let i = 0; i < j; i += 1) acc = (acc * a) % n;
        a = acc;
        const d = gcd(a - 1, n);
        yield {
            stepNumber: step,
            entities: [
                C(0, 0, `a=${a}`, a, "comparing"),
                C(0, 1, `gcd=${d}`, d, d > 1 && d < n ? "sorted" : "idle"),
            ],
            edges: [],
            description: `Stage ${j}: a = 2^${j}!-chain = ${a}; gcd(${a}-1, ${n}) = ${d}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { j, a, d },
        };
        step += 1;
        if (d > 1 && d < n) {
            yield {
                stepNumber: step,
                entities: [
                    C(0, 0, `${d}`, d, "sorted"),
                    C(0, 1, `${Math.trunc(n / d)}`, Math.trunc(n / d), "sorted"),
                ],
                edges: [],
                description: `Split: ${n} = ${d} x ${Math.trunc(n / d)}.`,
                codeLineNumber: 2,
                layout: "grid",
                meta: { factors: [d, Math.trunc(n / d)] },
            };
            step += 1;
            yield {
                stepNumber: step,
                entities: [
                    C(0, 0, `${d}`, d, "sorted"),
                    C(0, 1, `${Math.trunc(n / d)}`, Math.trunc(n / d), "sorted"),
                ],
                edges: [],
                description: `Verify ${d} x ${Math.trunc(n / d)} = ${d * Math.trunc(n / d)}.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { factors: [d, Math.trunc(n / d)] },
            };
            return;
        }
    }
    yield {
        stepNumber: step,
        entities: [C(0, 0, `n=${n}`, n, "highlight")],
        edges: [],
        description: `Bound exhausted with no split – stopping honestly.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { step },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Pollard's p-1 method finds a factor of n when one prime factor p has the property that p-1 is smooth. It raises a base to increasingly high powers of small primes modulo n; if p-1 divides that exponent, Fermat's theorem makes the base congruent to 1 modulo p, so gcd(base-1, n) reveals p.",
        "invariants": [
            "The running base is a^k modulo n for a growing smooth exponent k.",
            "A nontrivial gcd of base minus one with n gives a proper factor.",
            "If the smoothness bound is exhausted without success, the method honestly reports failure."
        ],
        "correctness": "When p-1 divides the accumulated exponent, Fermat's theorem gives base = 1 mod p while base need not be 1 mod the other factor. Therefore gcd(base-1, n) is divisible by p but not by n, exposing a nontrivial factor. If p-1 is not smooth enough the method simply finds nothing.",
        "complexityRationale": "The exponentiation chain runs up to the bound B over small prime powers, costing O(B log n) modular operations. Only the running base and a gcd are stored, so space is O(1).",
        "uses": [
            "Factoring integers with a smooth prime-minus-one factor",
            "A first example of special-purpose factoring algorithms",
            "Illustrating the risks of smooth parameters in cryptography"
        ],
        "references": [
            "Pollard, Theorems on factorization and primality testing (1974)",
            "Crandall and Pomerance, Prime Numbers, Section 5.4"
        ],
        "workedExample": "For n = 91 = 7*13 with bound B = 3, raise 2 to powers of 2 and 3 and test gcd(2^k-1, 91). When the exponent reaches a multiple of 6, which is 7-1, the gcd reveals 7 and the cofactor 13."
    },
    id: "pollard-p-minus-1",
    name: "Pollard p-1 Factoring",
    category: "math",
    complexity: { time: "O(B log n)", space: "O(1)" },
    defaultInput: { n: 91, B: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "pick smoothness bound B and base a = 2",
        "climb the B-smooth chain, testing gcd(a−1, n)",
        "a nontrivial gcd splits n = d × cofactor",
        "verify the split, or stop honestly at an exhausted bound",
        "done: factor pair, or bound exhausted",
    ],
};
export default module;
