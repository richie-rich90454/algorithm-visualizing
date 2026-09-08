/**
 * circumcenter-circle-through-3-points.ts – Circumcenter via perpendicular
 * bisectors. Default right triangle (0,0),(4,0),(0,3): center (2,1.5), r=2.5.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function node(id: string, x: number, y: number, label: string, state: EntityState): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: [x, y],
        state,
        x,
        y,
        width: 0,
        height: 0,
        metadata: {},
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Array<[number, number]> } | null) ?? {};
    const pts: Array<[number, number]> = task.points ?? [
        [0, 0],
        [4, 0],
        [0, 3],
    ];
    let step = 0;
    const cross = (a: [number, number], b: [number, number], c: [number, number]) =>
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (pts.length !== 3 || Math.abs(cross(pts[0]!, pts[1]!, pts[2]!)) < 1e-9) {
        yield {
            stepNumber: step,
            entities: pts.map(([x, y], i) => node(`p-${i}`, x, y, String(i), "comparing")),
            edges: [],
            description: "Need 3 non-collinear points – no unique circle.",
            codeLineNumber: 0,
            layout: "point",
            meta: { center: "none" },
        };
        return;
    }
    const [[x1, y1], [x2, y2], [x3, y3]] = pts as [
        [number, number],
        [number, number],
        [number, number],
    ];
    const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    const cx =
        ((x1 * x1 + y1 * y1) * (y2 - y3) +
            (x2 * x2 + y2 * y2) * (y3 - y1) +
            (x3 * x3 + y3 * y3) * (y1 - y2)) /
        d;
    const cy =
        ((x1 * x1 + y1 * y1) * (x3 - x2) +
            (x2 * x2 + y2 * y2) * (x1 - x3) +
            (x3 * x3 + y3 * y3) * (x2 - x1)) /
        d;
    const r = Math.hypot(x1 - cx, y1 - cy);
    const base = pts.map(([x, y], i) => node(`p-${i}`, x, y, String(i), "unvisited"));
    const tri = [0, 1, 2].map((i) => ({
        id: `t-${i}`,
        sourceId: `p-${i}`,
        targetId: `p-${(i + 1) % 3}`,
        label: "",
        state: "idle" as EntityState,
        directed: false,
    }));
    yield {
        stepNumber: step,
        entities: base.map((e) => ({ ...e })),
        edges: tri.map((e) => ({ ...e })),
        description: "Triangle – circumcenter is the bisector intersection.",
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    const mid = (a: [number, number], b: [number, number]): [number, number] => [
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
    ];
    const mids = [mid(pts[0]!, pts[1]!), mid(pts[1]!, pts[2]!)];
    yield {
        stepNumber: step,
        entities: [
            ...base.map((e) => ({ ...e, state: "comparing" as EntityState })),
            ...mids.map(([x, y], i) => node(`m-${i}`, x, y, "mid", "active")),
        ],
        edges: tri.map((e) => ({ ...e })),
        description: "Edge midpoints anchor the perpendicular bisectors.",
        codeLineNumber: 1,
        layout: "point",
        meta: {},
    };
    step += 1;
    const bis: VisualEntity[] = [
        ...base.map((e) => ({ ...e })),
        ...mids.map(([x, y], i) => node(`m-${i}`, x, y, "mid", "active")),
        node("cc", cx, cy, "cc", "highlight"),
    ];
    const bEdges = [
        ...tri.map((e) => ({ ...e })),
        {
            id: "b0",
            sourceId: "m-0",
            targetId: "cc",
            label: "",
            state: "path" as EntityState,
            directed: false,
        },
        {
            id: "b1",
            sourceId: "m-1",
            targetId: "cc",
            label: "",
            state: "path" as EntityState,
            directed: false,
        },
    ];
    yield {
        stepNumber: step,
        entities: bis,
        edges: bEdges,
        description: `Bisectors meet at (${cx},${cy}).`,
        codeLineNumber: 2,
        layout: "point",
        meta: {},
    };
    step += 1;
    const ring = 8;
    const circleNodes: VisualEntity[] = [];
    for (let i = 0; i < ring; i += 1) {
        const a = (2 * Math.PI * i) / ring;
        circleNodes.push(node(`c-${i}`, cx + r * Math.cos(a), cy + r * Math.sin(a), "", "idle"));
    }
    const cEdges = circleNodes.map((_, i) => ({
        id: `c-${i}`,
        sourceId: `c-${i}`,
        targetId: `c-${(i + 1) % ring}`,
        label: "",
        state: "path" as EntityState,
        directed: false,
    }));
    yield {
        stepNumber: step,
        entities: [
            ...bis.map((e) => ({
                ...e,
                state: e.id === "cc" ? ("sorted" as EntityState) : e.state,
            })),
            ...circleNodes,
        ],
        edges: [...bEdges, ...cEdges],
        description: `Circle through all three, r=${r.toFixed(2)}.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { center: [cx, cy], radius: r },
    };
}

const module: AlgorithmModule = {
    id: "circumcenter-circle-through-3-points",
    name: "Circumcenter (Circle Through 3 Points)",
    category: "geometry",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: {
        points: [
            [0, 0],
            [4, 0],
            [0, 3],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
