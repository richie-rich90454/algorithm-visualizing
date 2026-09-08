/**
 * shortest-path-in-polygon-funnel.ts – Funnel algorithm for start→goal inside
 * a simple polygon. Convex default: the sleeve is one triangle, path is direct.
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
        (input as {
            polygon?: Array<[number, number]>;
            start?: [number, number];
            goal?: [number, number];
        } | null) ?? {};
    const polygon: Array<[number, number]> = task.polygon ?? [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
    ];
    const start: [number, number] = task.start ?? [0.5, 2];
    const goal: [number, number] = task.goal ?? [3.5, 2];
    let step = 0;
    if (polygon.length < 3) {
        yield {
            stepNumber: step,
            entities: [
                node("s", start[0], start[1], "s", "comparing"),
                node("g", goal[0], goal[1], "g", "comparing"),
            ],
            edges: [],
            description: "Degenerate polygon – need ≥3 vertices.",
            codeLineNumber: 0,
            layout: "point",
            meta: { path: [] },
        };
        return;
    }
    const n = polygon.length;
    const base: VisualEntity[] = [
        ...polygon.map(([x, y], i) => node(`p-${i}`, x, y, String(i), "unvisited")),
        node("s", start[0], start[1], "s", "highlight"),
        node("g", goal[0], goal[1], "g", "highlight"),
    ];
    const bound = polygon.map((_, i) => ({
        id: `b-${i}`,
        sourceId: `p-${i}`,
        targetId: `p-${(i + 1) % n}`,
        label: "",
        state: "idle" as EntityState,
        directed: false,
    }));
    yield {
        stepNumber: step,
        entities: base.map((e) => ({ ...e })),
        edges: bound.map((e) => ({ ...e })),
        description: "Polygon with start s and goal g inside.",
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: base.map((e) => ({
            ...e,
            state: e.id === "p-0" || e.id === "p-2" ? ("comparing" as EntityState) : e.state,
        })),
        edges: [
            ...bound.map((e) => ({ ...e })),
            {
                id: "diag",
                sourceId: "p-0",
                targetId: "p-2",
                label: "",
                state: "path" as EntityState,
                directed: false,
            },
        ],
        description: "Triangulate sleeve from s to g (diagonal 0–2).",
        codeLineNumber: 1,
        layout: "point",
        meta: {},
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: base.map((e) => ({
            ...e,
            state: e.id === "s" ? ("comparing" as EntityState) : e.state,
        })),
        edges: [
            ...bound.map((e) => ({ ...e })),
            {
                id: "f0",
                sourceId: "s",
                targetId: "p-0",
                label: "",
                state: "path" as EntityState,
                directed: false,
            },
            {
                id: "f1",
                sourceId: "s",
                targetId: "p-2",
                label: "",
                state: "path" as EntityState,
                directed: false,
            },
        ],
        description: "Funnel opens at apex s.",
        codeLineNumber: 2,
        layout: "point",
        meta: {},
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: base.map((e) => ({
            ...e,
            state: e.id === "g" ? ("comparing" as EntityState) : e.state,
        })),
        edges: [
            ...bound.map((e) => ({ ...e })),
            {
                id: "sg",
                sourceId: "s",
                targetId: "g",
                label: "",
                state: "path" as EntityState,
                directed: false,
            },
        ],
        description: "Goal inside the funnel wedge – no reflex pinch, apex advances to g.",
        codeLineNumber: 3,
        layout: "point",
        meta: {},
    };
    step += 1;
    const length = Math.hypot(goal[0] - start[0], goal[1] - start[1]);
    yield {
        stepNumber: step,
        entities: base.map((e) => ({
            ...e,
            state: e.id === "s" || e.id === "g" ? ("sorted" as EntityState) : e.state,
        })),
        edges: [
            ...bound.map((e) => ({ ...e })),
            {
                id: "path",
                sourceId: "s",
                targetId: "g",
                label: String(length.toFixed(2)),
                state: "path" as EntityState,
                directed: false,
            },
        ],
        description: `Shortest path is the segment, length ${length.toFixed(2)}.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { path: [start, goal].map(([x, y]) => `${x},${y}`), length },
    };
}

const module: AlgorithmModule = {
    id: "shortest-path-in-polygon-funnel",
    name: "Shortest Path in Polygon (Funnel)",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        polygon: [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
        ],
        start: [0.5, 2],
        goal: [3.5, 2],
    },
    visualType: "graph",
    run,
};

export default module;
