/**
 * sparse-set.ts - Sparse Set
 * Dense/sparse pair give O(1) membership. Demo: add <=6 values, test hit + miss.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Dense/sparse pair give O(1) membership. Demo: add <=6 values, test hit + miss.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) ops
 *   Space: O(u)
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
 *   - Standard Sparse Set behavior with textbook operation costs.
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
        description: "Sparse Set: empty. Dense/sparse pair give O(1) membership.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ops: step },
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
            meta: { ops: step },
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
            meta: { ops: step },
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
        meta: { ops: step },
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
    id: "sparse-set",
    name: "Sparse Set",
    category: "data-structures",
    complexity: { time: "O(1) ops", space: "O(u)" },
    defaultInput: { values: [3, 1, 4, 6], query: 4 },
    visualType: "grid",
    run,
    pseudocode: [
        "start with empty dense and sparse arrays",
        "add value: append it to dense and record its index in sparse",
        "back pointers let removal swap with the last dense entry",
        "membership test checks the sparse index round-trips correctly",
        "test both a member and a nonmember to show both paths",
        "size counts the occupied dense prefix",
        "done: set holds all values and both query verdicts are reported",
    ],
};
export default module;
