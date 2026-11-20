/**
 * birch-clustering.ts - Balanced Iterative Reducing and Clustering using
 * Hierarchies, in its core clustering-feature form.
 *
 * Each subcluster stores a CF triple (N, LS, SS) so it can be updated by one
 * addition per incoming point without revisiting older points. A point joins
 * the nearest subcluster whose centroid is within the threshold; otherwise a
 * new subcluster starts. Subclusters are packed into leaves of bounded size,
 * which is the leaf level of the BIRCH CF tree.
 *
 * Time: O(n * m) for n points and m subclusters. Space: O(n + m).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

interface CF {
    n: number;
    sx: number;
    sy: number;
    sxx: number;
    syy: number;
}

function centroid(cf: CF): Pt {
    return cf.n === 0 ? [0, 0] : [cf.sx / cf.n, cf.sy / cf.n];
}

function node(id: string, p: Pt, state: EntityState, label: string, cluster: number): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: [p[0], p[1]],
        state,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { cluster },
    };
}

const CLUSTER_STATES: EntityState[] = ["sorted", "visited", "active", "highlight", "path", "comparing"];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[]; threshold?: number; branchingFactor?: number } | null) ?? {};
    const points: Pt[] = task.points ?? [
        [0, 0],
        [0.2, 0.1],
        [0.1, -0.2],
        [5, 5],
        [5.2, 4.9],
        [4.9, 5.1],
    ];
    const T = typeof task.threshold === "number" && task.threshold > 0 ? task.threshold : 0.6;
    const B = typeof task.branchingFactor === "number" ? Math.max(2, Math.floor(task.branchingFactor)) : 3;

    if (points.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "No points: the CF tree stays empty.",
            codeLineNumber: 0,
            layout: "point",
            meta: { clusterN: [], clusterCX: [], clusterCY: [], assignments: [], leafCount: 0, splits: 0 },
        };
        return;
    }

    const cf: CF[] = [];
    let splits = 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: points.map((p, i) => node(`p-${i}`, p, "unvisited", String(i), -1)),
        edges: [],
        description: `Inserting ${points.length} points into a CF tree with threshold ${T}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { leafCount: 0, splits: 0, inserted: 0 },
    };
    step += 1;

    for (let i = 0; i < points.length; i += 1) {
        const p = points[i] as Pt;
        let bestIndex = -1;
        let bestDistance = Infinity;
        for (let j = 0; j < cf.length; j += 1) {
            const c = centroid(cf[j] as CF);
            const d = Math.hypot(p[0] - c[0], p[1] - c[1]);
            if (d < bestDistance) {
                bestDistance = d;
                bestIndex = j;
            }
        }
        let newSubcluster = false;
        if (bestIndex >= 0 && bestDistance <= T) {
            const target = cf[bestIndex] as CF;
            target.n += 1;
            target.sx += p[0];
            target.sy += p[1];
            target.sxx += p[0] * p[0];
            target.syy += p[1] * p[1];
        } else {
            cf.push({ n: 1, sx: p[0], sy: p[1], sxx: p[0] * p[0], syy: p[1] * p[1] });
            newSubcluster = true;
            if (cf.length % B === 1 && cf.length > B) splits += 1;
        }
        const entities: VisualEntity[] = points.map((q, k) =>
            node(`p-${k}`, q, k === i ? "active" : "unvisited", String(k), -1),
        );
        cf.forEach((entry, j) => {
            const c = centroid(entry);
            entities.push(node(`c-${j}`, c, j === bestIndex && !newSubcluster ? "highlight" : "sorted", `c${j}`, j));
        });
        yield {
            stepNumber: step,
            entities,
            edges: [],
            description: `Inserted point ${i}: ${newSubcluster ? "started subcluster " + (cf.length - 1) : "absorbed into subcluster " + bestIndex}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { inserted: i + 1, subclusters: cf.length, splits, threshold: T },
        };
        step += 1;
    }

    const assignments: number[] = points.map((p) => {
        let best = 0;
        let bestD = Infinity;
        cf.forEach((entry, j) => {
            const c = centroid(entry);
            const d = Math.hypot(p[0] - c[0], p[1] - c[1]);
            if (d < bestD) {
                bestD = d;
                best = j;
            }
        });
        return best;
    });
    const clusterN = cf.map((entry) => entry.n);
    const clusterCX = cf.map((entry) => centroid(entry)[0]);
    const clusterCY = cf.map((entry) => centroid(entry)[1]);
    const clusterSS = cf.map((entry) => entry.sxx + entry.syy);
    const leafCount = Math.max(1, Math.ceil(cf.length / B));

    const entities: VisualEntity[] = points.map((p, i) =>
        node(`p-${i}`, p, CLUSTER_STATES[assignments[i]! % CLUSTER_STATES.length] as EntityState, String(i), assignments[i] as number),
    );
    cf.forEach((entry, j) => {
        const c = centroid(entry);
        entities.push(node(`c-${j}`, c, "pivot", `c${j}`, j));
    });
    const edges = points.map((_, i) => ({
        id: `assign-${i}`,
        sourceId: `p-${i}`,
        targetId: `c-${assignments[i]}`,
        label: "",
        state: "path" as EntityState,
        directed: false,
    }));

    yield {
        stepNumber: step,
        entities,
        edges,
        description: `Done: ${cf.length} leaf subclusters arranged in ${leafCount} leaf node(s).`,
        codeLineNumber: 6,
        layout: "point",
        meta: {
            clusterN,
            clusterCX,
            clusterCY,
            clusterSS,
            assignments,
            subclusters: cf.length,
            leafCount,
            splits,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "BIRCH summarizes a cluster by three numbers: how many points it has and the sum and sum of squares of their coordinates. Those summaries let it decide in constant time whether a new point fits. Points that do not fit start a new summary, and summaries are packed into leaves of a height-balanced tree.",
        invariants: [
            "A clustering feature is additive: merging two summaries is just adding their triples.",
            "A point only joins a subcluster whose centroid is within the radius threshold.",
            "Each leaf holds at most the branching factor number of subclusters before splitting.",
        ],
        correctness:
            "Because a CF triple stores exact counts and sums, the centroid computed from it equals the arithmetic mean of the points it absorbed. Assigning each point to the nearest final centroid therefore gives a stable partition: no point would rather belong to another subcluster than the one it is in. Leaf splitting only regroups summaries and never changes their contents, so the final subclusters are exactly the CFs produced by the insertion pass.",
        complexityRationale:
            "Each insertion scans the current m subclusters once, so n insertions cost O(n * m), typically linear in practice because m stays small. Storing one constant-size CF per subcluster plus the point list uses O(n + m) space.",
        uses: [
            "Clustering very large datasets that do not fit in memory",
            "Pre-clustering before a slower algorithm such as k-means",
            "Outlier detection via points that never join a dense subcluster",
        ],
        references: [
            "Zhang, Ramakrishnan, and Livny, BIRCH: An Efficient Data Clustering Method, SIGMOD 1996",
            "Han, Kamber, and Pei, Data Mining: Concepts and Techniques, Chapter 10",
        ],
        workedExample:
            "With threshold 0.6 and two tight groups near (0,0) and (5,5), the first three points grow one subcluster and the far point starts a second. Each later point joins whichever centroid is within 0.6, ending with two CFs whose centroids are the group means.",
    },
    id: "birch-clustering",
    name: "BIRCH Clustering",
    category: "geometry",
    complexity: { time: "O(n * m)", space: "O(n + m)" },
    defaultInput: {
        points: [
            [0, 0],
            [0.2, 0.1],
            [0.1, -0.2],
            [5, 5],
            [5.2, 4.9],
            [4.9, 5.1],
        ],
        threshold: 0.6,
        branchingFactor: 3,
    },
    visualType: "point",
    run,
    pseudocode: [
        "start with an empty CF tree of subclusters",
        "for each incoming point",
        "find the subcluster with the nearest centroid",
        "if it is within the threshold, update its CF triple",
        "otherwise create a new subcluster in a leaf",
        "split a full leaf when its branching factor is exceeded",
        "compute centroids from the final CF triples",
        "assign each point to its nearest centroid",
        "done: return the leaf subclusters",
    ],
};

export default module;
