/**
 * dbscan-clustering.ts – DBSCAN density clustering.
 * Visits each point; core points (≥minPts within eps) absorb their
 * neighborhood via BFS, others become border or noise. O(n²), exact.
 * Layout "point": points carry true coords; state shows cluster/noise.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function nodes(pts: Pt[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return pts.map(([x, y], i) => ({
        id: `p-${i}`,
        type: "node" as const,
        label: `p${i}(${x},${y})`,
        value: [x, y],
        state: states.get(i) ?? "unvisited",
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[]; eps?: number; minPts?: number } | null) ?? {};
    const pts: Pt[] = task.points ?? [
        [0, 0],
        [1, 0],
        [0, 1],
        [5, 5],
        [6, 5],
        [9, 9],
    ];
    const eps = task.eps ?? 1.5;
    const minPts = task.minPts ?? 2;
    let step = 0;
    if (pts.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "No points – no clusters.",
            codeLineNumber: 0,
            layout: "point",
            meta: { clusters: [] },
        };
        return;
    }
    if (pts.length === 1) {
        yield {
            stepNumber: step,
            entities: nodes(pts),
            edges: [],
            description: "One point – noise (needs minPts=2).",
            codeLineNumber: 1,
            layout: "point",
            meta: { clusters: [-1] },
        };
        return;
    }
    const dist = (a: Pt, b: Pt): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const region = (i: number): number[] =>
        pts.map((_, j) => j).filter((j) => dist(pts[i] as Pt, pts[j] as Pt) <= eps + 1e-9);
    const label = new Array<number>(pts.length).fill(-1);
    const palette: EntityState[] = ["sorted", "active", "highlight", "comparing"];
    const toStates = (): Map<number, EntityState> => {
        const m = new Map<number, EntityState>();
        label.forEach((c, i) => {
            if (c >= 0) m.set(i, palette[c % palette.length] as EntityState);
            else if (c === -2) m.set(i, "swapped");
        });
        return m;
    };
    yield {
        stepNumber: step,
        entities: nodes(pts),
        edges: [],
        description: `DBSCAN: eps=${eps}, minPts=${minPts} on ${pts.length} points.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { eps, minPts, points: pts.length },
    };
    step += 1;
    let cluster = 0;
    for (let i = 0; i < pts.length; i += 1) {
        if (label[i] !== -1) continue;
        const seeds = region(i);
        if (seeds.length < minPts) {
            label[i] = -2;
            yield {
                stepNumber: step,
                entities: nodes(pts, toStates()),
                edges: [],
                description: `p-${i} has ${seeds.length} neighbors – noise for now.`,
                codeLineNumber: 3,
                layout: "point",
                meta: { point: i, neighbors: seeds.length },
            };
            step += 1;
            continue;
        }
        label[i] = cluster;
        const queue = seeds.filter((j) => j !== i);
        while (queue.length > 0) {
            const j = queue.shift() as number;
            if (label[j] === -2) label[j] = cluster;
            if (label[j] !== -1) continue;
            label[j] = cluster;
            const more = region(j);
            if (more.length >= minPts)
                for (const m of more) if (label[m] === -1 || label[m] === -2) queue.push(m);
        }
        yield {
            stepNumber: step,
            entities: nodes(pts, toStates()),
            edges: [],
            description: `p-${i} is core (${seeds.length} neighbors) – cluster ${cluster} expanded.`,
            codeLineNumber: 4,
            layout: "point",
            meta: { point: i, cluster },
        };
        step += 1;
        cluster += 1;
    }
    const final = label.map((c) => (c === -2 ? -1 : c));
    const st = new Map<number, EntityState>();
    final.forEach((c, i) =>
        st.set(i, c >= 0 ? (palette[c % palette.length] as EntityState) : "swapped"),
    );
    yield {
        stepNumber: step,
        entities: nodes(pts, st),
        edges: [],
        description: `DBSCAN complete: ${cluster} clusters, noise={${
            final
                .map((c, i) => (c < 0 ? i : null))
                .filter((v) => v !== null)
                .join(", ") || "none"
        }}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { clusters: final },
    };
}

const module: AlgorithmModule = {
    education: {
        "intuition": "DBSCAN groups together points that are densely packed and marks sparse points as noise. A core point has at least minPts neighbors within radius eps; it absorbs its reachable neighbors by a flood fill, while points that are near a core but not core themselves become border points and isolated points become noise.",
        "invariants": [
            "Every point is eventually labeled core, border, or noise exactly once.",
            "A cluster is a maximal set of points connected through chains of core points.",
            "No point within eps of a core point is left as noise."
        ],
        "correctness": "A point with enough neighbors is core by definition, so the count test is exact. Flood filling from an unvisited core point reaches precisely every point density-connected to it, because each step follows an eps-neighborhood of a core point. Marking reachable non-core points as border and everything else noise respects the DBSCAN definitions, so the discovered clusters are exactly the density-connected components.",
        "complexityRationale": "The straightforward version scans all n points to find each point's eps-neighborhood, costing O(n^2) time. Storing labels and neighbor lists uses O(n) space; spatial indexes can reduce the search in production.",
        "uses": [
            "Clustering GPS traces and location data",
            "Detecting outliers or anomalies in sensor readings",
            "Finding dense regions in spatial databases"
        ],
        "references": [
            "Ester, Kriegel, Sander, and Xu, A Density-Based Algorithm for Discovering Clusters, KDD 1996",
            "Han, Kamber, and Pei, Data Mining: Concepts and Techniques, Chapter 10"
        ],
        "workedExample": "Points (0,0), (1,0), (2,0), (3,0), (10,0) with eps = 1.5 and minPts = 3. The middle two points each see three points including themselves and are core; the endpoints are border and the far point at (10,0) is noise. Flood fill from (1,0) absorbs the endpoints, producing one cluster of four points."
    },

    id: "dbscan-clustering",
    name: "DBSCAN Clustering",
    category: "geometry",
    complexity: { time: "O(n²)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [1, 0],
            [0, 1],
            [5, 5],
            [6, 5],
            [9, 9],
        ],
        eps: 1.5,
        minPts: 2,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start from all points with radius eps and minPts",
        "count neighbors inside eps for each unvisited point",
        "label sparse points as noise for now",
        "grow a new cluster from each dense core point",
        "absorb every density-reachable neighbor into the cluster",
        "done: clusters plus noise label the whole set",
    ],
};

export default module;
