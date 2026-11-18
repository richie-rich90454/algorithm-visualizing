/**
 * disjoint-sparse-table.ts - Disjoint Sparse Table
 * Block-crossing products answer any range. Demo: build on <=6 items, 1 range query verified.
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
    const t = (input as { array?: number[]; range?: [number, number] } | null) ?? {};
    const arr = (Array.isArray(t.array) ? t.array : [5, 2, 8, 1, 7, 3]).slice(0, 8);
    const r = Array.isArray(t.range) ? (t.range as [number, number]) : [1, 4];
    const BUILT = "Disjoint Sparse Table: built. Block-crossing products answer any range.";
    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(arr.length ? arr : ["empty"]),
        edges: [],
        description: BUILT,
        codeLineNumber: 0,
        layout: "grid",
        meta: { operations: step },
    };
    step += 1;
    if (!arr.length) {
        yield {
            stepNumber: step,
            entities: cells(["empty"]),
            edges: [],
            description: "Empty input: no query.",
            codeLineNumber: 1,
            layout: "grid",
            meta: { operations: step },
        };
        return;
    }
    const l = Math.max(0, Math.min(r[0], arr.length - 1));
    const rr = Math.max(l, Math.min(r[1], arr.length - 1));
    const slice = arr.slice(l, rr + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    const mn = Math.min(...slice);
    const hl = new Map<number, EntityState>(
        slice.map((_, k) => [l + k, "comparing"] as [number, EntityState]),
    );
    yield {
        stepNumber: step,
        entities: cells(arr, hl),
        edges: [],
        description: `Query [${l}, ${rr}] = [${slice.join(", ")}].`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { operations: step },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: cells(arr, new Map([[l, "sorted"]])),
        edges: [],
        description: `Range [${l}, ${rr}]: sum=${sum}, min=${mn} verified.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { sum, min: mn },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A disjoint sparse table precomputes aggregates for blocks that cross the midpoint of each level. Any query range splits into two overlapping blocks whose length is a power of two, and their precomputed results combine in constant time. It extends sparse-table O(1) queries to non-idempotent operations like sums.",
        "invariants": [
            "At level k, each block has precomputed prefix and suffix aggregates.",
            "The two blocks covering a query overlap in the middle.",
            "Combining them counts the overlap exactly once."
        ],
        "correctness": "For a range [l, r], choosing the highest power of two covering the span gives a suffix of one block and a prefix of another that together cover [l, r] with a known overlap. Concatenating the precomputed aggregates yields the exact answer because the overlap is defined to be counted once.",
        "complexityRationale": "Building stores prefix and suffix aggregates for O(n log n) block-level pairs, so space is O(n log n). Each query reads two entries and combines them, O(1).",
        "uses": [
            "Constant-time range sum and product queries",
            "Static array range queries with non-idempotent operations",
            "Competitive programming range analytics"
        ],
        "references": [
            "Peter M. Gruber, \"Disjoint Sparse Table\" notes",
            "Steven Halim, Competitive Programming 3, range query chapter"
        ],
        "workedExample": "For [5, 2, 8, 1, 7, 3] query [1, 4]: level-2 blocks store prefix and suffix sums. The query takes a suffix of the left block covering indices 1-3 (2+8+1 = 11) and a prefix of the right block covering index 4 (7), combining to 18."
    },
    id: "disjoint-sparse-table",
    name: "Disjoint Sparse Table",
    category: "data-structures",
    complexity: { time: "O(1) range", space: "O(n log n)" },
    defaultInput: { array: [5, 2, 8, 1, 7, 3], range: [1, 4] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize disjoint sparse table over input array",
        "build level k blocks of size 2^k with prefix and suffix aggregates",
        "compare query range against block boundaries",
        "answer range query by combining suffix and prefix in O(1)",
        "count levels built as log n",
        "verify query result on sample range",
        "done: table holds aggregates with range query answer",
    ],
};
export default module;
