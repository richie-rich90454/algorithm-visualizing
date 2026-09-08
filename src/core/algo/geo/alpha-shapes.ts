/**
 * alpha-shapes.ts – Alpha shapes (alpha complex of Delaunay).
 * Builds Delaunay triangles via empty-circle tests, then keeps simplices
 * whose circumradius ≤ α (edges: length/2 ≤ α). O(n^4) brute force, exact.
 * Layout "point": sites carry true coords; surviving edges are frame edges.
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

function circumR(a: Pt, b: Pt, c: Pt): number | null {
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(d) < 1e-12) return null;
    const a2 = a[0] * a[0] + a[1] * a[1];
    const b2 = b[0] * b[0] + b[1] * b[1];
    const c2 = c[0] * c[0] + c[1] * c[1];
    const x = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
    const y = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
    return Math.hypot(x - a[0], y - a[1]);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[]; alpha?: number } | null) ?? {};
    const pts: Pt[] = task.points ?? [
        [0, 0],
        [2, 0],
        [1, 1],
        [3, 1],
        [0, 2],
        [2, 2],
    ];
    const alpha = task.alpha ?? 1.5;
    let step = 0;
    if (pts.length < 2) {
        yield {
            stepNumber: step,
            entities: nodes(pts),
            edges: [],
            description:
                pts.length === 0
                    ? "No points – empty alpha shape."
                    : "One point – the alpha shape is the point itself.",
            codeLineNumber: 0,
            layout: "point",
            meta: { edges: [] },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: nodes(pts),
        edges: [],
        description: `Alpha shape with α=${alpha} on ${pts.length} points – Delaunay first.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    const tris: Array<[number, number, number]> = [];
    for (let i = 0; i < pts.length; i += 1)
        for (let j = i + 1; j < pts.length; j += 1)
            for (let k = j + 1; k < pts.length; k += 1) {
                const a = pts[i] as Pt;
                const b = pts[j] as Pt;
                const c = pts[k] as Pt;
                const r = circumR(a, b, c);
                if (r === null) continue;
                const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
                const a2 = a[0] * a[0] + a[1] * a[1];
                const b2 = b[0] * b[0] + b[1] * b[1];
                const c2 = c[0] * c[0] + c[1] * c[1];
                const ux = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
                const uy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
                if (
                    pts.every(
                        (p, m) =>
                            m === i ||
                            m === j ||
                            m === k ||
                            (p[0] - ux) ** 2 + (p[1] - uy) ** 2 >= r * r - 1e-9,
                    )
                )
                    tris.push([i, j, k]);
            }
    const edgeSet = new Map<string, [number, number]>();
    for (const [a, b, c] of tris)
        for (const [u, v] of [
            [a, b],
            [b, c],
            [c, a],
        ] as Array<[number, number]>) {
            const p = pts[u] as Pt;
            const q = pts[v] as Pt;
            if (Math.hypot(p[0] - q[0], p[1] - q[1]) / 2 <= alpha + 1e-9)
                edgeSet.set(`${Math.min(u, v)}-${Math.max(u, v)}`, [u, v]);
        }
    const kept = [...edgeSet.values()];
    const toEdges = (list: Array<[number, number]>): VisualEdge[] =>
        list.map(([u, v]) => ({
            id: `e-${u}-${v}`,
            sourceId: `p-${u}`,
            targetId: `p-${v}`,
            label: "",
            state: "path",
            directed: false,
        }));
    const shown = kept.slice(0, 4);
    for (let t = 0; t < shown.length; t += 1) {
        const [u, v] = shown[t] as [number, number];
        yield {
            stepNumber: step,
            entities: nodes(
                pts,
                new Map([
                    [u, "active"],
                    [v, "active"],
                ]),
            ),
            edges: toEdges(shown.slice(0, t + 1)),
            description: `Edge ${u}–${v} kept (half-length ≤ α=${alpha}).`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
    }
    for (const [i, j, k] of tris.slice(0, 2)) {
        const r = circumR(pts[i] as Pt, pts[j] as Pt, pts[k] as Pt) as number;
        yield {
            stepNumber: step,
            entities: nodes(
                pts,
                new Map([
                    [i, "sorted"],
                    [j, "sorted"],
                    [k, "sorted"],
                ]),
            ),
            edges: toEdges(kept),
            description: `Triangle (${i},${j},${k}): circumradius=${r.toFixed(2)} ${r <= alpha + 1e-9 ? "≤ α, kept" : "> α, dropped"}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: {},
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: nodes(pts, new Map(pts.map((_, i) => [i, "sorted"] as [number, EntityState]))),
        edges: toEdges(kept),
        description: `Alpha shape complete: ${kept.length} edges, ${tris.filter(([i, j, k]) => (circumR(pts[i] as Pt, pts[j] as Pt, pts[k] as Pt) as number) <= alpha + 1e-9).length} triangles.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { edges: kept.map(([u, v]) => `${u}-${v}`) },
    };
}

const module: AlgorithmModule = {
    id: "alpha-shapes",
    name: "Alpha Shapes",
    category: "geometry",
    complexity: { time: "O(n⁴) brute force", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [2, 0],
            [1, 1],
            [3, 1],
            [0, 2],
            [2, 2],
        ],
        alpha: 1.5,
    },
    visualType: "graph",
    run,
};

export default module;
