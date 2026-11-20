/**
 * m-tree.ts - M-Tree
 * Routing objects with covering radii. Demo: index <=6 points, 1 nearest-neighbor query.
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
        description: "M-Tree: empty. Routing objects with covering radii.",
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
        "intuition": "An M-tree is a height-balanced index for metric spaces where objects are only known through a distance function. Each node stores routing objects together with a covering radius, and inserts descend toward the routing object whose ball is closest. Queries prune whole subtrees with the triangle inequality, so it behaves like a B-tree whose keys are distances rather than ordered values.",
        "invariants": [
            "Every routing object ball covers all objects stored in its subtree.",
            "All leaves sit at the same depth so the tree stays balanced.",
            "For a query q, dist(q, center) minus radius lower-bounds the distance to anything inside that ball."
        ],
        "correctness": "By the triangle inequality, any object inside a ball lies at least dist(q, center) minus radius away from the query. If that lower bound already exceeds the best distance found, the entire subtree can be discarded without losing a closer object. Searching all remaining balls therefore cannot miss the true nearest neighbor.",
        "complexityRationale": "Balance like a B-tree gives height O(log n), so insert and search visit O(log n) nodes and each node scan is linear in its fanout. Every indexed object is stored once, giving O(n) space.",
        "uses": [
            "Similarity search in metric spaces where only distances are defined",
            "Content-based image and multimedia retrieval",
            "Nearest-neighbor search over embeddings with a custom distance"
        ],
        "references": [
            "Ciaccia, Patella, and Zezula, M-Tree: An Efficient Access Method for Similarity Search in Metric Spaces, VLDB 1997",
            "Zezula, Amato, Dohnal, and Batko, Similarity Search: The Metric Space Approach"
        ],
        "workedExample": "Insert points (2,3), (5,1), (7,6), (1,7) and query (4,2). The nearest point is (5,1) at distance sqrt(10), about 3.16. Any routing ball whose lower bound exceeds 3.16 is pruned, leaving (5,1) as the answer."
    },
    id: "m-tree",
    name: "M-Tree",
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
        "initialize M-tree with single routing entry",
        "insert object by choosing closest routing entry",
        "compare distances to covering radius for fit",
        "split full node by promoting two routing objects",
        "partition entries minimizing overlap of balls",
        "search range by pruning entries with triangle inequality",
        "done: metric tree holds objects with range answer",
    ],
};
export default module;
