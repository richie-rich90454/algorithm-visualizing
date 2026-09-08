/**
 * polygon-centroid.ts – Polygon centroid via the shoelace formula.
 * Accumulates signed cross terms over edges; area = Σcross/2 and
 * centroid = Σ((a+b)·cross) / (6·area). O(n) time, O(1) extra space.
 * Layout "point": vertices plus centroid node c-0 carry true coords.
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
            description: "Fewer than 3 vertices – no polygon area or centroid.",
            codeLineNumber: 0,
            layout: "point",
            meta: { area: 0, centroid: "none" },
        };
        return;
    }
    const edges: VisualEdge[] = pts.map((_, i) => ({
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
        edges,
        description: `Shoelace: accumulating cross terms over ${pts.length} edges.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    let cross2 = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i] as Pt;
        const b = pts[(i + 1) % pts.length] as Pt;
        const cr = a[0] * b[1] - b[0] * a[1];
        cross2 += cr;
        cx += (a[0] + b[0]) * cr;
        cy += (a[1] + b[1]) * cr;
        yield {
            stepNumber: step,
            entities: nodes(
                pts,
                new Map([
                    [i, "active"],
                    [(i + 1) % pts.length, "comparing"],
                ]),
            ),
            edges,
            description: `Edge ${i}→${(i + 1) % pts.length}: cross=${cr}, running Σ=${cross2}.`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
    }
    const area = cross2 / 2;
    const centroid: Pt = [cx / (6 * area), cy / (6 * area)];
    const done: VisualEntity[] = [
        ...nodes(pts, new Map(pts.map((_, i) => [i, "sorted"] as [number, EntityState]))),
        {
            id: "c-0",
            type: "node" as const,
            label: `C(${centroid[0]},${centroid[1]})`,
            value: centroid,
            state: "highlight",
            x: centroid[0],
            y: centroid[1],
            width: 0,
            height: 0,
            metadata: { kind: "centroid" },
        },
    ];
    yield {
        stepNumber: step,
        entities: done,
        edges,
        description: `Area=${area}, centroid=(${centroid[0]}, ${centroid[1]}).`,
        codeLineNumber: 2,
        layout: "point",
        meta: { area, centroid },
    };
}

const module: AlgorithmModule = {
    id: "polygon-centroid",
    name: "Polygon Centroid",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(1)" },
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
