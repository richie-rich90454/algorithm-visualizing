/**
 * point-line-duality-transform.ts – Point ↔ line duality (p=(a,b) ↔ y=ax−b).
 * Each primal point becomes a dual line; order along x maps to slope order.
 * Visualizes dual lines sampled at x=−2 and x=4 as true-coordinate nodes.
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
    const points: Array<[number, number]> = task.points ?? [
        [1, 2],
        [2, 1],
        [3, 3],
    ];
    let step = 0;
    const base = points.map(([x, y], i) => node(`p-${i}`, x, y, `(${x},${y})`, "unvisited"));
    const duals = points.map(([a, b]) => ({ m: a, b: -b }));
    if (points.length === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "No points – dual is empty.",
            codeLineNumber: 0,
            layout: "point",
            meta: { lines: [] },
        };
        return;
    }
    yield {
        stepNumber: step,
        entities: base.map((e) => ({ ...e })),
        edges: [],
        description: `Primal: ${points.length} points. Dual maps (a,b) to y=${"ax−b"}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    const shown: VisualEntity[] = base.map((e) => ({ ...e }));
    const edges: {
        id: string;
        sourceId: string;
        targetId: string;
        label: string;
        state: EntityState;
        directed: boolean;
    }[] = [];
    for (let i = 0; i < points.length; i += 1) {
        const d = duals[i]!;
        const x0 = -2,
            x1 = 4;
        shown.push(node(`d-${i}-0`, x0, d.m * x0 + d.b, "", "idle"));
        shown.push(node(`d-${i}-1`, x1, d.m * x1 + d.b, "", "idle"));
        edges.push({
            id: `dl-${i}`,
            sourceId: `d-${i}-0`,
            targetId: `d-${i}-1`,
            label: `y=${d.m}x${d.b < 0 ? d.b : "+" + d.b}`,
            state: "path",
            directed: false,
        });
        const ent = shown.map((e) => ({
            ...e,
            state: e.id === `p-${i}` ? ("comparing" as EntityState) : e.state,
        }));
        yield {
            stepNumber: step,
            entities: ent,
            edges: edges.map((e) => ({ ...e })),
            description: `p-${i} (${points[i]}) ↔ y=${d.m}x${d.b < 0 ? d.b : "+" + d.b}.`,
            codeLineNumber: 1,
            layout: "point",
            meta: { m: d.m, b: d.b },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: shown.map((e) => ({
            ...e,
            state: e.id.startsWith("p-") ? ("sorted" as EntityState) : e.state,
        })),
        edges: edges.map((e) => ({ ...e })),
        description: `Dual complete: ${duals.length} lines; collinear primal points would concur in dual.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { lines: duals.map((d) => `${d.m},${d.b}`) },
    };
}

const module: AlgorithmModule = {
    id: "point-line-duality-transform",
    name: "Point–Line Duality Transform",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        points: [
            [1, 2],
            [2, 1],
            [3, 3],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
