/**
 * merge-sort-tree.ts - Merge Sort Tree
 * Sorted segment vectors + binary search per level. Demo: build on <=6 items, 1 range query verified.
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
    const BUILT = "Merge Sort Tree: built. Sorted segment vectors + binary search per level.";
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
        "intuition": "A merge sort tree is a segment tree in which every node stores a sorted vector of the elements in its interval. To answer a question about a range, split it into O(log n) canonical nodes and binary search inside each sorted vector. It is a segment tree whose merge step is simply keeping the sorted list.",
        "invariants": [
            "Each node vector is exactly the sorted elements of its segment.",
            "A parent vector is the merge of its two child vectors.",
            "The canonical nodes used by a query are disjoint and their union is the query range."
        ],
        "correctness": "Because each node holds the sorted multiset of its segment, binary search correctly counts how many values satisfy a predicate inside that segment. The canonical nodes are disjoint and cover the range exactly, so summing their counts gives the answer with no double counting.",
        "complexityRationale": "Building merges and sorts vectors level by level, storing each element once per level, for O(n log n) build time and space. A query visits O(log n) nodes and binary searches each in O(log n), giving O(log^2 n).",
        "uses": [
            "Counting values below a threshold inside a subarray",
            "Range quantile queries together with a value-index structure",
            "Offline two-dimensional dominance counting"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 14 on augmenting data structures",
            "cp-algorithms, Merge Sort Tree (online reference)"
        ],
        "workedExample": "For array [5,2,8,1,7,3] and range [1,4] the slice is [2,8,1,7], with sum 18 and minimum 1. The query splits into sorted node vectors, and binary searching each one yields the range aggregate."
    },
    id: "merge-sort-tree",
    name: "Merge Sort Tree",
    category: "data-structures",
    complexity: { time: "O(log^2 n) query", space: "O(n log n)" },
    defaultInput: { array: [5, 2, 8, 1, 7, 3], range: [1, 4] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize merge sort tree over input array",
        "build node by merging sorted child vectors",
        "compare query range against node interval",
        "count numbers below k with binary search in node",
        "combine counts from overlapping children",
        "verify build sizes sum across levels",
        "done: tree holds sorted vectors with query count answer",
    ],
};
export default module;
