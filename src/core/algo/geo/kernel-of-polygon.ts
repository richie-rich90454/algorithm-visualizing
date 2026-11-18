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
        codeLineNumber: 1,
        layout: "point",
        meta: { edges: pts.length },
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
            codeLineNumber: 3,
            layout: "point",
            meta: { edge: e, kernel: kernel.length },
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
        codeLineNumber: 4,
        layout: "point",
        meta: { kernel: kernel.map(([x, y]) => `${x},${y}`) },
    };
}

const module: AlgorithmModule = {
    education: {
        "intuition": "The kernel of a polygon is the set of points that can see every part of the polygon. A point sees the whole polygon exactly when it lies on the interior side of every edge, so the kernel is the intersection of the n half-planes defined by the edges.",
        "invariants": [
            "A point is in the kernel iff it is inside every edge's interior half-plane.",
            "The kernel is always convex, being an intersection of half-planes.",
            "For a convex polygon the kernel equals the polygon itself."
        ],
        "correctness": "In a simple polygon a point sees the whole boundary iff it lies to the interior side of each directed edge, because otherwise some edge would block the view of a region behind it. Clipping the polygon successively by each interior half-plane with Sutherland-Hodgman therefore leaves exactly the set of points satisfying all those conditions, which is the kernel.",
        "complexityRationale": "Each of the n clips scans the current vertex list once in two dimensions, giving O(n^2) time and O(n) space for the current clipped polygon on these small inputs.",
        "uses": [
            "Finding guard positions that see an entire room",
            "Visibility analysis in architecture and urban planning",
            "Testing whether a polygon is star-shaped"
        ],
        "references": [
            "O'Rourke, Computational Geometry in C, Chapter 5",
            "Preparata and Shamos, Computational Geometry: An Introduction, Chapter 5"
        ],
        "workedExample": "For the triangle (0,0), (4,0), (0,3), all three interior half-planes intersect in the triangle itself, so the kernel is the whole triangle. For an L-shaped polygon occupying [0,2] by [0,1] plus [0,1] by [1,2], the half-planes reduce to the square [0,1] by [0,1], which is the kernel."
    },

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
    pseudocode: [
        "start from the full polygon as the kernel candidate",
        "clip the candidate against each edge half-plane",
        "drop the part falling outside the current edge",
        "stop early when the kernel turns empty",
        "done: leftover vertices see the whole polygon",
    ],
};

export default module;
