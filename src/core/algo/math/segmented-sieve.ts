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
 * segmented-sieve – Segmented Sieve of Eratosthenes.
 * Sieves [16,30] with base primes to 30; finds 17,19,23,29.
 * Default primes to 30 (10 total). Time O(n log log n).
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
            meta: {},
        };
        return;
    }
    const sq = Math.trunc(Math.sqrt(limit));
    const isB = new Array<boolean>(sq + 1).fill(true);
    isB[0] = false;
    if (sq >= 1) isB[1] = false;
    for (let i = 2; i * i <= sq; i += 1)
        if (isB[i]) for (let j = i * i; j <= sq; j += i) isB[j] = false;
    const base: number[] = [];
    for (let i = 2; i <= sq; i += 1) if (isB[i]) base.push(i);
    yield {
        stepNumber: step,
        entities: base.map((p, i) => C(0, i, `${p}`, p, "idle")),
        edges: [],
        description: `Base primes to sqrt(${limit}): [${base}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const lo = sq + 1;
    const seg = new Array<boolean>(limit - lo + 1).fill(true);
    for (const p of base) {
        let start = Math.trunc((lo + p - 1) / p) * p;
        if (start < p * p) start = p * p;
        for (let j = start; j <= limit; j += p) seg[j - lo] = false;
    }
    const showSeg = (hot: number): VisualEntity[] =>
        seg.map((v, i) =>
            C(0, i, `${lo + i}`, lo + i, i === hot ? "comparing" : v ? "sorted" : "idle"),
        );
    yield {
        stepNumber: step,
        entities: showSeg(-1),
        edges: [],
        description: `Segment [${lo}, ${limit}] after marking with base primes.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: {},
    };
    step += 1;
    for (const p of base.slice(0, 2)) {
        yield {
            stepNumber: step,
            entities: base.map((q, i) => C(0, i, `${q}`, q, q === p ? "comparing" : "idle")),
            edges: [],
            description: `Marking multiples of base prime ${p}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { p },
        };
        step += 1;
    }
    const out = [...base, ...seg.map((v, i) => (v ? lo + i : -1)).filter((v) => v > 0)];
    yield {
        stepNumber: step,
        entities: out.map((p, i) => C(0, i, `${p}`, p, "sorted")),
        edges: [],
        description: `Primes to ${limit}: [${out}] (${out.length} total).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { count: out.length },
    };
}
const module: AlgorithmModule = {
    id: "segmented-sieve",
    name: "Segmented Sieve",
    category: "math",
    complexity: { time: "O(n log log n)", space: "O(sqrt(n))" },
    defaultInput: { limit: 30 },
    visualType: "grid",
    run,
};
export default module;
