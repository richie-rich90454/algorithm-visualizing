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
            meta: {},
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
    id: "sieve-of-sundaram",
    name: "Sieve of Sundaram",
    category: "math",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { limit: 30 },
    visualType: "grid",
    run,
};
export default module;
