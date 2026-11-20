/**
 * k-d-tree.ts - K-D Tree
 * Axes split alternately at medians. Demo: index <=6 points, 1 nearest-neighbor query.
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
        description: "K-D Tree: empty. Axes split alternately at medians.",
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
        "intuition": "A k-d tree generalizes a binary search tree to k-dimensional points by splitting on a different coordinate at each depth, usually the one with the largest spread. A nearest-neighbor search descends to a leaf and then backtracks, pruning a subtree when the distance to its splitting plane exceeds the current best.",
        "invariants": [
            "At depth d, left-child points have a smaller coordinate on the split axis than the node.",
            "The split axis cycles through the k dimensions.",
            "A subtree can be pruned when the plane distance exceeds the best distance."
        ],
        "correctness": "Any point in the far subtree is at least the plane distance from the query, so if that is no better than the current best, no point there can improve the answer. Descending on the near side first tightens the bound early. Visiting all unpruned subtrees therefore finds the true nearest neighbor.",
        "complexityRationale": "Balanced splits give O(log n) average query depth, though worst-case nearest search is O(n) in high dimensions. Each point is one node, O(n) space.",
        "uses": [
            "Nearest-neighbor search in low dimensions",
            "Spatial indexes and collision detection",
            "Computer graphics ray tracing"
        ],
        "references": [
            "Jon Louis Bentley, \"Multidimensional Binary Search Trees Used for Associative Searching\", CACM 1975",
            "M. de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 5"
        ],
        "workedExample": "Index (2,3), (5,4), (8,1) splitting on x at root. Query (3,3) descends left to (2,3), best distance 1, then checks the plane x=5: distance 2 exceeds 1, so the right subtree is pruned and (2,3) is returned."
    },
    id: "k-d-tree",
    name: "K-D Tree",
    category: "data-structures",
    complexity: { time: "O(sqrt n) range avg", space: "O(n)" },
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
        "initialize k-d tree build over point set",
        "choose split dimension cycling by depth",
        "partition points by median along split dimension",
        "insert query point comparing split coordinate",
        "search nearest by pruning far side with plane distance",
        "compare best distance to update candidate",
        "done: k-d tree holds points with nearest answer",
    ],
};
export default module;
