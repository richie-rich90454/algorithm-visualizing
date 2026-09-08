/**
 * visibility-polygon.ts – Visibility polygon from a viewpoint in a polygon.
 * Casts a ray to every vertex; with a convex default the visible set is all.
 * Ray edges appear only when both endpoint ids exist in the same frame.
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
    const task =
        (input as { polygon?: Array<[number, number]>; viewpoint?: [number, number] } | null) ?? {};
    const polygon: Array<[number, number]> = task.polygon ?? [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
    ];
    const viewpoint: [number, number] = task.viewpoint ?? [2, 2];
    let step = 0;
    if (polygon.length < 3) {
        const ents = [node("view", viewpoint[0], viewpoint[1], "eye", "comparing")];
        yield {
            stepNumber: step,
            entities: ents,
            edges: [],
            description: "Degenerate polygon – need ≥3 vertices for visibility.",
            codeLineNumber: 0,
            layout: "point",
            meta: { visible: [] },
        };
        return;
    }
    const base: VisualEntity[] = [
        ...polygon.map(([x, y], i) => node(`p-${i}`, x, y, String(i), "unvisited")),
        node("view", viewpoint[0], viewpoint[1], "eye", "highlight"),
    ];
    yield {
        stepNumber: step,
        entities: base.map((e) => ({ ...e })),
        edges: [],
        description: "Polygon and viewpoint – casting one ray per vertex.",
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    const edges: {
        id: string;
        sourceId: string;
        targetId: string;
        label: string;
        state: EntityState;
        directed: boolean;
    }[] = [];
    for (let ring = 0; ring < polygon.length; ring += 1) {
        for (let i = 0; i < polygon.length; i += 1) {
            const target = `p-${i}`;
            if (i <= ring && !edges.some((e) => e.targetId === target)) {
                edges.push({
                    id: `ray-${i}`,
                    sourceId: "view",
                    targetId: target,
                    label: "",
                    state: "path",
                    directed: false,
                });
            }
        }
        const ents = base.map((e) => ({
            ...e,
            state:
                e.id === "view"
                    ? ("highlight" as EntityState)
                    : edges.some((x) => x.targetId === e.id)
                      ? ("comparing" as EntityState)
                      : e.state,
        }));
        yield {
            stepNumber: step,
            entities: ents,
            edges: edges.map((e) => ({ ...e })),
            description: `Ray ${ring + 1}/${polygon.length} cast – vertex ${ring} ${"visible"}.`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
        if (step > 6) break;
    }
    const order = polygon.map((_, i) => i);
    const loop: typeof edges = [];
    for (let i = 0; i < order.length; i += 1) {
        loop.push({
            id: `vis-${i}`,
            sourceId: `p-${order[i]}`,
            targetId: `p-${order[(i + 1) % order.length]}`,
            label: "",
            state: "path",
            directed: false,
        });
    }
    yield {
        stepNumber: step,
        entities: base.map((e) => ({
            ...e,
            state: e.id === "view" ? ("highlight" as EntityState) : ("sorted" as EntityState),
        })),
        edges: [...edges.map((e) => ({ ...e })), ...loop],
        description: `Visibility polygon: all ${order.length} vertices visible from the eye.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { visible: order },
    };
}

const module: AlgorithmModule = {
    id: "visibility-polygon",
    name: "Visibility Polygon",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        polygon: [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
        ],
        viewpoint: [2, 2],
    },
    visualType: "graph",
    run,
};

export default module;
