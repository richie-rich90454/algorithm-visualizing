/**
 * min-enclosing-rectangle-rotating.ts – Minimum-area enclosing rectangle.
 * Tests every hull-edge orientation (rotating calipers): rotate points by
 * -θ, take the axis-aligned bbox, keep the smallest area. O(n²) brute force
 * over hull edges, O(n) space. Exact on tiny inputs.
 * Layout "point": sites plus best-corner nodes r-j carry true coords.
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

function cross(o: Pt, a: Pt, b: Pt): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function hull(pts: Pt[]): number[] {
    const idx = pts.map((_, i) => i).sort((a, b) => pts[a][0] - pts[b][0] || pts[a][1] - pts[b][1]);
    const build = (order: number[]): number[] => {
        const h: number[] = [];
        for (const i of order) {
            while (
                h.length >= 2 &&
                cross(
                    pts[h[h.length - 2] as number] as Pt,
                    pts[h[h.length - 1] as number] as Pt,
                    pts[i] as Pt,
                ) <= 0
            )
                h.pop();
            h.push(i);
        }
        return h;
    };
    const lower = build(idx);
    const upper = build([...idx].reverse());
    return [...lower, ...upper.slice(1, upper.length - 1)];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[] } | null) ?? {};
    const pts: Pt[] = task.points ?? [
        [0, 0],
        [3, 1],
        [1, 2],
        [4, 3],
        [2, 0],
    ];
    let step = 0;
    if (pts.length < 2) {
        yield {
            stepNumber: step,
            entities: nodes(pts),
            edges: [],
            description:
                pts.length === 0
                    ? "No points – no enclosing rectangle."
                    : "One point – zero-area rectangle.",
            codeLineNumber: 0,
            layout: "point",
            meta: { area: 0, corners: [] },
        };
        return;
    }
    const h = hull(pts);
    yield {
        stepNumber: step,
        entities: nodes(pts),
        edges: [],
        description: `Rotating calipers over ${h.length} hull edges.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    let best = { area: Infinity, corners: [] as Pt[], edge: -1 };
    for (let e = 0; e < h.length; e += 1) {
        const a = pts[h[e] as number] as Pt;
        const b = pts[h[(e + 1) % h.length] as number] as Pt;
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        const cos = Math.cos(-ang);
        const sin = Math.sin(-ang);
        const rot = pts.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos] as Pt);
        const xs = rot.map((p) => p[0]);
        const ys = rot.map((p) => p[1]);
        const x0 = Math.min(...xs);
        const x1 = Math.max(...xs);
        const y0 = Math.min(...ys);
        const y1 = Math.max(...ys);
        const area = (x1 - x0) * (y1 - y0);
        const c2 = Math.cos(ang);
        const s2 = Math.sin(ang);
        const back = ([x, y]: Pt): Pt => [x * c2 - y * s2, x * s2 + y * c2];
        if (area < best.area - 1e-9)
            best = {
                area,
                corners: [back([x0, y0]), back([x1, y0]), back([x1, y1]), back([x0, y1])],
                edge: e,
            };
        yield {
            stepNumber: step,
            entities: nodes(
                pts,
                new Map([
                    [h[e] as number, "active"],
                    [h[(e + 1) % h.length] as number, "comparing"],
                ]),
            ),
            edges: [],
            description: `Calipers on hull edge ${e}: θ=${((ang * 180) / Math.PI).toFixed(1)}°, bbox area=${area.toFixed(2)}.`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
    }
    const corners = best.corners.map(
        ([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100] as Pt,
    );
    const entities: VisualEntity[] = [
        ...nodes(pts, new Map(pts.map((_, i) => [i, "sorted"] as [number, EntityState]))),
        ...corners.map(([x, y], i) => ({
            id: `r-${i}`,
            type: "node" as const,
            label: `r${i}`,
            value: [x, y],
            state: "highlight" as EntityState,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "corner" },
        })),
    ];
    const edges: VisualEdge[] = corners.map((_, i) => ({
        id: `mr-${i}`,
        sourceId: `r-${i}`,
        targetId: `r-${(i + 1) % corners.length}`,
        label: "",
        state: "path",
        directed: false,
    }));
    yield {
        stepNumber: step,
        entities,
        edges,
        description: `Minimum rectangle at hull edge ${best.edge}: area=${best.area.toFixed(2)}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { area: best.area, corners: corners.map(([x, y]) => `${x},${y}`) },
    };
}

const module: AlgorithmModule = {
    id: "min-enclosing-rectangle-rotating",
    name: "Min Enclosing Rectangle (Rotating Calipers)",
    category: "geometry",
    complexity: { time: "O(n²)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [3, 1],
            [1, 2],
            [4, 3],
            [2, 0],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
