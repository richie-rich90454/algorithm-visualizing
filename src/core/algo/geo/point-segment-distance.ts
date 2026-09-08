/**
 * point-segment-distance.ts – distance from a point to a segment.
 * Projection t = dot(AP,AB)/|AB|^2 clamped to [0,1]; closest = A+t·AB.
 * Time O(1), Space O(1). Nodes carry true coordinates, layout "point".
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { point?: Pt; a?: Pt; b?: Pt } | null) ?? {};
    const q: Pt = t.point ?? [1, 1];
    const a: Pt = t.a ?? [0, 0];
    const b: Pt = t.b ?? [4, 0];
    let step = 0;
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const len2 = abx * abx + aby * aby;
    const base = [
        node("p-q", q, "highlight", "q"),
        node("p-a", a, "unvisited", "a"),
        node("p-b", b, "unvisited", "b"),
    ];
    const seg = [
        {
            id: "e-ab",
            sourceId: "p-a",
            targetId: "p-b",
            label: "",
            state: "idle" as EntityState,
            directed: false,
        },
    ];

    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: seg.map((e) => ({ ...e })),
        description: "Query point q and segment ab.",
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    if (len2 === 0) {
        const d = Math.hypot(q[0] - a[0], q[1] - a[1]);
        yield {
            stepNumber: step++,
            entities: base.map((e) => ({ ...e })),
            edges: seg.map((e) => ({ ...e })),
            description: `Degenerate segment (a=b); distance = |qa| = ${d.toFixed(3)}.`,
            codeLineNumber: 1,
            layout: "point",
            meta: { distance: d },
        };
        return;
    }
    const rawT = ((q[0] - a[0]) * abx + (q[1] - a[1]) * aby) / len2;
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: seg.map((e) => ({ ...e })),
        description: `Edge vector ab = (${abx}, ${aby}), |ab|² = ${len2}.`,
        codeLineNumber: 1,
        layout: "point",
        meta: { len2 },
    };
    yield {
        stepNumber: step++,
        entities: base.map((e) => ({ ...e })),
        edges: seg.map((e) => ({ ...e })),
        description: `Raw projection t = ${rawT.toFixed(3)}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { rawT },
    };
    const tc = Math.min(1, Math.max(0, rawT));
    const c: Pt = [a[0] + tc * abx, a[1] + tc * aby];
    const withC = [...base.map((e) => ({ ...e })), node("p-c", c, "comparing", "c")];
    yield {
        stepNumber: step++,
        entities: withC,
        edges: seg.map((e) => ({ ...e })),
        description: `Clamped t = ${tc.toFixed(3)}; closest c = (${c[0].toFixed(2)}, ${c[1].toFixed(2)}).`,
        codeLineNumber: 3,
        layout: "point",
        meta: { t: tc },
    };
    const d = Math.hypot(q[0] - c[0], q[1] - c[1]);
    const edges2 = [
        ...seg.map((e) => ({ ...e })),
        {
            id: "e-qc",
            sourceId: "p-q",
            targetId: "p-c",
            label: "",
            state: "comparing" as EntityState,
            directed: false,
        },
    ];
    yield {
        stepNumber: step++,
        entities: withC.map((e) => ({ ...e })),
        edges: edges2,
        description: `Perpendicular qc shown (interior: ${rawT >= 0 && rawT <= 1}).`,
        codeLineNumber: 4,
        layout: "point",
        meta: { distance: d },
    };
    const done = withC.map((e) =>
        e.id === "p-c" || e.id === "p-q" ? { ...e, state: "sorted" as EntityState } : { ...e },
    );
    yield {
        stepNumber: step++,
        entities: done,
        edges: edges2.map((e) => ({ ...e, state: "sorted" as EntityState })),
        description: `Distance = ${d.toFixed(4)} (t=${tc.toFixed(3)}).`,
        codeLineNumber: 5,
        layout: "point",
        meta: { distance: d, t: tc, closest: c },
    };
}

const module: AlgorithmModule = {
    id: "point-segment-distance",
    name: "Point Segment Distance",
    category: "geometry",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { point: [1, 1], a: [0, 0], b: [4, 0] },
    visualType: "graph",
    run,
};

export default module;
