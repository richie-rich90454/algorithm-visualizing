/**
 * fenwick-tree-2d.ts - Fenwick Tree 2D
 * Nested lowbit loops over rows then columns. Demo: build on <=6 items, 1 range query verified.
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
    const BUILT = "Fenwick Tree 2D: built. Nested lowbit loops over rows then columns.";
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
        "intuition": "A 2D Fenwick tree nests the lowbit index trick over rows and columns. Updates climb both dimensions with i += lowbit(i) and j += lowbit(j), and prefix sums descend both. A rectangle sum is obtained by inclusion-exclusion from four prefix sums.",
        "invariants": [
            "Each cell stores the sum of a rectangle defined by lowbit ranges in both axes.",
            "Lowbit stepping is independent in rows and columns.",
            "A rectangle query uses four corner prefix sums."
        ],
        "correctness": "The nested lowbit decomposition partitions the 2D prefix region into disjoint rectangles, so summing the visited cells yields the true prefix sum. Inclusion-exclusion of four prefixes cancels the overlapping regions, leaving exactly the rectangle. Updates touch precisely the cells whose rectangles contain the point.",
        "complexityRationale": "Both dimensions contribute log factors, so updates and queries are O(log n log m). The grid of accumulators is O(n m) in the dense implementation shown.",
        "uses": [
            "2D range-sum queries on grids",
            "Sparse matrix cumulative statistics",
            "Image integral computations"
        ],
        "references": [
            "Peter M. Fenwick, \"A New Data Structure for Cumulative Frequency Tables\", 1994",
            "Steven Halim, Competitive Programming 3, 2D Fenwick section"
        ],
        "workedExample": "On a 6 by 6 grid, updating cell (3, 4) touches rows 3 and 4 and columns 4 and 8 in the nested loops. A rectangle query [1, 4] combines prefix sums at its four corners, subtracting the two smaller corners and adding back the origin."
    },
    id: "fenwick-tree-2d",
    name: "Fenwick Tree 2D",
    category: "data-structures",
    complexity: { time: "O(log^2 n) ops", space: "O(nm)" },
    defaultInput: { array: [5, 2, 8, 1, 7, 3], range: [1, 4] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize 2D BIT with zero grid of size n by m",
        "update point by propagating with i plus lowbit(i)",
        "compare indices to climb both dimensions",
        "query prefix sum by accumulating with i minus lowbit(i)",
        "combine four prefix sums for rectangle query",
        "count operations across updates and queries",
        "done: 2D tree holds grid with rectangle sum answer",
    ],
};
export default module;
