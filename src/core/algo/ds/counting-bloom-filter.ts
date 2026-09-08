/**
 * counting-bloom-filter.ts - Counting Bloom Filter
 * Counters allow deletes; query checks all k > 0. Demo: add <=5 keys, query member + nonmember.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function cells(
    vals: (number | string)[],
    st: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return vals.map((v, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: String(v),
        value: typeof v === "number" ? v : v.length,
        state: st.get(i) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}
const M = 12;
const hs = (k: number): number[] => [(((k * 31 + 7) % M) + M) % M, (((k * 131 + 17) % M) + M) % M];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { keys?: number[]; query?: number } | null) ?? {};
    const keys = (Array.isArray(t.keys) ? t.keys : [5, 17, 9]).slice(0, 8);
    const q = typeof t.query === "number" ? t.query : 17;
    const bits = new Array<number>(M).fill(0);
    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(bits),
        edges: [],
        description:
            "Counting Bloom Filter: empty filter. Counters allow deletes; query checks all k > 0.",
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    for (const k of keys) {
        for (const j of hs(k)) bits[j] = Math.min(9, (bits[j] ?? 0) + 1);
        yield {
            stepNumber: step,
            entities: cells(
                bits,
                new Map(hs(k).map((j) => [j, "comparing"] as [number, EntityState])),
            ),
            edges: [],
            description: `Add ${k} -> positions ${hs(k).join(", ")}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {},
        };
        step += 1;
    }
    const maybe = (k: number): boolean => hs(k).every((j) => (bits[j] ?? 0) > 0);
    const hit = maybe(q);
    yield {
        stepNumber: step,
        entities: cells(bits),
        edges: [],
        description: `Query ${q}: ${hit ? "possibly present" : "definitely absent"}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const miss = 999;
    const mhit = maybe(miss);
    yield {
        stepNumber: step,
        entities: cells(bits),
        edges: [],
        description: `Query ${miss}: ${mhit ? "possibly present (fp)" : "definitely absent"}. Member ${q} test ${hit ? "passed" : "FAILED (check hashes)"} verified.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { hit },
    };
}

const module: AlgorithmModule = {
    id: "counting-bloom-filter",
    name: "Counting Bloom Filter",
    category: "data-structures",
    complexity: { time: "O(k) ops", space: "O(m)" },
    defaultInput: { keys: [5, 17, 9], query: 17 },
    visualType: "grid",
    run,
};
export default module;
