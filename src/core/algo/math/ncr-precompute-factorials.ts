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
 * ncr-precompute-factorials – nCr via Factorial Table mod p.
 * Precomputes factorials, answers C(n,k) = n!/(k!(n-k)!) mod p.
 * Default C(5,2) = 10 mod 13. Time O(n) precompute, O(log p) query.
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
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { n?: number; k?: number; mod?: number } | null) ?? {};
    const n = typeof t.n === "number" ? Math.trunc(t.n) : 5;
    const k = typeof t.k === "number" ? Math.trunc(t.k) : 2;
    const mod = typeof t.mod === "number" ? Math.trunc(t.mod) : 13;
    let step = 0;
    if (!(n >= 0) || !(k >= 0) || k > n || !(mod >= 2) || n >= mod) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs 0 <= k <= n < mod).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const f = [1];
    for (let i = 1; i <= n; i += 1) f.push(((f[i - 1] as number) * i) % mod);
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `n=${n}`, n, "idle"),
            C(0, 1, `k=${k}`, k, "idle"),
            C(0, 2, `mod=${mod}`, mod, "idle"),
        ],
        edges: [],
        description: `Compute C(${n},${k}) mod ${mod} via factorials.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: f.slice(0, 3).map((v, i) => C(0, i, `${i}!=${v}`, v, "comparing")),
        edges: [],
        description: `Seed 0! = 1, 1! = 1, 2! = ${f[2]} mod ${mod}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: f.map((v, i) => C(0, i, `${i}!=${v}`, v, "idle")),
        edges: [],
        description: `Factorial table mod ${mod} up to ${n}!.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    const denom = ((f[k] as number) * (f[n - k] as number)) % mod;
    yield {
        stepNumber: step,
        entities: [
            C(0, 0, `${n}!=${f[n]}`, f[n] as number, "comparing"),
            C(0, 1, `den=${denom}`, denom, "comparing"),
        ],
        edges: [],
        description: `${n}! = ${f[n]}, denom ${k}!${n - k}! = ${denom} mod ${mod}.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    const ans = ((f[n] as number) * modPow(denom, mod - 2, mod)) % mod;
    yield {
        stepNumber: step,
        entities: [C(0, 0, `C=${ans}`, ans, "sorted")],
        edges: [],
        description: `C(${n},${k}) = ${ans} mod ${mod}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { ans },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Computing many binomial coefficients modulo a prime is easy if factorials are precomputed. Since C(n, k) = n! / (k!*(n-k)!), we build a table of factorials up to n and multiply by the modular inverses of the denominator terms. Fermat's theorem gives each inverse as a single exponentiation, so queries are answered in constant time after setup.",
        "invariants": [
            "The table entry f[i] equals i! modulo p.",
            "p is prime so every nonzero factorial has an inverse.",
            "The product f[n] times inv(f[k]) times inv(f[n-k]) equals C(n, k) mod p."
        ],
        "correctness": "By induction f[i] = f[i-1]*i = i! mod p. The algebraic definition of the binomial coefficient rewrites division as multiplication by modular inverses, which exist because p exceeds n and all factorials are nonzero mod p. The computed product is therefore C(n, k) modulo p.",
        "complexityRationale": "Building the table costs O(n) multiplications and the two Fermat inversions cost O(log p) each, giving O(n + log p) time. The factorial table needs O(n) space.",
        "uses": [
            "Answering many binomial queries modulo a prime",
            "Combinatorial counting in competitive programming",
            "Computing coefficients in polynomial expansions"
        ],
        "references": [
            "Niven and Zuckerman, An Introduction to the Theory of Numbers, Chapter 6",
            "Cormen et al., Introduction to Algorithms, Section 31.3"
        ],
        "workedExample": "Modulo 13 build factorials up to 5: f[5] = 120 = 3. Then C(5,2) = 3 * inv(f[2]) * inv(f[3]) = 3 * inv(2) * inv(6) = 3 * 7 * 11 = 231 = 10 mod 13, matching 10."
    },
    id: "ncr-precompute-factorials",
    name: "nCr via Factorial Table",
    category: "math",
    complexity: { time: "O(n + log p)", space: "O(n)" },
    defaultInput: { n: 5, k: 2, mod: 13 },
    visualType: "grid",
    run,
    pseudocode: [
        "build the factorial table 0!..n! mod p",
        "divide out k!·(n−k)! via modular inverse",
        "done: C(n,k) = ans mod p",
        "each entry extends the last: f[i] = f[i−1]·i",
        "done: one Fermat inverse handles the denominator",
    ],
};
export default module;
