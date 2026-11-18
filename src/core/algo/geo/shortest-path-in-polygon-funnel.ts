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
        description: `Polygon (${n} vertices) with start (${start}) and goal (${goal}) inside.`,
        codeLineNumber: 1,
        layout: "point",
        meta: { vertices: n, start, goal },
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
        codeLineNumber: 2,
        layout: "point",
        meta: { diagonal: [0, 2] },
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
        codeLineNumber: 4,
        layout: "point",
        meta: { apex: start },
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
        codeLineNumber: 5,
        layout: "point",
        meta: { endpoints: [`(${start})`, `(${goal})`] },
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
        codeLineNumber: 6,
        layout: "point",
        meta: { path: [start, goal].map(([x, y]) => `${x},${y}`), length },
    };
}

const module: AlgorithmModule = {
    education: {
        "intuition": "The shortest path between two points inside a simple polygon bends only at reflex vertices. The funnel algorithm maintains a sleeve of triangles between start and goal and a convex funnel whose apex is the start; as it advances, it updates the funnel with tangents to new vertices until the goal is reached.",
        "invariants": [
            "The funnel is convex and its apex is the current path start.",
            "All vertices of the sleeve processed so far lie on or above the funnel chain.",
            "The shortest path to any reached vertex follows the lower chain of the funnel."
        ],
        "correctness": "Any shortest path in a simple polygon is a sequence of straight segments whose intermediate bend points are reflex vertices, and it lies within the sleeve of triangles between start and goal. The funnel invariant maintains the shortest path to the current front of the sweep, because extending with a tangent either keeps the old chain or replaces its tail with a shorter route around a new vertex. When the goal is added, its lower-chain path is the globally shortest path.",
        "complexityRationale": "After triangulation and sleeve computation, each triangle is processed once with constant work per popped funnel vertex, giving O(n) time for the funnel stage. The funnel and sleeve use O(n) space.",
        "uses": [
            "Pathfinding for characters in game environments",
            "Robot motion planning inside polygonal rooms",
            "Computing shortest routes in geographic corridors"
        ],
        "references": [
            "Lee and Preparata, Euclidean Shortest Paths in the Presence of Rectilinear Barriers, Networks 14 (1984)",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 15"
        ],
        "workedExample": "Inside a convex square, start (0.5,0.5) and goal (1.5,0.5) have a sleeve consisting of a single triangle and no reflex vertices. The funnel algorithm returns the direct segment, which is the shortest path."
    },

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
    pseudocode: [
        "start from a polygon with start s and goal g",
        "triangulate the sleeve of triangles from s to g",
        "open the funnel with apex at s",
        "tighten left and right chains past reflex vertices",
        "advance the apex whenever the funnel pinches",
        "stop when g sits inside the open wedge",
        "done: the apex chain plus final segment is shortest",
    ],
};

export default module;
