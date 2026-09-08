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
            meta: {},
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
        meta: {},
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
                    meta: {},
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
    id: "twin-prime-sieve",
    name: "Twin Prime Sieve",
    category: "math",
    complexity: { time: "O(n log log n)", space: "O(n)" },
    defaultInput: { limit: 20 },
    visualType: "grid",
    run,
};
export default module;
