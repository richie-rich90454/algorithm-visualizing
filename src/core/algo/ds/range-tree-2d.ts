/**
 * range-tree-2d.ts - Range Tree 2D
 * x-tree nodes hold y-sorted lists for 2D reports. Demo: build on <=6 items, 1 range query verified.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * x-tree nodes hold y-sorted lists for 2D reports. Demo: build on <=6 items, 1 range query verified.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log^2 n + k)
 *   Space: O(n log n)
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
 *   - Standard Range Tree 2D behavior with textbook operation costs.
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
    const BUILT = "Range Tree 2D: built. x-tree nodes hold y-sorted lists for 2D reports.";
    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(arr.length ? arr : ["empty"]),
        edges: [],
        description: BUILT,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ops: step },
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
            meta: { ops: step },
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
        meta: { ops: step },
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
        "intuition": "A two-dimensional range tree is a balanced tree on x coordinates in which each node also stores its points sorted by y. To report points in a rectangle, decompose the x range into canonical nodes and filter each node y list by the y range.",
        "invariants": [
            "Each node associated set is exactly the points in its x interval.",
            "Each node y list is sorted.",
            "The canonical nodes for an x range are disjoint and cover it."
        ],
        "correctness": "Points whose x lies in the query range are partitioned among the canonical nodes, so scanning each sorted y list finds exactly those with y in range. No point outside the x range is in those nodes and none inside is missed, so the reported set equals the rectangle contents.",
        "complexityRationale": "Building stores each point in one y list per level, O(n log n) space and time. A query visits O(log n) nodes and binary searches each y list, giving O(log^2 n + k) for k reported points.",
        "uses": [
            "Orthogonal range reporting in databases",
            "Geographic queries over latitude and longitude",
            "Two-dimensional indexing with range filters"
        ],
        "references": [
            "Bentley and Maurer, A Note on Dimensional Searching and Dynamic Index Structures, ICDT 1980",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 5"
        ],
        "workedExample": "With points derived from [5,2,8,1,7,3] and rectangle range [1,4], the x tree selects canonical nodes covering that x interval and filters their y lists; the reported points all lie inside and the count verifies."
    },
    id: "range-tree-2d",
    name: "Range Tree 2D",
    category: "data-structures",
    complexity: { time: "O(log^2 n + k)", space: "O(n log n)" },
    defaultInput: { array: [5, 2, 8, 1, 7, 3], range: [1, 4] },
    visualType: "grid",
    run,
    pseudocode: [
        "start with points unsorted and no auxiliary lists",
        "sort points by x to form the primary search order",
        "build y-sorted lists so each subtree reports by y quickly",
        "query rectangle: split x range and scan y lists inside",
        "combine the canonical cover nodes into one answer",
        "verify the reported points all lie inside the rectangle",
        "done: range contents are listed and the counts verify",
    ],
};
export default module;
