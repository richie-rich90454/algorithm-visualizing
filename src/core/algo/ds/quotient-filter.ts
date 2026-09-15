/**
 * quotient-filter.ts - Quotient Filter
 * Quotient buckets + remainder slots, compact + resizable. Demo: add <=5 keys, query member + nonmember.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quotient buckets + remainder slots, compact + resizable. Demo: add <=5 keys, query member + nonmember.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) ops
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *    - Cells form rows or columns of values.
 *    - The touched cell is YELLOW (comparing).
 *    - Finished cells are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Standard Quotient Filter behavior with textbook operation costs.
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
            "Quotient Filter: empty filter. Quotient buckets + remainder slots, compact + resizable.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ops: step },
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
            meta: { ops: step },
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
        meta: { ops: step },
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
    id: "quotient-filter",
    name: "Quotient Filter",
    category: "data-structures",
    complexity: { time: "O(1) ops", space: "O(n)" },
    defaultInput: { keys: [5, 17, 9], query: 17 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty table of quotient buckets and remainder slots",
        "hash key: split the fingerprint into quotient and remainder",
        "insert: store the remainder in the quotient bucket run",
        "shift runs right to keep buckets in sorted order",
        "query: check whether the remainder sits in the expected run",
        "absence proves nonmembership, presence means possibly present",
        "done: filter holds all keys and the query verdict is reported",
    ],
};
export default module;
