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
 * sieve-of-sundaram – Sieve of Sundaram.
 * Removes i+j+2ij; survivors give odd primes as 2k+1.
 * Default primes to 30 (10 total). Time O(n log n).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { limit?: number } | null) ?? {};
    const limit = typeof t.limit === "number" ? Math.trunc(t.limit) : 30;
    let step = 0;
    if (!(limit >= 2)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs limit >= 2).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const m = Math.trunc((limit - 1) / 2);
    yield {
        stepNumber: step,
        entities: [C(0, 0, `m=${m}`, m, "highlight")],
        edges: [],
        description: `Sundaram bound m = (${limit}-1)/2 = ${m}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { m },
    };
    step += 1;
    const dead = new Set<number>();
    for (let i = 1; i <= m; i += 1) {
        for (let j = i; 0 < 1; j += 1) {
            const k = i + j + 2 * i * j;
            if (k > m) break;
            dead.add(k);
        }
    }
    const gone = [...dead].sort((u, v) => u - v);
    for (const k of gone.slice(0, 3)) {
        yield {
            stepNumber: step,
            entities: [C(0, 0, `k=${k}`, k, "swapped")],
            edges: [],
            description: `Remove k=${k} (of form i+j+2ij); 2x${k}+1 composite.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { k },
        };
        step += 1;
    }
    const out = [2];
    for (let k = 1; k <= m; k += 1) {
        const p = 2 * k + 1;
        if (!dead.has(k) && p <= limit) out.push(p);
    }
    yield {
        stepNumber: step,
        entities: out.map((p, i) => C(0, i, `${p}`, p, "sorted")),
        edges: [],
        description: `Primes to ${limit}: [${out}] (${out.length} total).`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { count: out.length },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "The sieve of Sundaram generates odd primes by removing numbers of the form i + j + 2ij. For every remaining k, the value 2k+1 is prime. It is a compact alternative to Eratosthenes that works only on roughly half the range, because it targets odd composites directly.",
        "invariants": [
            "Every removed k corresponds to an odd composite 2k+1.",
            "A surviving k means 2k+1 has no nontrivial odd factorization.",
            "The value k = 1 maps to the prime 2 by special handling."
        ],
        "correctness": "Any odd composite can be written as (2i+1)(2j+1) = 2(i+j+2ij)+1, so it is removed when its k is crossed out. Conversely a removed k yields such a factorization, so its mapped value is composite. Therefore survivors map to primes, plus 2 added by hand.",
        "complexityRationale": "Crossing out the values i+j+2ij up to the bound m = (limit-1)/2 costs O(m log m) work, reported as O(n log n). The boolean table uses O(n) space.",
        "uses": [
            "Generating odd primes with a compact sieve",
            "Teaching an alternative characterization of primes",
            "Precomputing primes for small to moderate limits"
        ],
        "references": [
            "Sundaram, A sieve for prime numbers (1934)",
            "Knuth, The Art of Computer Programming, Vol. 1, Section 1.2.6"
        ],
        "workedExample": "For limit 20, m = 9. Remove k values 4 (from i=j=1), 7, and 10 and beyond; surviving k are 1, 2, 3, 5, 6, 8, 9. Mapping by 2k+1 gives 3, 5, 7, 11, 13, 17, 19, plus 2 by hand."
    },
    id: "sieve-of-sundaram",
    name: "Sieve of Sundaram",
    category: "math",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { limit: 30 },
    visualType: "grid",
    run,
    pseudocode: [
        "set the bound m = (limit−1)/2",
        "remove every k = i+j+2ij",
        "done: primes via 2k+1 with count",
        "the value 1 maps to the prime 2 by hand",
        "done: removed k values mark odd composites",
    ],
};
export default module;
