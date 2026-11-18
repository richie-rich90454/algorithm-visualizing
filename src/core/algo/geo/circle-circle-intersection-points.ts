/**
 * circle-circle-intersection-points.ts – Circle–circle intersection.
 * With center distance d, a=(r0²−r1²+d²)/2d along the center line and
 * h²=r0²−a² across it: 0, 1, or 2 points. O(1) time and space.
 * Layout "point": centers c-0/c-1 plus intersection nodes, true coords.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function ptNode(id: string, [x, y]: Pt, label: string, state: EntityState): VisualEntity {
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
    const task = (input as { c0?: Pt; r0?: number; c1?: Pt; r1?: number } | null) ?? {};
    const c0: Pt = task.c0 ?? [0, 0];
    const c1: Pt = task.c1 ?? [4, 0];
    const r0 = task.r0 ?? 3;
    const r1 = task.r1 ?? 3;
    let step = 0;
    const base = (): VisualEntity[] => [
        ptNode("c-0", c0, `C0(${c0}) r=${r0}`, "active"),
        ptNode("c-1", c1, `C1(${c1}) r=${r1}`, "comparing"),
    ];
    const d = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);
    yield {
        stepNumber: step,
        entities: base(),
        edges: [],
        description: `Two circles: center distance d=${d.toFixed(2)}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { centerDistance: d },
    };
    step += 1;
    if (d < 1e-9) {
        yield {
            stepNumber: step,
            entities: base(),
            edges: [],
            description: "Concentric circles – 0 or infinitely many intersections.",
            codeLineNumber: 1,
            layout: "point",
            meta: { points: [] },
        };
        return;
    }
    const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
    yield {
        stepNumber: step,
        entities: base(),
        edges: [],
        description: `Base point at a=${a.toFixed(2)} along the center line.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { basePoint: a },
    };
    step += 1;
    const h2 = r0 * r0 - a * a;
    if (h2 < -1e-9) {
        yield {
            stepNumber: step,
            entities: base(),
            edges: [],
            description: "Circles are separate or contained – no intersection.",
            codeLineNumber: 3,
            layout: "point",
            meta: { points: [] },
        };
        return;
    }
    const h = Math.sqrt(Math.max(0, h2));
    const mx = c0[0] + (a * (c1[0] - c0[0])) / d;
    const my = c0[1] + (a * (c1[1] - c0[1])) / d;
    const ox = (-h * (c1[1] - c0[1])) / d;
    const oy = (h * (c1[0] - c0[0])) / d;
    const p: Pt = [Math.round((mx + ox) * 100) / 100, Math.round((my + oy) * 100) / 100];
    const q: Pt = [Math.round((mx - ox) * 100) / 100, Math.round((my - oy) * 100) / 100];
    yield {
        stepNumber: step,
        entities: base(),
        edges: [],
        description: `Height h=${h.toFixed(2)} across the center line.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { height: h },
    };
    step += 1;
    const pts = h < 1e-9 ? [p] : [p, q];
    yield {
        stepNumber: step,
        entities: [...base(), ...pts.map((s, i) => ptNode(`x-${i}`, s, `X${i}(${s})`, "sorted"))],
        edges: [],
        description: h < 1e-9 ? `Tangent at (${p}).` : `Two intersections: (${p}) and (${q}).`,
        codeLineNumber: 4,
        layout: "point",
        meta: { points: pts.map(([x, y]) => `${x},${y}`) },
    };
    step += 1;
    yield {
        stepNumber: step,
        entities: [...base(), ...pts.map((s, i) => ptNode(`x-${i}`, s, `X${i}(${s})`, "sorted"))],
        edges: [],
        description: `Verified: |X−C0|=${Math.hypot(pts[0][0] - c0[0], pts[0][1] - c0[1]).toFixed(2)} (r0=${r0}).`,
        codeLineNumber: 5,
        layout: "point",
        meta: { points: pts.map(([x, y]) => `${x},${y}`) },
    };
}

const module: AlgorithmModule = {
    education: {
        "intuition": "Two circles meet where both of their equations hold. Subtracting the equations gives a radical line on which every intersection must lie, so projecting back onto one circle yields zero, one, or two points depending on how far apart the centers are.",
        "invariants": [
            "Every reported point is exactly r0 from the first center and r1 from the second.",
            "The intersection points are symmetric about the line joining the centers.",
            "Two distinct circles have at most two intersection points."
        ],
        "correctness": "Let d be the center distance. With the origin at the first center and the x-axis pointing at the second, a = (r0^2 - r1^2 + d^2)/(2d) locates the radical line and h^2 = r0^2 - a^2 gives the half-chord. A negative h^2 means the circles are disjoint or nested, zero means tangency, and a positive value gives the two points (a, +h) and (a, -h), both satisfying the original equations. Rotating back to world coordinates completes the solution.",
        "complexityRationale": "A fixed number of arithmetic operations are performed regardless of input size, so time is O(1). Only a constant number of coordinates are stored, so space is O(1).",
        "uses": [
            "Computing the overlap of two circular sensor ranges",
            "Circle collision detection in games",
            "Constructing lens and Venn diagram geometry"
        ],
        "references": [
            "Weisstein, Circle-Circle Intersection, MathWorld",
            "O'Rourke, Computational Geometry in C, Section 6.4"
        ],
        "workedExample": "Circle 0 is centered at (0,0) with radius 2 and circle 1 at (3,0) with radius 2. Then d = 3, a = (4 - 4 + 9)/6 = 1.5, and h^2 = 4 - 2.25 = 1.75, so the intersections are (1.5, 1.3229) and (1.5, -1.3229)."
    },

    id: "circle-circle-intersection-points",
    name: "Circle–Circle Intersection",
    category: "geometry",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { c0: [0, 0], r0: 3, c1: [4, 0], r1: 3 },
    visualType: "graph",
    run,
    pseudocode: [
        "start from two centers and radii, measure center distance d",
        "when concentric: zero or infinitely many crossings",
        "walk distance a along the center line to the base point",
        "when a falls outside both radii: the circles miss",
        "rise height h perpendicular to the center line",
        "done: base plus or minus h gives one tangent or two crossings",
    ],
};

export default module;
