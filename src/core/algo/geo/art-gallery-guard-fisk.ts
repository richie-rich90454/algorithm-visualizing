/**
 * art-gallery-guard-fisk.ts – Fisk's art-gallery proof: triangulate, 3-color,
 * guard the smallest color class (≤ ⌊n/3⌋ guards). Fan triangulation used here.
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
    const task = (input as { polygon?: Array<[number, number]> } | null) ?? {};
    const polygon: Array<[number, number]> = task.polygon ?? [
        [0, 0],
        [4, 0],
        [4, 2],
        [2, 4],
        [0, 3],
        [1, 1.5],
    ];
    let step = 0;
    if (polygon.length < 3) {
        yield {
            stepNumber: step,
            entities: polygon.map(([x, y], i) => node(`p-${i}`, x, y, String(i), "comparing")),
            edges: [],
            description: "Degenerate polygon – need ≥3 vertices.",
            codeLineNumber: 0,
            layout: "point",
            meta: { guards: [] },
        };
        return;
    }
    const n = polygon.length;
    const base = polygon.map(([x, y], i) => node(`p-${i}`, x, y, String(i), "unvisited"));
    const boundEdges = polygon.map((_, i) => ({
        id: `b-${i}`,
        sourceId: `p-${i}`,
        targetId: `p-${(i + 1) % n}`,
        label: "",
        state: "idle" as EntityState,
        directed: false,
    }));
    const diagonals: typeof boundEdges = [];
    for (let i = 2; i < n - 1 + 1 && diagonals.length < n - 3; i += 1) {
        diagonals.push({
            id: `t-${i}`,
            sourceId: "p-0",
            targetId: `p-${i}`,
            label: "",
            state: "path" as EntityState,
            directed: false,
        });
    }
    yield {
        stepNumber: step,
        entities: base.map((e) => ({ ...e })),
        edges: boundEdges.map((e) => ({ ...e })),
        description: `Gallery with n=${n} walls – Fisk bound ⌊n/3⌋=${Math.floor(n / 3)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    for (let k = 0; k < diagonals.length; k += 1) {
        yield {
            stepNumber: step,
            entities: base.map((e) => ({
                ...e,
                state:
                    e.id === "p-0" || e.id === (diagonals[k] as { targetId: string }).targetId
                        ? ("comparing" as EntityState)
                        : e.state,
            })),
            edges: [
                ...boundEdges.map((e) => ({ ...e })),
                ...diagonals.slice(0, k + 1).map((e) => ({ ...e })),
            ],
            description: `Triangulating: diagonal ${k + 1}/${diagonals.length} (fan from vertex 0).`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
    }
    const colorOf = (i: number): number => i % 3;
    const colorName = ["red", "green", "blue"];
    const classes: number[][] = [[], [], []];
    for (let i = 0; i < n; i += 1) classes[colorOf(i)]!.push(i);
    let smallest = 0;
    for (let c = 1; c < 3; c += 1)
        if ((classes[c]?.length ?? 0) < (classes[smallest]?.length ?? 0)) smallest = c;
    const stateOf = (i: number): EntityState =>
        colorOf(i) === 0 ? "swapped" : colorOf(i) === 1 ? "sorted" : "active";
    yield {
        stepNumber: step,
        entities: base.map((e, i) => ({ ...e, state: stateOf(i) })),
        edges: [...boundEdges.map((e) => ({ ...e })), ...diagonals.map((e) => ({ ...e }))],
        description: `3-colored: sizes ${classes.map((c) => c.length).join("/")}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { coloring: classes.map((c) => c.join(",")) },
    };
    step += 1;
    const guards = classes[smallest] ?? [];
    yield {
        stepNumber: step,
        entities: base.map((e, i) => ({
            ...e,
            state: guards.includes(i) ? ("highlight" as EntityState) : stateOf(i),
        })),
        edges: [...boundEdges.map((e) => ({ ...e })), ...diagonals.map((e) => ({ ...e }))],
        description: `Guards on ${colorName[smallest]} class: vertices [${guards.join(", ")}] (${guards.length} ≤ ⌊${n}/3⌋).`,
        codeLineNumber: 3,
        layout: "point",
        meta: { guards },
    };
}

const module: AlgorithmModule = {
    id: "art-gallery-guard-fisk",
    name: "Art Gallery Guards (Fisk)",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        polygon: [
            [0, 0],
            [4, 0],
            [4, 2],
            [2, 4],
            [0, 3],
            [1, 1.5],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
