/**
 * point-in-convex-polygon-binary.ts – O(log n) fan-search point test.
 * Wedge check at p0, binary search over fan sectors, final point-in-triangle.
 * CCW convex polygon assumed. Space O(1).
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
function cross(o: Pt, a: Pt, b: Pt): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}
function inTriangle(p: Pt, a: Pt, b: Pt, c: Pt): boolean {
    const d1 = cross(p, a, b),
        d2 = cross(p, b, c),
        d3 = cross(p, c, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
function locate(poly: Pt[], q: Pt): { inside: boolean; sector?: [number, number, number] } {
    const n = poly.length;
    if (
        cross(poly[0] as Pt, poly[1] as Pt, q) < 0 ||
        cross(poly[0] as Pt, poly[n - 1] as Pt, q) > 0
    )
        return { inside: false };
    let lo = 1,
        hi = n - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cross(poly[0] as Pt, poly[mid] as Pt, q) >= 0) lo = mid;
        else hi = mid;
    }
    const a = poly[0] as Pt,
        b = poly[lo] as Pt,
        c = poly[(lo + 1) % n] as Pt;
    return { inside: inTriangle(q, a, b, c), sector: [0, lo, (lo + 1) % n] };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { polygon?: Pt[]; query?: Pt } | null) ?? {};
    const poly: Pt[] = t.polygon ?? [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
    ];
    const q: Pt = t.query ?? [3, 1];
    let step = 0;
    const base = [
        ...poly.map((p, i) => node(`p-${i}`, p, "unvisited", String(i))),
        node("p-q", q, "highlight", "q"),
    ];
    const outline = poly.map((_, i) => ({
        id: `e-${i}`,
        sourceId: `p-${i}`,
        targetId: `p-${(i + 1) % poly.length}`,
        label: "",
        state: "idle" as EntityState,
        directed: false,
    }));
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: outline.map((e) => ({ ...e })),
        description: `Test q=(${q[0]},${q[1]}) against convex ${poly.length}-gon by binary fan search.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    if (poly.length < 3) {
        yield {
            stepNumber: step++,
            entities: base.map((e) => ({ ...e })),
            edges: outline.map((e) => ({ ...e })),
            description: "Degenerate input: polygon needs ≥3 vertices.",
            codeLineNumber: 1,
            layout: "point",
            meta: { inside: false },
        };
        return;
    }
    const p0 = poly[0] as Pt,
        p1 = poly[1] as Pt,
        plast = poly[poly.length - 1] as Pt;
    const fan = [1, poly.length - 1].map((i) => ({
        id: `f-${i}`,
        sourceId: "p-0",
        targetId: `p-${i}`,
        label: "",
        state: "comparing" as EntityState,
        directed: false,
    }));
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: [...outline.map((e) => ({ ...e })), ...fan],
        description: `Fan from p0: wedge (${p0})→(${p1}) and (${p0})→(${plast}).`,
        codeLineNumber: 1,
        layout: "point",
        meta: {},
    };
    const c1 = cross(p0, p1, q),
        c2 = cross(p0, plast, q);
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: [...outline.map((e) => ({ ...e })), ...fan],
        description: `Wedge test: cross01=${c1.toFixed(2)} (≥0?) cross0n=${c2.toFixed(2)} (≤0?).`,
        codeLineNumber: 2,
        layout: "point",
        meta: { c1, c2 },
    };
    if (c1 < 0 || c2 > 0) {
        yield {
            stepNumber: step++,
            entities: base.map((e) => ({
                ...e,
                state: e.id === "p-q" ? ("visited" as EntityState) : e.state,
            })),
            edges: outline.map((e) => ({ ...e })),
            description: "Outside the fan wedge → OUTSIDE.",
            codeLineNumber: 3,
            layout: "point",
            meta: { inside: false },
        };
        return;
    }
    let lo = 1,
        hi = poly.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        const cm = cross(p0, poly[mid] as Pt, q);
        yield {
            stepNumber: step++,
            entities: base.map((e) => ({ ...e })),
            edges: [
                ...outline.map((e) => ({ ...e })),
                {
                    id: "f-mid",
                    sourceId: "p-0",
                    targetId: `p-${mid}`,
                    label: "",
                    state: "comparing" as EntityState,
                    directed: false,
                },
            ],
            description: `Binary step: sector [${lo},${hi}], mid=${mid} cross=${cm.toFixed(2)}.`,
            codeLineNumber: 3,
            layout: "point",
            meta: { lo, hi, mid },
        };
        if (cm >= 0) lo = mid;
        else hi = mid;
        if (step > 11) break;
    }
    const res = locate(poly, q);
    const sec = res.sector as [number, number, number];
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: [
            ...outline.map((e) => ({ ...e })),
            {
                id: "f-lo",
                sourceId: "p-0",
                targetId: `p-${sec[1]}`,
                label: "",
                state: "comparing" as EntityState,
                directed: false,
            },
            {
                id: "f-hi",
                sourceId: "p-0",
                targetId: `p-${sec[2]}`,
                label: "",
                state: "comparing" as EntityState,
                directed: false,
            },
        ],
        description: `Sector triangle (0,${sec[1]},${sec[2]}): ${res.inside ? "INSIDE ✓" : "OUTSIDE"}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { inside: res.inside, sector: sec },
    };
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({
            ...e,
            state: e.id === "p-q" ? ("sorted" as EntityState) : e.state,
        })),
        edges: outline.map((e) => ({ ...e, state: "sorted" as EntityState })),
        description: `Verdict: q is ${res.inside ? "INSIDE" : "OUTSIDE"} the convex polygon.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { inside: res.inside },
    };
}

const module: AlgorithmModule = {
    id: "point-in-convex-polygon-binary",
    name: "Point In Convex Polygon",
    category: "geometry",
    complexity: { time: "O(log n)", space: "O(1)" },
    defaultInput: {
        polygon: [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
        ],
        query: [3, 1],
    },
    visualType: "graph",
    run,
};

export default module;
