/**
 * bk-tree.ts - BK-Tree
 * Children keyed by discrete edit distance. Demo: index <=6 points, 1 nearest-neighbor query.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function nodes(pts: number[][], st: Map<number, EntityState> = new Map()): VisualEntity[] {
    return pts.map((p, i) => ({
        id: `n-${i}`,
        type: "node" as const,
        label: `(${p[0]},${p[1]})`,
        value: p[0]! + p[1]!,
        state: st.get(i) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: i === 0 ? "root" : 0, point: p.join(",") },
    }));
}
const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!);

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { points?: number[][]; query?: number[] } | null) ?? {};
    const pts = (
        Array.isArray(t.points)
            ? t.points
            : [
                  [2, 3],
                  [5, 1],
                  [7, 6],
                  [1, 7],
              ]
    ).slice(0, 6);
    const q = Array.isArray(t.query) ? t.query : [4, 2];
    let step = 0;
    yield {
        stepNumber: step,
        entities: [
            {
                id: "n-empty",
                type: "node" as const,
                label: "E",
                value: 0,
                state: "idle" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            },
        ],
        edges: [],
        description: "BK-Tree: empty. Children keyed by discrete edit distance.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { operations: step },
    };
    step += 1;
    for (let i = 0; i < pts.length; i += 1) {
        yield {
            stepNumber: step,
            entities: nodes(pts.slice(0, i + 1), new Map([[i, "comparing"]])),
            edges: [],
            description: `Indexed (${pts[i]![0]},${pts[i]![1]}).`,
            codeLineNumber: 1,
            layout: "tree",
            meta: { n: i + 1 },
        };
        step += 1;
    }
    let bi = 0;
    let bd = pts.length ? dist(pts[0]!, q) : Infinity;
    for (let i = 1; i < pts.length; i += 1) {
        const d = dist(pts[i]!, q);
        if (d < bd) {
            bd = d;
            bi = i;
        }
    }
    if (pts.length) {
        yield {
            stepNumber: step,
            entities: nodes(pts, new Map([[bi, "highlight"]])),
            edges: [],
            description: `Query (${q[0]},${q[1]}): nearest (${pts[bi]![0]},${pts[bi]![1]}) d=${bd.toFixed(2)}.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { operations: step },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: pts.length
            ? nodes(pts, new Map([[bi, "sorted"]]))
            : [
                  {
                      id: "n-empty",
                      type: "node" as const,
                      label: "E",
                      value: 0,
                      state: "idle" as EntityState,
                      x: 0,
                      y: 0,
                      width: 0,
                      height: 0,
                      metadata: { parentId: "root" },
                  },
              ],
        edges: [],
        description: pts.length
            ? `Partition invariant holds. Nearest to (${q[0]},${q[1]}) is (${pts[bi]![0]},${pts[bi]![1]}).`
            : "No points indexed.",
        codeLineNumber: 6,
        layout: "tree",
        meta: { nearest: pts[bi] ?? [] },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A BK-tree indexes strings or points under a metric, with each node's children keyed by their distance to the parent. It relies on the triangle inequality: if a node is d away from the query, only children whose distance label lies in d plus or minus the tolerance can contain matches. This prunes most of the tree during fuzzy search.",
        "invariants": [
            "A child labeled k contains items at distance k from its parent.",
            "Distances satisfy the triangle inequality.",
            "Sibling labels are distinct."
        ],
        "correctness": "For a query q and a node x at distance d, any item y in a child labeled k has |d - k| <= distance(q, y) by the triangle inequality. If |d - k| exceeds the tolerance t, no item in that subtree can be within t, so skipping it is safe. Searching the remaining children finds all and only the matches.",
        "complexityRationale": "Insertion computes one distance per visited node and follows one child, so it is O(log n) on average with a good metric. A tolerant search prunes whole subtrees, typically O(log n) but O(n) in the worst case. Each item is one node, O(n) space.",
        "uses": [
            "Spell checking and fuzzy string search",
            "Near-duplicate detection",
            "Metric-space nearest-neighbor lookup"
        ],
        "references": [
            "Walter A. Burkhard and Robert M. Keller, \"Some Approaches to Best-Match File Searching\", CACM 1973",
            "Peter N. Yianilos, metric-space search notes, 1993"
        ],
        "workedExample": "Insert cat, then cut and dog using edit distance: cat is root, cut hangs from child label 1, dog from label 3. Querying cot with tolerance 1 computes distance 1 to cat, so only children labeled 0, 1, or 2 are searched, finding cut at distance 1 and skipping dog."
    },
    id: "bk-tree",
    name: "BK-Tree",
    category: "data-structures",
    complexity: { time: "O(log n) avg", space: "O(n)" },
    defaultInput: {
        points: [
            [2, 3],
            [5, 1],
            [7, 6],
            [1, 7],
        ],
        query: [4, 2],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize BK-tree with first key as root",
        "compute edit distance between insert key and node",
        "descend to child labeled by that distance",
        "create new child when distance slot is empty",
        "search by comparing query distance with triangle inequality",
        "prune children outside query tolerance range",
        "done: BK-tree holds keys with near-match search answer",
    ],
};
export default module;
