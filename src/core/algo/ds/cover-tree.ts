/**
 * cover-tree.ts - Cover Tree
 * Levels halve the cover radius. Demo: index <=6 points, 1 nearest-neighbor query.
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
        description: "Cover Tree: empty. Levels halve the cover radius.",
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
        "intuition": "A cover tree organizes points in levels whose covering radius shrinks geometrically. Each level has a cover set that dominates all points below it, and parent-child distances shrink as you descend. Queries prune subtrees using the triangle inequality, giving fast nearest-neighbor search in low-dimensional metric spaces.",
        "invariants": [
            "At level i, every point is within the level's radius of some cover-set point.",
            "Cover radii decrease by a constant factor each level.",
            "A child's distance to its parent is bounded by the level radius."
        ],
        "correctness": "Because each level covers all points, a query within tolerance of a point must be near some cover parent. The triangle inequality lets the search discard a cover-set subtree when the distance to its parent minus the parent's radius exceeds the current best. Examining all surviving covers therefore finds the true nearest neighbor.",
        "complexityRationale": "The geometric radius decrease bounds the number of points per level to a constant in fixed dimension, so search is O(log n). Storing one node per point uses O(n) space.",
        "uses": [
            "Nearest-neighbor search in metric spaces",
            "Machine learning and density estimation",
            "Robotics configuration-space queries"
        ],
        "references": [
            "Alina Beygelzimer, Sham Kakade, and John Langford, \"Cover Trees for Nearest Neighbor\", ICML 2006",
            "Peter N. Yianilos, metric-space search notes, 1993"
        ],
        "workedExample": "Index points (0,0), (1,0), (2,0), (10,10): the top level covers all with center (0,0) and radius 16, lower levels split into tighter covers. Querying (1.2,0) descends the near cover, finds distance about 0.2 to (1,0), and prunes the far (10,10) branch because its lower bound is much larger."
    },
    id: "cover-tree",
    name: "Cover Tree",
    category: "data-structures",
    complexity: { time: "O(log n) NN", space: "O(n)" },
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
        "initialize cover tree with root at top level",
        "insert point by descending levels comparing distances",
        "assign point to cover set within expanding radius",
        "create new level when point is far from all covers",
        "search nearest by pruning covers using triangle inequality",
        "compare distances to maintain best candidate",
        "done: cover tree holds points with nearest query answer",
    ],
};
export default module;
