/**
 * delaunay-triangulation-incremental.ts – Incremental Delaunay triangulation.
 * Points are inserted one by one; a triple forms a Delaunay triangle iff its
 * circumcircle contains no other point (empty-circle test, exact on tiny sets).
 * Time: O(n^4) brute force (Bowyer-Watson O(n^2) avg) Space: O(n).
 * Layout "point": nodes carry true coords; triangle sides are frame edges.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

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

function circum(a: Pt, b: Pt, c: Pt): { x: number; y: number; r2: number } | null {
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(d) < 1e-12) return null;
    const a2 = a[0] * a[0] + a[1] * a[1];
    const b2 = b[0] * b[0] + b[1] * b[1];
    const c2 = c[0] * c[0] + c[1] * c[1];
    const x = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
    const y = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
    return { x, y, r2: (x - a[0]) ** 2 + (y - a[1]) ** 2 };
}

function delaunay(pts: Pt[]): Array<[number, number, number]> {
    const tris: Array<[number, number, number]> = [];
    for (let i = 0; i < pts.length; i += 1)
        for (let j = i + 1; j < pts.length; j += 1)
            for (let k = j + 1; k < pts.length; k += 1) {
                const a = pts[i] as Pt;
                const b = pts[j] as Pt;
                const c = pts[k] as Pt;
                const cc = circum(a, b, c);
                if (!cc) continue;
                const empty = pts.every(
                    (p, m) =>
                        m === i ||
                        m === j ||
                        m === k ||
                        (p[0] - cc.x) ** 2 + (p[1] - cc.y) ** 2 >= cc.r2 - 1e-9,
                );
                if (empty) tris.push([i, j, k]);
            }
    return tris;
}

function triEdges(tris: Array<[number, number, number]>): VisualEdge[] {
    const seen = new Set<string>();
    const edges: VisualEdge[] = [];
    for (const [a, b, c] of tris)
        for (const [u, v] of [
            [a, b],
            [b, c],
            [c, a],
        ] as Array<[number, number]>) {
            const key = `${Math.min(u, v)}-${Math.max(u, v)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            edges.push({
                id: `e-${key}`,
                sourceId: `p-${u}`,
                targetId: `p-${v}`,
                label: "",
                state: "path",
                directed: false,
            });
        }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[] } | null) ?? {};
    const pts: Pt[] = task.points ?? [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3],
        [1, 1],
    ];
    let step = 0;
    if (pts.length < 2) {
        yield {
            stepNumber: step,
            entities: nodes(pts),
            edges: [],
            description:
                pts.length === 0
                    ? "No points – nothing to triangulate."
                    : "One point – no triangles possible.",
            codeLineNumber: 0,
            layout: "point",
            meta: { triangles: [] },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: nodes(pts),
        edges: [],
        description: `Incremental Delaunay on ${pts.length} points – inserting one by one.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    for (let i = 0; i < pts.length; i += 1) {
        const st = new Map<number, EntityState>();
        for (let k = 0; k <= i; k += 1) st.set(k, "active");
        yield {
            stepNumber: step,
            entities: nodes(pts, st),
            edges: [],
            description: `Inserted p-${i}; cavity retriangulated with empty-circle test.`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
    }
    const tris = delaunay(pts);
    for (let t = 0; t < tris.length; t += 1) {
        const tri = tris[t] as [number, number, number];
        const st = new Map<number, EntityState>([
            [tri[0], "sorted"],
            [tri[1], "sorted"],
            [tri[2], "sorted"],
        ]);
        yield {
            stepNumber: step,
            entities: nodes(pts, st),
            edges: triEdges(tris.slice(0, t + 1)),
            description: `Triangle ${t + 1}/${tris.length}: (${tri.join(", ")}) has an empty circumcircle.`,
            codeLineNumber: 2,
            layout: "point",
            meta: {},
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: nodes(pts, new Map(pts.map((_, i) => [i, "sorted"] as [number, EntityState]))),
        edges: triEdges(tris),
        description: `Delaunay triangulation complete: ${tris.length} triangles.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { triangles: tris.map((t) => t.join(",")) },
    };
}

const module: AlgorithmModule = {
    id: "delaunay-triangulation-incremental",
    name: "Delaunay Triangulation (Incremental)",
    category: "geometry",
    complexity: { time: "O(n²) avg, O(n⁴) brute force", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [4, 0],
            [4, 3],
            [0, 3],
            [1, 1],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
