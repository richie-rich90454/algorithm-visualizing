/**
 * hilbert-curve-point-ordering.ts – order points by Hilbert curve index.
 * Maps unit-square points to order-k grid cells, computes the Hilbert
 * index by bit interleaving with quadrant rotations. O(n log n).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function node(id: string, p: Pt, state: EntityState, label: string): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: [p[0], p[1]],
        state,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: {},
    };
}
function hilbertIndex(x: number, y: number, order: number): number {
    let d = 0,
        rx: number,
        ry: number,
        s: number;
    let X = x,
        Y = y;
    for (s = 1 << (order - 1); s > 0; s >>= 1) {
        rx = (X & s) > 0 ? 1 : 0;
        ry = (Y & s) > 0 ? 1 : 0;
        d += s * s * ((3 * rx) ^ ry);
        if (ry === 0) {
            if (rx === 1) {
                X = (1 << order) - 1 - X;
                Y = (1 << order) - 1 - Y;
            }
            const t = X;
            X = Y;
            Y = t;
        }
    }
    return d;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { points?: Pt[]; order?: number } | null) ?? {};
    const pts: Pt[] = t.points ?? [
        [0.1, 0.1],
        [0.9, 0.1],
        [0.9, 0.9],
        [0.1, 0.9],
    ];
    const order: number = t.order ?? 2;
    let step = 0;
    const base = pts.map((p, i) => node(`p-${i}`, p, "unvisited", String(i)));
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: [],
        description: `Order ${pts.length} points along a Hilbert curve (order ${order}).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { order },
    };
    if (pts.length === 0) {
        yield {
            stepNumber: step++,
            entities: [],
            edges: [],
            description: "Degenerate input: no points to order.",
            codeLineNumber: 1,
            layout: "point",
            meta: { order: [] },
        };
        return;
    }
    const n = 1 << order;
    const idx = pts.map((p) =>
        hilbertIndex(
            Math.min(n - 1, Math.floor(p[0] * n)),
            Math.min(n - 1, Math.floor(p[1] * n)),
            order,
        ),
    );
    for (let i = 0; i < pts.length && step < 10; i += 1) {
        yield {
            stepNumber: step++,
            entities: base.map((e, k) => ({
                ...e,
                state: k === i ? ("comparing" as EntityState) : e.state,
            })),
            edges: [],
            description: `Point ${i} (${pts[i]?.[0]},${pts[i]?.[1]}) → cell Hilbert index ${idx[i]}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { point: i, index: idx[i] },
        };
    }
    const seq = pts.map((_, i) => i).sort((a, b) => (idx[a] as number) - (idx[b] as number));
    const path = seq.slice(0, -1).map((v, k) => ({
        id: `h-${k}`,
        sourceId: `p-${v}`,
        targetId: `p-${seq[k + 1]}`,
        label: "",
        state: "comparing" as EntityState,
        directed: true,
    }));
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: path.map((e) => ({ ...e })),
        description: `Hilbert order: [${seq.join(" → ")}].`,
        codeLineNumber: 3,
        layout: "point",
        meta: { order: seq },
    };
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e, state: "sorted" as EntityState })),
        edges: path.map((e) => ({ ...e, state: "sorted" as EntityState })),
        description: `Sorted ${pts.length} points by Hilbert index.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { order: seq, indices: idx },
    };
}

const module: AlgorithmModule = {
    id: "hilbert-curve-point-ordering",
    name: "Hilbert Curve Point Ordering",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        points: [
            [0.1, 0.1],
            [0.9, 0.1],
            [0.9, 0.9],
            [0.1, 0.9],
        ],
        order: 2,
    },
    visualType: "graph",
    run,
};

export default module;
