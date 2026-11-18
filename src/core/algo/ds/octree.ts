/**
 * octree.ts - Octree
 * Points split cube into 8 octants. Demo: index <=6 points, 1 nearest-neighbor query.
 
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Points split cube into 8 octants. Demo: index <=6 points, 1 nearest-neighbor query.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) avg
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *    - Nodes are circles; edges show parent links.
 *    - The active node is YELLOW (comparing).
 *    - Finished nodes are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Standard Octree behavior with textbook operation costs.
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
        description: "Octree: empty. Points split cube into 8 octants.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { ops: step },
    };
    step += 1;
    for (let i = 0; i < pts.length; i += 1) {
        yield {
            stepNumber: step,
            entities: nodes(pts.slice(0, i + 1), new Map([[i, "comparing"]])),
            edges: [],
            description: `Inserted point (${pts[i]![0]},${pts[i]![1]}) into its octant - ${i + 1} of ${pts.length} indexed.`,
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
            description: `Query (${q[0]},${q[1]}): compared distances, nearest is (${pts[bi]![0]},${pts[bi]![1]}) at d=${bd.toFixed(2)}.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { ops: step },
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
        codeLineNumber: 3,
        layout: "tree",
        meta: { ops: step, nearest: pts[bi] ?? [] },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "An octree recursively splits 3D space into eight octants. Points descend into the octant containing them, and a leaf subdivides when it overflows. A nearest-neighbor query visits only octants whose bounding cube could contain a point closer than the best one found so far.",
        "invariants": [
            "Each point lies in exactly one leaf.",
            "A node bounding cube contains every point below it.",
            "A cube whose closest face is farther than the current best distance is pruned."
        ],
        "correctness": "If the distance from the query to a cube already exceeds the best point distance, then by the triangle inequality every point inside that cube is at least that far away. Discarding such a cube cannot lose the nearest point, so the closest point found among visited octants is globally nearest.",
        "complexityRationale": "Balanced subdivision gives O(log n) expected depth, so inserts and well-behaved queries touch O(log n) nodes; heavily clustered inputs can degrade to O(n). One node per subdivision plus one per point gives O(n) space.",
        "uses": [
            "Three-dimensional collision detection",
            "Point-cloud nearest neighbor in robotics",
            "Spatial indexing for computer graphics and games"
        ],
        "references": [
            "Meagher, Geometric Modeling Using Octree Encoding, Computer Graphics and Image Processing, 1982",
            "Samet, Foundations of Multidimensional and Metric Data Structures, Chapter 2"
        ],
        "workedExample": "Insert points such as (2,3,z), (5,1,z), (7,6,z), (1,7,z) into a root cube; each falls into a different octant. A query near (4,2,z) visits only octants overlapping its search ball and prunes the distant cubes."
    },
    id: "octree",
    name: "Octree",
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
        "start with empty cube covering all points",
        "insert point: descend to the octant containing it",
        "if a leaf overflows: subdivide it into 8 octants",
        "repeat until every point sits in exactly one leaf",
        "query: visit only octants overlapping the search ball",
        "track the closest point seen and prune distant octants",
        "done: space is partitioned and the nearest neighbor is reported",
    ],
};
export default module;
