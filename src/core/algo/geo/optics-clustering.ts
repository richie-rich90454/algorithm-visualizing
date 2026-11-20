/**
 * optics-clustering.ts - OPTICS density clustering order.
 *
 * OPTICS computes an ordering of points in which spatially close points are
 * neighbors in the order. For each point it records a core distance to its
 * minPts-th nearest neighbor and a reachability distance inherited from the
 * point that first reaches it. Points with infinite core distance never grow
 * a cluster, exactly as in DBSCAN.
 *
 *   Time:  O(n^2)
 *   Space: O(n)
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function nodes(pts: Pt[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return pts.map(([x, y], i) => ({
        id: `p-${i}`,
        type: "node" as const,
        label: `p${i}`,
        value: [x, y],
        state: states.get(i) ?? "unvisited",
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index: i, x, y },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[]; eps?: number; minPts?: number } | null) ?? {};
    const pts: Pt[] = task.points ?? [
        [0, 0], [1, 0], [1, 1], [0, 1],
        [6, 6], [7, 6], [7, 7],
        [12, 0],
    ];
    const eps = task.eps ?? 1.6;
    const minPts = task.minPts ?? 2;
    let step = 0;
    const frame = (
        entities: VisualEntity[],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities,
        edges: [],
        description,
        codeLineNumber,
        layout: "point",
        meta: { eps, minPts, points: pts.length, ...meta },
    });

    if (pts.length === 0) {
        yield frame([], "No points, so the reachability order is empty.", 0, { order: [] });
        return;
    }
    const dist = (a: Pt, b: Pt): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const neighbors = pts.map((p, i) =>
        pts.map((q, j) => ({ j, d: dist(p, q) })).filter((e) => e.d <= eps + 1e-9 && e.j !== i),
    );
    const core = neighbors.map((list) => {
        if (list.length + 1 < minPts) return Infinity;
        const sorted = list.map((e) => e.d).sort((x, y) => x - y);
        return sorted[minPts - 2] ?? Infinity;
    });

    yield frame(nodes(pts), `OPTICS with eps=${eps} and minPts=${minPts} on ${pts.length} points.`, 0, {
        core: core.map((c) => (Number.isFinite(c) ? c : "inf")),
    });
    step += 1;

    const reach = new Array<number>(pts.length).fill(Infinity);
    const processed = new Array<boolean>(pts.length).fill(false);
    const order: number[] = [];
    const reachability: number[] = [];
    let guard = 0;
    for (let start = 0; start < pts.length; start += 1) {
        if (processed[start]) continue;
        processed[start] = true;
        order.push(start);
        reachability.push(Infinity);
        const seeds = new Map<number, number>();
        const propagate = (q: number): void => {
            for (const edge of neighbors[q] ?? []) {
                const o = edge.j;
                if (processed[o]) continue;
                const candidate = Math.max(core[q] ?? Infinity, edge.d);
                if (candidate < (reach[o] ?? Infinity)) {
                    reach[o] = candidate;
                    seeds.set(o, candidate);
                }
            }
        };
        propagate(start);
        while (seeds.size > 0 && guard++ < 100000) {
            let best = -1;
            let bestReach = Infinity;
            for (const [idx, value] of seeds) {
                if (value < bestReach || (value === bestReach && idx < best)) {
                    best = idx;
                    bestReach = value;
                }
            }
            if (best < 0) break;
            seeds.delete(best);
            processed[best] = true;
            order.push(best);
            reachability.push(reach[best] ?? Infinity);
            propagate(best);
            if (order.length % Math.max(1, Math.ceil(pts.length / 4)) === 0) {
                const st = new Map<number, EntityState>();
                order.forEach((idx) => st.set(idx, "sorted"));
                for (const idx of seeds.keys()) st.set(idx, "comparing");
                yield frame(
                    nodes(pts, st),
                    `Reachability order so far: [${order.join(", ")}].`,
                    3,
                    { order: [...order], reachability: reachability.map((r) => (Number.isFinite(r) ? r : "inf")) },
                );
                step += 1;
            }
        }
    }
    const palette: EntityState[] = ["sorted", "active", "highlight", "comparing"];
    let cluster = -1;
    let previousReach = Infinity;
    const labels = new Array<number>(pts.length).fill(-1);
    for (let k = 0; k < order.length; k += 1) {
        const r = reachability[k] ?? Infinity;
        if (r > eps + 1e-9 || !Number.isFinite(r)) cluster += 1;
        else if (k > 0 && r > eps + 1e-9 && previousReach <= eps + 1e-9) cluster += 1;
        labels[order[k]!] = cluster;
        previousReach = r;
    }
    const finalStates = new Map<number, EntityState>();
    labels.forEach((c, i) => finalStates.set(i, c < 0 ? "unvisited" : (palette[c % palette.length] as EntityState)));
    yield frame(
        nodes(pts, finalStates),
        `OPTICS order [${order.join(", ")}] yields ${cluster + 1} cluster(s) at eps=${eps}.`,
        5,
        {
            order,
            reachability: reachability.map((r) => (Number.isFinite(r) ? r : "inf")),
            clusters: labels,
            core: core.map((c) => (Number.isFinite(c) ? c : "inf")),
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "OPTICS does not assign clusters directly; it produces an order in which points that belong together appear close together. For each point it computes a core distance, the radius needed to gather enough neighbors, and then records how far away a point is when it is first reached from a dense region. Reading the reachability plot in that order reveals clusters at many density settings at once.",
        invariants: [
            "A point's core distance is the distance to its minPts-th nearest neighbor, or infinity if it is not dense.",
            "A reachability distance is never smaller than the core distance of the point that produced it.",
            "Every point enters the ordering exactly once.",
        ],
        correctness:
            "The priority queue always expands the currently closest reachable point, so the recorded reachability distance is the minimum over all already processed dense points. A point whose reachability stays infinite is not density-reachable from any core and therefore belongs to no cluster, matching DBSCAN. Cutting the reachability order at a threshold eps produces exactly the DBSCAN clusters for that radius, which is the defining property of OPTICS.",
        complexityRationale:
            "Computing neighborhoods scans all n points for each point, costing O(n^2) time, and maintaining the seed set with a linear scan adds at most O(n^2) more. Storing distances, core values, and labels uses O(n) space.",
        uses: [
            "Finding clusters when a single density threshold is not known",
            "Analyzing spatial data with varying density",
            "Visualizing cluster structure with reachability plots",
        ],
        references: [
            "Ankerst, Breunig, Kriegel, and Sander, OPTICS: Ordering Points to Identify the Clustering Structure, SIGMOD 1999",
            "Han, Kamber, and Pei, Data Mining: Concepts and Techniques, Chapter 10",
        ],
        workedExample:
            "With eps = 1.6 and minPts = 2, a tight square near the origin, a smaller square around (6,6), and a lone point at (12,0) are processed. The two squares appear as consecutive low-reachability runs in the order, while the lone point has infinite core distance and infinite reachability, so it forms noise.",
    },
    id: "optics-clustering",
    name: "OPTICS Clustering",
    category: "geometry",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0], [1, 0], [1, 1], [0, 1],
            [6, 6], [7, 6], [7, 7],
            [12, 0],
        ],
        eps: 1.6,
        minPts: 2,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "compute the eps neighborhood and core distance of every point",
        "mark all points as unprocessed with infinite reachability",
        "pick an unprocessed point and seed its neighbors",
        "repeat: expand the seed with the smallest reachability",
        "update neighbors when a shorter reachability is found",
        "continue until no seeds remain for any start point",
        "cut the reachability order at eps to read off clusters",
    ],
};

export default module;
