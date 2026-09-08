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
            codeLineNumber: 0,
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
        codeLineNumber: 0,
        layout: "point",
        meta: {},
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
                codeLineNumber: 1,
                layout: "point",
                meta: {},
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
            codeLineNumber: 2,
            layout: "point",
            meta: {},
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
        codeLineNumber: 3,
        layout: "point",
        meta: { clusters: final },
    };
}

const module: AlgorithmModule = {
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
};

export default module;
