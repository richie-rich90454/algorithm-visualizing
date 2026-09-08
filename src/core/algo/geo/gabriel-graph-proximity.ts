/**
 * gabriel-graph-proximity.ts – Gabriel graph: edge (u,v) iff the closed
 * diametral disk contains no other point. Tests pairs one frame at a time.
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
        [2, 0],
        [1, 2],
    ];
    let step = 0;
    if (pts.length < 2) {
        yield {
            stepNumber: step,
            entities: pts.map(([x, y], i) => node(`p-${i}`, x, y, String(i), "comparing")),
            edges: [],
            description: "Need ≥2 points for a proximity graph.",
            codeLineNumber: 0,
            layout: "point",
            meta: { edges: [] },
        };
        return;
    }
    const base = pts.map(([x, y], i) => node(`p-${i}`, x, y, String(i), "unvisited"));
    yield {
        stepNumber: step,
        entities: base.map((e) => ({ ...e })),
        edges: [],
        description: `Gabriel test over ${pts.length} points – checking each pair's diametral disk.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < pts.length; i += 1)
        for (let j = i + 1; j < pts.length; j += 1) pairs.push([i, j]);
    const kept: Array<[number, number]> = [];
    const blocked = (i: number, j: number): number => {
        const [ax, ay] = pts[i]!,
            [bx, by] = pts[j]!;
        const mx = (ax + bx) / 2,
            my = (ay + by) / 2,
            r2 = ((ax - bx) ** 2 + (ay - by) ** 2) / 4;
        for (let k = 0; k < pts.length; k += 1) {
            if (k === i || k === j) continue;
            const dx = pts[k]![0] - mx,
                dy = pts[k]![1] - my;
            if (dx * dx + dy * dy < r2 - 1e-9) return k;
        }
        return -1;
    };
    for (let t = 0; t < pairs.length && step < 12; t += 1) {
        const [i, j] = pairs[t]!;
        const w = blocked(i, j);
        if (w < 0) kept.push([i, j]);
        const ents = base.map((e, k) => ({
            ...e,
            state:
                k === i || k === j
                    ? ("comparing" as EntityState)
                    : w === k
                      ? ("swapped" as EntityState)
                      : e.state,
        }));
        const edges = kept.map(([a, b]) => ({
            id: `g-${a}-${b}`,
            sourceId: `p-${a}`,
            targetId: `p-${b}`,
            label: "",
            state: "path" as EntityState,
            directed: false,
        }));
        yield {
            stepNumber: step,
            entities: ents,
            edges,
            description:
                w < 0
                    ? `Pair (${i},${j}): disk empty – edge kept.`
                    : `Pair (${i},${j}): blocked by point ${w}.`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: base.map((e) => ({ ...e, state: "sorted" as EntityState })),
        edges: kept.map(([a, b]) => ({
            id: `g-${a}-${b}`,
            sourceId: `p-${a}`,
            targetId: `p-${b}`,
            label: "",
            state: "path" as EntityState,
            directed: false,
        })),
        description: `Gabriel graph: ${kept.length}/${pairs.length} edges kept.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { edges: kept.map(([a, b]) => `${a}-${b}`) },
    };
}

const module: AlgorithmModule = {
    id: "gabriel-graph-proximity",
    name: "Gabriel Graph (Proximity)",
    category: "geometry",
    complexity: { time: "O(n³)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [2, 0],
            [1, 2],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
