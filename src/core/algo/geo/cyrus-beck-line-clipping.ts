/**
 * cyrus-beck-line-clipping.ts - Parametric line clipping against a convex polygon.
 *
 * The segment p0 + t*(p1-p0) is clipped to the intersection of the half-planes
 * defined by the polygon edges. Each edge contributes a lower or upper bound
 * on t; the surviving interval is the clipped segment.
 *
 * Time: O(n) for n polygon edges. Space: O(1) besides the frames.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function signedArea(pts: Pt[]): number {
    let area = 0;
    for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i] as Pt;
        const b = pts[(i + 1) % pts.length] as Pt;
        area += a[0] * b[1] - b[0] * a[1];
    }
    return area / 2;
}

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

function polygonEdges(pts: Pt[], highlight = -1): VisualEdge[] {
    return pts.map((_, i) => ({
        id: `poly-${i}`,
        sourceId: `v-${i}`,
        targetId: `v-${(i + 1) % pts.length}`,
        label: "",
        state: (i === highlight ? "active" : "path") as EntityState,
        directed: false,
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { polygon?: Pt[]; from?: Pt; to?: Pt } | null) ?? {};
    const given: Pt[] = task.polygon ?? [
        [1, 1],
        [7, 1],
        [8, 5],
        [4, 7],
        [1, 4],
    ];
    const pts: Pt[] = signedArea(given) < 0 ? [...given].reverse() : given;
    const p0: Pt = task.from ?? [-1, 3];
    const p1: Pt = task.to ?? [10, 4];
    const d: Pt = [p1[0] - p0[0], p1[1] - p0[1]];

    let t0 = 0;
    let t1 = 1;
    let rejected = false;
    let step = 0;

    const baseEntities = (highlight: number, clipped: boolean): VisualEntity[] => {
        const entities = [
            ...pts.map((p, i) => node(`v-${i}`, p, i === highlight ? "highlight" : "unvisited", String(i))),
            node("p0", p0, "pivot", "p0"),
            node("p1", p1, "pivot", "p1"),
        ];
        if (clipped && t0 <= t1) {
            entities.push(
                node("c-start", [p0[0] + t0 * d[0], p0[1] + t0 * d[1]], "sorted", "A"),
                node("c-end", [p0[0] + t1 * d[0], p0[1] + t1 * d[1]], "sorted", "B"),
            );
        }
        return entities;
    };
    const clippedEdge = (clipped: boolean): VisualEdge[] =>
        clipped && t0 <= t1
            ? [
                  {
                      id: "clipped",
                      sourceId: "c-start",
                      targetId: "c-end",
                      label: "",
                      state: "path" as EntityState,
                      directed: false,
                  },
              ]
            : [];

    yield {
        stepNumber: step,
        entities: baseEntities(-1, false),
        edges: [...polygonEdges(pts), { id: "input", sourceId: "p0", targetId: "p1", label: "", state: "active" as EntityState, directed: true }],
        description: `Clipping segment against a ${pts.length}-edge convex polygon.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { t0, t1, rejected },
    };
    step += 1;

    for (let i = 0; i < pts.length; i += 1) {
        const a = pts[i] as Pt;
        const b = pts[(i + 1) % pts.length] as Pt;
        const e: Pt = [b[0] - a[0], b[1] - a[1]];
        const n: Pt = [e[1], -e[0]]; // outward normal for a counter-clockwise polygon
        const denom = n[0] * d[0] + n[1] * d[1];
        // Inside means n dot (p0 + t*d - a) <= 0, i.e. numer + t*denom <= 0.
        const numer = n[0] * (p0[0] - a[0]) + n[1] * (p0[1] - a[1]);
        const EPS = 1e-12;
        if (Math.abs(denom) < EPS) {
            if (numer > EPS) rejected = true;
        } else {
            const t = -numer / denom;
            if (denom < 0) t0 = Math.max(t0, t);
            else t1 = Math.min(t1, t);
        }
        const clipped = !rejected && t0 <= t1;
        yield {
            stepNumber: step,
            entities: baseEntities(i, clipped),
            edges: [
                ...polygonEdges(pts, i),
                { id: "input", sourceId: "p0", targetId: "p1", label: "", state: "comparing" as EntityState, directed: true },
                ...clippedEdge(clipped),
            ],
            description: `Edge ${i}: t in [${t0.toFixed(3)}, ${t1.toFixed(3)}]${rejected ? ", segment rejected" : ""}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { t0, t1, rejected, edge: i },
        };
        step += 1;
    }

    const clipped = !rejected && t0 <= t1;
    yield {
        stepNumber: step,
        entities: baseEntities(-1, clipped),
        edges: [...polygonEdges(pts), ...clippedEdge(clipped)],
        description: clipped
            ? `Done: clipped to t in [${t0.toFixed(3)}, ${t1.toFixed(3)}].`
            : "Done: the segment lies entirely outside the polygon.",
        codeLineNumber: 6,
        layout: "point",
        meta: { t0, t1, rejected, clipped },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of repeatedly chopping a line against each edge, Cyrus-Beck writes the segment as a point plus a parameter t and turns every polygon half-plane into a bound on t. Edges the segment enters raise the lower bound; edges it leaves lower the upper bound. What survives is the clipped piece.",
        invariants: [
            "Every point with t between the current lower and upper bound is inside every edge processed so far.",
            "The lower bound only increases and the upper bound only decreases.",
            "An edge parallel to the segment either accepts it entirely or rejects it outright.",
        ],
        correctness:
            "A point is inside a convex polygon exactly when it lies on the interior side of every edge, which is a linear inequality in t. Intersecting all those intervals yields one interval [t0, t1], and every point with t in that interval satisfies every constraint while no point outside does. Parallel edges with the point on the outside have an empty intersection and are reported as fully clipped, so the returned segment is precisely the original segment intersected with the polygon.",
        complexityRationale:
            "Each of the n edges contributes one dot product and one bound update, so the running time is O(n) with O(1) working variables beyond the frame history.",
        uses: [
            "Clipping lines and segments in vector graphics pipelines",
            "Viewport culling in game and CAD renderers",
            "Trimming ray-cast beams against convex colliders",
        ],
        references: [
            "Cyrus and Beck, Generalized Two- and Three-Dimensional Clipping, Computers & Graphics, 1978",
            "Foley et al., Computer Graphics: Principles and Practice, Chapter 11",
        ],
        workedExample:
            "For the unit square and the segment from (-1, 0.5) to (2, 0.5), the left edge sets the lower bound to 0.5 and the right edge sets the upper bound to 0.5, so the clipped segment runs from (0, 0.5) to (1, 0.5).",
    },
    id: "cyrus-beck-line-clipping",
    name: "Cyrus-Beck Line Clipping",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: {
        polygon: [
            [1, 1],
            [7, 1],
            [8, 5],
            [4, 7],
            [1, 4],
        ],
        from: [-1, 3],
        to: [10, 4],
    },
    visualType: "point",
    run,
    pseudocode: [
        "write the segment as p0 plus t times direction",
        "start with the interval t in zero to one",
        "for each convex polygon edge",
        "form the half-plane inequality in t",
        "raise the lower bound or lower the upper bound",
        "reject the segment if a parallel edge excludes it",
        "done: report the surviving clipped interval",
    ],
};

export default module;
