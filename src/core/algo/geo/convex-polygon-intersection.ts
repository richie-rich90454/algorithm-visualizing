/**
 * convex-polygon-intersection.ts – Sutherland–Hodgman convex intersection.
 * Clip subject by each half-plane of the CCW clip polygon; area by shoelace.
 * Time O(n·m), Space O(n+m).
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
function inside(p: Pt, a: Pt, b: Pt): boolean {
    return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-12;
}
function intersect(s: Pt, e: Pt, a: Pt, b: Pt): Pt {
    const dx = e[0] - s[0],
        dy = e[1] - s[1],
        ex = b[0] - a[0],
        ey = b[1] - a[1];
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-12) return [...e] as Pt;
    const t = ((a[0] - s[0]) * ey - (a[1] - s[1]) * ex) / denom;
    return [s[0] + t * dx, s[1] + t * dy];
}
function clipHalf(subject: Pt[], a: Pt, b: Pt): Pt[] {
    if (subject.length === 0) return [];
    const next: Pt[] = [];
    for (let j = 0; j < subject.length; j += 1) {
        const s = subject[j] as Pt,
            e = subject[(j + 1) % subject.length] as Pt;
        const si = inside(s, a, b),
            ei = inside(e, a, b);
        if (si && ei) next.push(e);
        else if (si) next.push(intersect(s, e, a, b));
        else if (ei) next.push(intersect(s, e, a, b), e);
    }
    return next;
}
function area(poly: Pt[]): number {
    let s = 0;
    for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i] as Pt,
            b = poly[(i + 1) % poly.length] as Pt;
        s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s) / 2;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { a?: Pt[]; b?: Pt[] } | null) ?? {};
    const A: Pt[] = t.a ?? [
        [0, 0],
        [3, 0],
        [3, 3],
        [0, 3],
    ];
    const B: Pt[] = t.b ?? [
        [2, 2],
        [5, 2],
        [2, 5],
    ];
    let step = 0;
    const base = [
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
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: edges.map((e) => ({ ...e })),
        description: `Intersect ${A.length}-gon A with ${B.length}-gon B (Sutherland–Hodgman).`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    if (A.length < 3 || B.length < 3) {
        yield {
            stepNumber: step++,
            entities: base.map((e) => ({ ...e })),
            edges: edges.map((e) => ({ ...e })),
            description: "Degenerate input: both polygons need ≥3 vertices.",
            codeLineNumber: 1,
            layout: "point",
            meta: { area: 0 },
        };
        return;
    }
    let current = B;
    for (let i = 0; i < A.length && step < 11; i += 1) {
        current = clipHalf(current, A[i] as Pt, A[(i + 1) % A.length] as Pt);
        yield {
            stepNumber: step++,
            entities: [
                ...base.map((e) => ({ ...e })),
                ...current.map((p, k) => node(`x-${i}-${k}`, p, "comparing", "")),
            ],
            edges: edges.map((e) => ({ ...e })),
            description: `Clip by A-edge ${i}: ${current.length} vertices survive.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { edge: i, count: current.length },
        };
        if (current.length === 0) break;
    }
    const final = current;
    const ar = area(final);
    const fin = [
        ...base.map((e) => ({ ...e })),
        ...final.map((p, k) => node(`o-${k}`, p, "sorted", `O${k}`)),
    ];
    const oedges = final.map((_, k) => ({
        id: `eo-${k}`,
        sourceId: `o-${k}`,
        targetId: `o-${(k + 1) % final.length}`,
        label: "",
        state: "sorted" as EntityState,
        directed: false,
    }));
    yield {
        stepNumber: step++,
        entities: fin,
        edges: [...edges.map((e) => ({ ...e })), ...oedges],
        description:
            final.length === 0
                ? "Disjoint polygons: empty intersection."
                : `Intersection: ${final.length} vertices, area = ${ar.toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { area: ar, vertices: final.map(([x, y]) => `${x},${y}`) },
    };
}

const module: AlgorithmModule = {
    id: "convex-polygon-intersection",
    name: "Convex Polygon Intersection",
    category: "geometry",
    complexity: { time: "O(n·m)", space: "O(n+m)" },
    defaultInput: {
        a: [
            [0, 0],
            [3, 0],
            [3, 3],
            [0, 3],
        ],
        b: [
            [2, 2],
            [5, 2],
            [2, 5],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
