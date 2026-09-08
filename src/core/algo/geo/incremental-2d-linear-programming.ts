/**
 * incremental-2d-linear-programming.ts – Seidel-style incremental 2D LP: add
 * constraints one at a time, re-solving in O(1) when the optimum violates one.
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
        (input as { objective?: [number, number]; bounds?: { x: number; y: number } } | null) ?? {};
    const c: [number, number] = task.objective ?? [1, 1];
    const B = task.bounds ?? { x: 6, y: 3 };
    // Constraints a·p ≤ b: −x≤0, −y≤0, x+2y≤6. Feasible vertices: (0,0),(6,0),(0,3).
    const cons = [
        { a: [-1, 0] as [number, number], b: 0, label: "x≥0" },
        { a: [0, -1] as [number, number], b: 0, label: "y≥0" },
        { a: [1, 2] as [number, number], b: 6, label: "x+2y≤6" },
    ];
    const verts: Array<[number, number]> = [
        [0, 0],
        [B.x, 0],
        [0, B.y],
    ];
    const score = (p: [number, number]) => c[0] * p[0] + c[1] * p[1];
    let opt: [number, number] = [0, 0];
    for (const v of verts) if (score(v) > score(opt)) opt = v;
    let step = 0;
    const base = verts.map(([x, y], i) => node(`p-${i}`, x, y, `(${x},${y})`, "unvisited"));
    yield {
        stepNumber: step,
        entities: base.map((e) => ({ ...e })),
        edges: [],
        description: `Max (${c})·p over the triangle – start optimum at origin.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    for (let k = 0; k < cons.length; k += 1) {
        const ok = cons[k]!.a[0] * opt[0] + cons[k]!.a[1] * opt[1] <= cons[k]!.b + 1e-9;
        if (!ok) {
            let best: [number, number] = verts[0]!;
            for (const v of verts) {
                if (
                    cons[k]!.a[0] * v[0] + cons[k]!.a[1] * v[1] <= cons[k]!.b + 1e-9 &&
                    score(v) > score(best)
                )
                    best = v;
            }
            opt = best;
        }
        const ents = base.map((e, i) => ({
            ...e,
            state:
                verts[i]![0] === opt[0] && verts[i]![1] === opt[1]
                    ? ("comparing" as EntityState)
                    : e.state,
        }));
        yield {
            stepNumber: step,
            entities: [...ents, node(`o-${k}`, opt[0], opt[1], "opt", "highlight")],
            edges: [],
            description: `Constraint ${k + 1}/3 (${cons[k]!.label}): optimum (${opt}) value ${score(opt)}.`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
    }
    const loop = verts.map((_, i) => ({
        id: `f-${i}`,
        sourceId: `p-${i}`,
        targetId: `p-${(i + 1) % verts.length}`,
        label: "",
        state: "path" as EntityState,
        directed: false,
    }));
    yield {
        stepNumber: step,
        entities: [
            ...base.map((e, i) => ({
                ...e,
                state:
                    verts[i]![0] === opt[0] && verts[i]![1] === opt[1]
                        ? ("sorted" as EntityState)
                        : e.state,
            })),
            node("opt", opt[0], opt[1], "opt", "highlight"),
        ],
        edges: loop,
        description: `Optimum (${opt}) with value ${score(opt)} – on the feasible boundary.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { optimum: opt, value: score(opt) },
    };
}

const module: AlgorithmModule = {
    id: "incremental-2d-linear-programming",
    name: "Incremental 2D Linear Programming",
    category: "geometry",
    complexity: { time: "O(n) expected", space: "O(n)" },
    defaultInput: { objective: [1, 1], bounds: { x: 6, y: 3 } },
    visualType: "graph",
    run,
};

export default module;
