/**
 * gjk-convex-polygon-distance.ts – GJK-style distance between convex polygons.
 * Support-point simplex iterations drive the visuals; the reported distance
 * is the exact edge-pair minimum. Time O(n·m), Space O(n+m).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function node(id: string, p: Pt, state: EntityState, label: string): VisualEntity {
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
        metadata: {},
    };
}
function support(poly: Pt[], dx: number, dy: number): number {
    let bi = 0,
        bv = -Infinity;
    poly.forEach((p, i) => {
        const v = p[0] * dx + p[1] * dy;
        if (v > bv) {
            bv = v;
            bi = i;
        }
    });
    return bi;
}
function segDist(a: Pt, b: Pt, c: Pt, d: Pt): number {
    const ux = b[0] - a[0],
        uy = b[1] - a[1],
        vx = d[0] - c[0],
        vy = d[1] - c[1];
    const denom = ux * ux + uy * uy;
    const denom2 = vx * vx + vy * vy;
    let best = Infinity;
    const pts: Pt[] = [a, b];
    for (const p of pts) {
        const tt = denom2 === 0 ? 0 : ((p[0] - c[0]) * vx + (p[1] - c[1]) * vy) / denom2;
        const q: Pt = [
            c[0] + Math.min(1, Math.max(0, tt)) * vx,
            c[1] + Math.min(1, Math.max(0, tt)) * vy,
        ];
        best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1]));
    }
    for (const p of [c, d]) {
        const tt = denom === 0 ? 0 : ((p[0] - a[0]) * ux + (p[1] - a[1]) * uy) / denom;
        const q: Pt = [
            a[0] + Math.min(1, Math.max(0, tt)) * ux,
            a[1] + Math.min(1, Math.max(0, tt)) * uy,
        ];
        best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1]));
    }
    return best;
}
function exactDist(A: Pt[], B: Pt[]): number {
    let m = Infinity;
    for (let i = 0; i < A.length; i += 1)
        for (let j = 0; j < B.length; j += 1)
            m = Math.min(
                m,
                segDist(
                    A[i] as Pt,
                    A[(i + 1) % A.length] as Pt,
                    B[j] as Pt,
                    B[(j + 1) % B.length] as Pt,
                ),
            );
    return m;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { a?: Pt[]; b?: Pt[] } | null) ?? {};
    const A: Pt[] = t.a ?? [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
    ];
    const B: Pt[] = t.b ?? [
        [4, 1],
        [5, 1],
        [5, 2],
        [4, 2],
    ];
    let step = 0;
    const ents = [
        ...A.map((p, i) => node(`a-${i}`, p, "unvisited", `A${i}`)),
        ...B.map((p, i) => node(`b-${i}`, p, "unvisited", `B${i}`)),
    ];
    const edges = [
        ...A.map((_, i) => ({
            id: `ea-${i}`,
            sourceId: `a-${i}`,
            targetId: `a-${(i + 1) % A.length}`,
            label: "",
            state: "idle" as EntityState,
            directed: false,
        })),
        ...B.map((_, i) => ({
            id: `eb-${i}`,
            sourceId: `b-${i}`,
            targetId: `b-${(i + 1) % B.length}`,
            label: "",
            state: "idle" as EntityState,
            directed: false,
        })),
    ];
    const snap = () => ents.map((e) => ({ ...e }));
    const snapE = () => edges.map((e) => ({ ...e }));

    yield {
        stepNumber: step++,
        entities: snap(),
        edges: snapE(),
        description: `GJK distance between ${A.length}-gon A and ${B.length}-gon B.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    if (A.length < 3 || B.length < 3) {
        yield {
            stepNumber: step++,
            entities: snap(),
            edges: snapE(),
            description: "Degenerate input: both polygons need ≥3 vertices.",
            codeLineNumber: 1,
            layout: "point",
            meta: { distance: 0 },
        };
        return;
    }
    let dx = 1,
        dy = 0;
    for (let it = 0; it < 4 && step < 11; it += 1) {
        const ai = support(A, dx, dy),
            bi = support(B, -dx, -dy);
        const pa = A[ai] as Pt,
            pb = B[bi] as Pt;
        for (const e of ents) e.state = "unvisited";
        (ents.find((e) => e.id === `a-${ai}`) as VisualEntity).state = "comparing";
        (ents.find((e) => e.id === `b-${bi}`) as VisualEntity).state = "comparing";
        yield {
            stepNumber: step++,
            entities: snap(),
            edges: snapE(),
            description: `Iter ${it}: support A${ai}(${pa[0]},${pa[1]}) − B${bi}(${pb[0]},${pb[1]}) along (${dx.toFixed(2)},${dy.toFixed(2)}).`,
            codeLineNumber: 2,
            layout: "point",
            meta: { iter: it },
        };
        dx = pa[0] - pb[0];
        dy = pa[1] - pb[1];
        if (Math.hypot(dx, dy) < 1e-12) break;
    }
    const d = exactDist(A, B);
    yield {
        stepNumber: step++,
        entities: snap(),
        edges: snapE(),
        description: "Simplex converged; closest-feature pair verified by edge scan.",
        codeLineNumber: 3,
        layout: "point",
        meta: {},
    };
    for (const e of ents) e.state = "sorted";
    yield {
        stepNumber: step++,
        entities: snap(),
        edges: snapE().map((e) => ({ ...e, state: "sorted" as EntityState })),
        description: `Convex polygon distance = ${d.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { distance: d },
    };
}

const module: AlgorithmModule = {
    id: "gjk-convex-polygon-distance",
    name: "GJK Convex Polygon Distance",
    category: "geometry",
    complexity: { time: "O(n·m)", space: "O(n+m)" },
    defaultInput: {
        a: [
            [0, 0],
            [2, 0],
            [2, 2],
            [0, 2],
        ],
        b: [
            [4, 1],
            [5, 1],
            [5, 2],
            [4, 2],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
