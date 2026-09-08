/**
 * bitset.ts - Bitset
 * One bit per value; AND/OR are word-parallel. Demo: add <=6 values, test hit + miss.
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { values?: number[]; query?: number } | null) ?? {};
    const vals = (Array.isArray(t.values) ? t.values : [3, 1, 4, 6]).slice(0, 8);
    const q = typeof t.query === "number" ? t.query : 4;
    const set = new Set<number>();
    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(vals.length ? [0] : [0], new Map()),
        edges: [],
        description: "Bitset: empty. One bit per value; AND/OR are word-parallel.",
        codeLineNumber: 0,
        layout: "grid",
        meta: {},
    };
    step += 1;
    for (const v of vals) {
        set.add(v);
        yield {
            stepNumber: step,
            entities: cells([...set], new Map([[[...set].indexOf(v), "comparing"]])),
            edges: [],
            description: `Add ${v} (size ${set.size}).`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {},
        };
        step += 1;
    }
    if (set.size === 0) {
        yield {
            stepNumber: step,
            entities: cells(["empty"]),
            edges: [],
            description: "Empty set.",
            codeLineNumber: 2,
            layout: "grid",
            meta: {},
        };
        return;
    }
    const arr = [...set];
    const hit = set.has(q);
    yield {
        stepNumber: step,
        entities: cells(arr, new Map(hit ? [[arr.indexOf(q), "highlight"]] : [])),
        edges: [],
        description: `Contains ${q}: ${hit}.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: {},
    };
    step += 1;
    const miss = 999;
    const mhit = set.has(miss);
    yield {
        stepNumber: step,
        entities: cells(arr, new Map()),
        edges: [],
        description: `Contains ${miss}: ${mhit}. Final size ${set.size}; query ${q} ${hit ? "present" : "absent"} verified.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { hit, size: set.size },
    };
}

const module: AlgorithmModule = {
    id: "bitset",
    name: "Bitset",
    category: "data-structures",
    complexity: { time: "O(1) test", space: "O(u/w)" },
    defaultInput: { values: [3, 1, 4, 6], query: 4 },
    visualType: "grid",
    run,
};
export default module;
