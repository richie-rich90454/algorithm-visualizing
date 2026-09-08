/**
 * kernel-of-polygon.ts – Kernel of a (CCW) polygon.
 * Clips the polygon with each edge's interior half-plane (Sutherland–Hodgman);
 * the surviving region is the set of points seeing the whole polygon.
 * O(n²) time, O(n) space. Exact on tiny inputs.
 * Layout "point": polygon vertices plus kernel vertices k-j, true coords.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function nodes(pts: Pt[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return pts.map(([x, y], i) => ({
        id: `p-${i}`,
        type: "node" as const,
        label: `v${i}(${x},${y})`,
        value: [x, y],
        state: states.get(i) ?? "unvisited",
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index: i },
    }));
}

function cross(o: Pt, a: Pt, b: Pt): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function intersect(a: Pt, b: Pt, c: Pt, d: Pt): Pt {
    const r: Pt = [b[0] - a[0], b[1] - a[1]];
    const s: Pt = [d[0] - c[0], d[1] - c[1]];
    const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / (r[0] * s[1] - r[1] * s[0]);
    return [a[0] + t * r[0], a[1] + t * r[1]];
}

function clip(subject: Pt[], a: Pt, b: Pt): Pt[] {
    const out: Pt[] = [];
    for (let i = 0; i < subject.length; i += 1) {
        const cur = subject[i] as Pt;
        const prev = subject[(i - 1 + subject.length) % subject.length] as Pt;
        const inCur = cross(a, b, cur) >= -1e-9;
        const inPrev = cross(a, b, prev) >= -1e-9;
        if (inCur) {
            if (!inPrev) out.push(intersect(prev, cur, a, b));
            out.push(cur);
        } else if (inPrev) out.push(intersect(prev, cur, a, b));
    }
    return out;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[] } | null) ?? {};
    const pts: Pt[] = task.points ?? [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3],
    ];
    let step = 0;
    if (pts.length < 3) {
        yield {
            stepNumber: step,
            entities: nodes(pts),
            edges: [],
            description: "Fewer than 3 vertices – no kernel.",
            codeLineNumber: 0,
            layout: "point",
            meta: { kernel: [] },
        };
        return;
    }
    const boundary: VisualEdge[] = pts.map((_, i) => ({
        id: `b-${i}`,
        sourceId: `p-${i}`,
        targetId: `p-${(i + 1) % pts.length}`,
        label: "",
        state: "idle",
        directed: false,
    }));
    yield {
        stepNumber: step,
        entities: nodes(pts),
        edges: boundary,
        description: `Kernel: clipping against ${pts.length} edge half-planes.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    let kernel: Pt[] = pts.map((p) => [...p] as Pt);
    for (let e = 0; e < pts.length; e += 1) {
        kernel = clip(kernel, pts[e] as Pt, pts[(e + 1) % pts.length] as Pt);
        const ents: VisualEntity[] = [
            ...nodes(
                pts,
                new Map([
                    [e, "active"],
                    [(e + 1) % pts.length, "comparing"],
                ]),
            ),
            ...kernel.map(([x, y], i) => ({
                id: `k-${i}`,
                type: "node" as const,
                label: `k${i}`,
                value: [x, y],
                state: "highlight" as EntityState,
                x,
                y,
                width: 0,
                height: 0,
                metadata: { index: i, kind: "kernel" },
            })),
        ];
        yield {
            stepNumber: step,
            entities: ents,
            edges: boundary,
            description:
                kernel.length === 0
                    ? `Half-plane ${e} emptied the kernel – polygon is not star-shaped.`
                    : `After half-plane ${e}: kernel has ${kernel.length} vertices.`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
        if (kernel.length === 0) break;
    }
    yield {
        stepNumber: step,
        entities: nodes(pts, new Map(pts.map((_, i) => [i, "sorted"] as [number, EntityState]))),
        edges: boundary,
        description:
            kernel.length === 0
                ? "Kernel is empty."
                : `Kernel found with ${kernel.length} vertices.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { kernel: kernel.map(([x, y]) => `${x},${y}`) },
    };
}

const module: AlgorithmModule = {
    id: "kernel-of-polygon",
    name: "Kernel of a Polygon",
    category: "geometry",
    complexity: { time: "O(n²)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [4, 0],
            [4, 3],
            [0, 3],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
