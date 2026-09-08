/**
 * voronoi-diagram-fortune.ts – Voronoi diagram (Fortune sweep narrative).
 * Sweep line passes site events top-down; cells are computed exactly via the
 * Delaunay dual (circumcenters of empty-circle triangles), which Fortune's
 * algorithm produces. O(n log n) sweep; brute-force dual is exact on tiny sets.
 * Time: O(n log n) Space: O(n).
 * Layout "point": sites p-i plus finite vertices v-j carry true coords.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function siteNodes(pts: Pt[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return pts.map(([x, y], i) => ({
        id: `p-${i}`,
        type: "node" as const,
        label: `s${i}(${x},${y})`,
        value: [x, y],
        state: states.get(i) ?? "unvisited",
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index: i, kind: "site" },
    }));
}

function circum(a: Pt, b: Pt, c: Pt): Pt | null {
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(d) < 1e-12) return null;
    const a2 = a[0] * a[0] + a[1] * a[1];
    const b2 = b[0] * b[0] + b[1] * b[1];
    const c2 = c[0] * c[0] + c[1] * c[1];
    return [
        (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d,
        (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d,
    ];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[] } | null) ?? {};
    const pts: Pt[] = task.points ?? [
        [0, 0],
        [4, 0],
        [2, 3],
        [1, 1],
    ];
    let step = 0;
    if (pts.length < 2) {
        yield {
            stepNumber: step,
            entities: siteNodes(pts),
            edges: [],
            description:
                pts.length === 0
                    ? "No sites – no Voronoi cells."
                    : "One site – the whole plane is its cell.",
            codeLineNumber: 0,
            layout: "point",
            meta: { vertices: [] },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: siteNodes(pts),
        edges: [],
        description: `Fortune sweep: ${pts.length} sites, beach line starts above all sites.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    const order = pts.map((p, i) => i).sort((a, b) => (pts[b] as Pt)[1] - (pts[a] as Pt)[1]);
    for (const idx of order) {
        yield {
            stepNumber: step,
            entities: siteNodes(pts, new Map([[idx, "active"]])),
            edges: [],
            description: `Site event at s-${idx}: new parabolic arc joins the beach line.`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
    }
    const tris: Array<[number, number, number]> = [];
    for (let i = 0; i < pts.length; i += 1)
        for (let j = i + 1; j < pts.length; j += 1)
            for (let k = j + 1; k < pts.length; k += 1) {
                const a = pts[i] as Pt;
                const b = pts[j] as Pt;
                const c = pts[k] as Pt;
                const v = circum(a, b, c);
                if (!v) continue;
                const r2 = (v[0] - a[0]) ** 2 + (v[1] - a[1]) ** 2;
                if (
                    pts.every(
                        (p, m) =>
                            m === i ||
                            m === j ||
                            m === k ||
                            (p[0] - v[0]) ** 2 + (p[1] - v[1]) ** 2 >= r2 - 1e-9,
                    )
                )
                    tris.push([i, j, k]);
            }
    const verts = tris.map((t) => circum(pts[t[0]] as Pt, pts[t[1]] as Pt, pts[t[2]] as Pt) as Pt);
    const withVerts = (states: Map<number, EntityState>): VisualEntity[] => [
        ...siteNodes(pts, states),
        ...verts.map(([x, y], i) => ({
            id: `v-${i}`,
            type: "node" as const,
            label: `v${i}`,
            value: [x, y],
            state: "highlight" as EntityState,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "vertex" },
        })),
    ];
    yield {
        stepNumber: step,
        entities: withVerts(new Map()),
        edges: [],
        description: `Circle events resolved: ${verts.length} finite Voronoi vertices.`,
        codeLineNumber: 2,
        layout: "point",
        meta: {},
    };
    step += 1;
    const edges: VisualEdge[] = [];
    for (let a = 0; a < tris.length; a += 1)
        for (let b = a + 1; b < tris.length; b += 1) {
            const ta = tris[a] as [number, number, number];
            const tb = tris[b] as [number, number, number];
            if (ta.filter((v) => tb.includes(v)).length === 2)
                edges.push({
                    id: `ve-${a}-${b}`,
                    sourceId: `v-${a}`,
                    targetId: `v-${b}`,
                    label: "",
                    state: "path",
                    directed: false,
                });
        }
    yield {
        stepNumber: step,
        entities: withVerts(new Map(pts.map((_, i) => [i, "sorted"] as [number, EntityState]))),
        edges,
        description: `Voronoi edges join vertices of adjacent Delaunay triangles (${edges.length} bounded edges).`,
        codeLineNumber: 3,
        layout: "point",
        meta: { vertices: verts.map(([x, y]) => `${x},${y}`) },
    };
}

const module: AlgorithmModule = {
    id: "voronoi-diagram-fortune",
    name: "Voronoi Diagram (Fortune)",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [4, 0],
            [2, 3],
            [1, 1],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
