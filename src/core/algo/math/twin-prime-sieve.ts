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
 * twin-prime-sieve – Twin Prime Pairs.
 * Sieves to n, keeps (p, p+2) with both prime.
 * Default to 20: (3,5),(5,7),(11,13),(17,19). Time O(n log log n).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { limit?: number } | null) ?? {};
    const limit = typeof t.limit === "number" ? Math.trunc(t.limit) : 20;
    let step = 0;
    if (!(limit >= 3)) {
        yield {
            stepNumber: 0,
            entities: [C(0, 0, "bad?", 0, "highlight")],
            edges: [],
            description: `Degenerate (needs limit >= 3).`,
            codeLineNumber: 0,
            layout: "grid",
            meta: { step },
        };
        return;
    }
    const isP = new Array<boolean>(limit + 1).fill(true);
    isP[0] = false;
    isP[1] = false;
    for (let i = 2; i * i <= limit; i += 1)
        if (isP[i]) for (let j = i * i; j <= limit; j += i) isP[j] = false;
    const primes: number[] = [];
    for (let i = 2; i <= limit; i += 1) if (isP[i]) primes.push(i);
    yield {
        stepNumber: step,
        entities: primes.map((p, i) => C(0, i, `${p}`, p, "idle")),
        edges: [],
        description: `Primes to ${limit}: [${primes}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step },
    };
    step += 1;
    const pairs: Array<[number, number]> = [];
    for (const p of primes) {
        if (p + 2 > limit) break;
        if (isP[p + 2]) {
            pairs.push([p, p + 2]);
            if (pairs.length <= 4) {
                yield {
                    stepNumber: step,
                    entities: [
                        C(0, 0, `${p}`, p, "comparing"),
                        C(0, 1, `${p + 2}`, p + 2, "sorted"),
                    ],
                    edges: [],
                    description: `(${p}, ${p + 2}) both prime – twin pair ${pairs.length}.`,
                    codeLineNumber: 1,
                    layout: "grid",
                    meta: { step },
                };
                step += 1;
            }
        }
        if (step > 12) break;
    }
    yield {
        stepNumber: step,
        entities: pairs.flatMap(([p, q], i) => [
            C(0, 2 * i, `${p}`, p, "sorted"),
            C(0, 2 * i + 1, `${q}`, q, "sorted"),
        ]),
        edges: [],
        description: `${pairs.length} twin pair(s) to ${limit}: ${pairs.map(([p, q]) => `(${p},${q})`).join(", ")}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { count: pairs.length },
    };
}
const module: AlgorithmModule = {

    education: {
        "intuition": "Twin primes are pairs of primes differing by two. This visualization first sieves all primes up to a limit, then walks the sorted prime list looking for consecutive entries with a gap of exactly two. Each such pair is recorded, and the prime 2 is skipped because its only even partner does not exist.",
        "invariants": [
            "The sieve marks exactly the primes up to the limit.",
            "A recorded pair (p, p+2) has both entries prime.",
            "Pairs are counted once by scanning primes in increasing order."
        ],
        "correctness": "Primality from the sieve is exact, so any pair found with gap two is genuinely a twin prime pair. Scanning the ordered prime list examines every candidate pair exactly once. Hence the listed pairs and their count are the twin primes up to the limit.",
        "complexityRationale": "Sieving to the limit costs O(n log log n), and the linear scan of primes adds O(n / log n), so the sieve dominates. The prime table uses O(n) space.",
        "uses": [
            "Exploring the twin prime conjecture empirically",
            "Counting twin primes for number theory experiments",
            "Reusing a sieve for multiple prime-pair queries"
        ],
        "references": [
            "Hardy and Wright, An Introduction to the Theory of Numbers, Chapter 1",
            "Crandall and Pomerance, Prime Numbers, Section 3.2"
        ],
        "workedExample": "Sieve to 20 to get 2, 3, 5, 7, 11, 13, 17, 19. Pairs with gap two are (3,5), (5,7), (11,13), and (17,19), so there are four twin prime pairs up to 20."
    },
    id: "twin-prime-sieve",
    name: "Twin Prime Sieve",
    category: "math",
    complexity: { time: "O(n log log n)", space: "O(n)" },
    defaultInput: { limit: 20 },
    visualType: "grid",
    run,
    pseudocode: [
        "sieve the primes up to limit",
        "keep prime pairs (p, p+2) as twins",
        "done: twin count with every pair listed",
        "the prime 2 is skipped: no even twin partner",
        "done: count twin pairs to limit",
    ],
};
export default module;
