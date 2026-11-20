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
 * solovay-strassen-test – Solovay-Strassen Primality Test.
 * Checks a^((n-1)/2) = Jacobi(a,n) (mod n) for a few bases.
 * Default n=13 passes bases 2 and 5. Time O(k log^3 n).
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
function jacobi(a: number, n: number): number {
    let x = ((Math.trunc(a) % n) + n) % n;
    let y = Math.trunc(n);
    let s = 1;
    while (x !== 0) {
        while (x % 2 === 0) {
            x = Math.trunc(x / 2);
            const r = y % 8;
            if (r === 3 || r === 5) s = -s;
        }
        const t = x;
        x = y;
        y = t;
        if (x % 4 === 3 && y % 4 === 3) s = -s;
        x = x % y;
    }
    return y === 1 ? s : 0;
}
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number; bases?: number[] } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 13;
    const bases = Array.isArray(t.bases) ? (t.bases as number[]).map(Math.trunc) : [2, 5];
    let step = 0;
    if (!(n >= 3) || n % 2 === 0) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, `n=${n}?`, n, "highlight")],
            edges: [],
            description: `${n} is degenerate (needs odd n >= 3).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `n=${n}`, n, "idle"),
            ...bases.map((b, i) => C(1, i, `a=${b}`, b, "idle")),
        ],
        edges: [],
        description: `Testing n=${n} against ${bases.length} bases.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    for (let i = 0; i < bases.length; i += 1) {
        const a = (bases[i] ?? 2) % n;
        const j = jacobi(a, n);
        const jm = ((j % n) + n) % n;
        yield {
            stepNumber: step,
            entities: [
                C(0, 0, `n=${n}`, n, "idle"),
                C(1, i, `a=${a}`, a, "comparing"),
                C(2, 0, `J=${jm}`, jm, "highlight"),
            ],
            edges: [],
            description: `Base ${a}: Jacobi symbol = ${j} (as ${jm} mod ${n}).`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { a },
        };
        step += 1;
        const e = modPow(a, Math.trunc((n - 1) / 2), n);
        if (j === 0 || e !== jm) {
            yield {
                stepNumber: step,
                entities: [C(0, 0, `n=${n}`, n, "idle"), C(1, i, `a=${a}`, a, "swapped")],
                edges: [],
                description: `Base ${a}: Euler=${e} vs Jacobi=${jm} – COMPOSITE.`,
                codeLineNumber: 1,
                layout: "grid",
                meta: { composite: true },
            };
            return;
        }
        yield {
            stepNumber: step,
            entities: [
                C(0, 0, `n=${n}`, n, "idle"),
                C(1, i, `a=${a}`, a, "comparing"),
                C(2, 0, `E=${e}`, e, "idle"),
                C(2, 1, `J=${jm}`, jm, "idle"),
            ],
            edges: [],
            description: `Base ${a}: ${a}^${Math.trunc((n - 1) / 2)} = ${e}, Jacobi = ${jm} – passes.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { a, e },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `n=${n}`, n, "sorted"),
            ...bases.map((b, i) => C(1, i, `a=${b}`, b, "sorted")),
        ],
        edges: [],
        description: `All bases pass – ${n} is probably prime.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { probablyPrime: true },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Solovay-Strassen is a probabilistic primality test that compares Euler's criterion with the Jacobi symbol. For a prime n these always agree for any base a; a disagreement proves n composite. Testing several random bases makes the chance of a composite surviving at most one in two to the power of the number of bases.",
        "invariants": [
            "A base where a^((n-1)/2) differs from the Jacobi symbol proves compositeness.",
            "For a prime n the two values agree for every coprime base.",
            "Surviving all chosen bases makes n a strong probable prime."
        ],
        "correctness": "Euler's criterion for primes states that the Legendre symbol equals a^((n-1)/2) mod n, and the Jacobi symbol generalizes Legendre to composite moduli. A prime therefore always passes, while for any composite at least half of bases expose a mismatch. The randomized test is thus one-sided with bounded error.",
        "complexityRationale": "Each base needs one modular exponentiation plus a Jacobi computation, O(log^3 n) time; with k bases the total is O(k log^3 n). Only a few residues are stored, so space is O(1).",
        "uses": [
            "Probabilistic primality screening",
            "Historical foundation for Miller-Rabin",
            "Teaching the link between Euler's criterion and the Jacobi symbol"
        ],
        "references": [
            "Solovay and Strassen, A fast Monte-Carlo test for primality (1977)",
            "Cormen et al., Introduction to Algorithms, Section 31.4"
        ],
        "workedExample": "For n = 13 and base 2, Euler gives 2^6 = 64 = 12 = -1 mod 13, and the Jacobi symbol (2|13) = -1 since 13 mod 8 = 5. They agree, so base 2 passes and 13 remains probably prime."
    },
    id: "solovay-strassen-test",
    name: "Solovay-Strassen Test",
    category: "math",
    complexity: { time: "O(k log^3 n)", space: "O(1)" },
    defaultInput: { n: 13, bases: [2, 5] },
    visualType: "grid",
    run,
    pseudocode: [
        "pick random bases to test n",
        "compare Euler a^((n−1)/2) against the Jacobi symbol",
        "a matching base passes; a mismatch proves composite",
        "surviving every base means probably prime",
        "done: composite proof, or probable primality",
    ],
};
export default module;
