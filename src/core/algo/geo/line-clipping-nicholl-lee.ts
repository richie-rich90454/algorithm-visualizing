/**
 * line-clipping-nicholl-lee.ts - Nicholl-Lee-Nicholl Line Clipping
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Nicholl-Lee-Nicholl algorithm clips a line segment against an axis-
 * aligned rectangle without repeatedly chopping the segment as Cohen-
 * Sutherland does. It classifies the first endpoint into one of eight angular
 * regions around the window, then compares the segment's direction with the
 * window corners to decide in a single pass which boundary is the entry edge
 * and which is the exit edge. For a segment that straddles the window this
 * yields the clipped endpoints with no iteration.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per segment
 *   Space: O(1) besides the displayed frames
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The four window corners are POINT nodes joined by idle edges.
 *   - The original segment endpoints are nodes; the segment is an edge.
 *   - Entry and exit candidates are HIGHLIGHT; the clipped segment is PATH.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
type Window = { xmin: number; ymin: number; xmax: number; ymax: number };
type Edge = "top" | "right" | "bottom" | "left";

/** Region 0 is inside; 1..8 go clockwise from above the window. */
const REGION_EDGES: Edge[][] = [
    [],
    ["top", "right", "left"],
    ["top", "right"],
    ["right", "top", "bottom"],
    ["right", "bottom"],
    ["bottom", "right", "left"],
    ["bottom", "left"],
    ["left", "top", "bottom"],
    ["left", "top"],
];
const REGION_NAMES = [
    "inside",
    "above",
    "upper right",
    "right",
    "lower right",
    "below",
    "lower left",
    "left",
    "upper left",
];

function regionOf(p: Pt, w: Window): number {
    const left = p[0] < w.xmin;
    const right = p[0] > w.xmax;
    const below = p[1] < w.ymin;
    const above = p[1] > w.ymax;
    if (!left && !right && !below && !above) {
        return 0;
    }
    if (above && !left && !right) return 1;
    if (above && right) return 2;
    if (right && !above && !below) return 3;
    if (below && right) return 4;
    if (below && !left && !right) return 5;
    if (below && left) return 6;
    if (left && !above && !below) return 7;
    return 8;
}

/** Intersection of segment from->to with one window boundary, if it lies on that edge. */
function hit(from: Pt, to: Pt, edge: Edge, w: Window): Pt | null {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    let t: number;
    if (edge === "top" || edge === "bottom") {
        if (Math.abs(dy) < 1e-12) return null;
        t = ((edge === "top" ? w.ymax : w.ymin) - from[1]) / dy;
    } else {
        if (Math.abs(dx) < 1e-12) return null;
        t = ((edge === "left" ? w.xmin : w.xmax) - from[0]) / dx;
    }
    if (t < -1e-9 || t > 1 + 1e-9) return null;
    const x = from[0] + t * dx;
    const y = from[1] + t * dy;
    const eps = 1e-9;
    if (edge === "top" || edge === "bottom") {
        if (x < w.xmin - eps || x > w.xmax + eps) return null;
    } else {
        if (y < w.ymin - eps || y > w.ymax + eps) return null;
    }
    return [x, y];
}

/** First boundary the ray from->to reaches, according to the NLN region order. */
function firstHit(from: Pt, to: Pt, w: Window): Pt | null {
    const region = regionOf(from, w);
    const edges = REGION_EDGES[region] ?? [];
    for (const edge of edges) {
        const point = hit(from, to, edge, w);
        if (point) return point;
    }
    return null;
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
        metadata: { x: p[0], y: p[1] },
    };
}

function edge(id: string, sourceId: string, targetId: string, state: EntityState): VisualEdge {
    return { id, sourceId, targetId, label: "", state, directed: false };
}

/** Classify endpoints, choose entry and exit, and emit the clipped segment. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        p0?: Pt; p1?: Pt; window?: Window;
    } | null) ?? {};
    const p0: Pt = task.p0 ?? [-2, 5];
    const p1: Pt = task.p1 ?? [12, 3];
    const w: Window = task.window ?? { xmin: 0, ymin: 0, xmax: 10, ymax: 8 };

    const corners: Pt[] = [[w.xmin, w.ymax], [w.xmax, w.ymax], [w.xmax, w.ymin], [w.xmin, w.ymin]];
    const windowNodes = corners.map((p, i) => node(`corner-${i}`, p, "idle", `w${i}`));
    const windowEdges = corners.map((_p, i) =>
        edge(`win-${i}`, `corner-${i}`, `corner-${(i + 1) % 4}`, "idle"));
    const endpoints = [node("p0", p0, "active", "p0"), node("p1", p1, "active", "p1")];
    const segmentEdge = edge("segment", "p0", "p1", "active");

    let step = 0;
    const region0 = regionOf(p0, w);
    const region1 = regionOf(p1, w);
    yield {
        stepNumber: step,
        entities: [...windowNodes, ...endpoints],
        edges: [...windowEdges, segmentEdge],
        description: `Clip segment p0-p1 against the window using Nicholl-Lee-Nicholl region tests.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { region0, region1, accepted: false },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: [...windowNodes, ...endpoints],
        edges: [...windowEdges, segmentEdge],
        description: `p0 lies ${REGION_NAMES[region0] ?? "outside"}; p1 lies ${REGION_NAMES[region1] ?? "outside"}.`,
        codeLineNumber: 1,
        layout: "point",
        meta: { region0, region1, accepted: false },
    };
    step += 1;

    const inside0 = region0 === 0;
    const inside1 = region1 === 0;
    const entry = inside0 ? p0 : firstHit(p0, p1, w);
    yield {
        stepNumber: step,
        entities: [
            ...windowNodes,
            ...endpoints,
            ...(entry && !inside0 ? [node("entry", entry, "highlight", "in")] : []),
        ],
        edges: [...windowEdges, segmentEdge],
        description: entry
            ? `Entry boundary found at (${entry[0].toFixed(2)}, ${entry[1].toFixed(2)}).`
            : "No entry boundary exists for the first endpoint.",
        codeLineNumber: 2,
        layout: "point",
        meta: { region0, region1, entry: entry ? [entry[0], entry[1]] : [], accepted: false },
    };
    step += 1;

    const exit = inside1 ? p1 : firstHit(p1, p0, w);
    yield {
        stepNumber: step,
        entities: [
            ...windowNodes,
            ...endpoints,
            ...(entry && !inside0 ? [node("entry", entry, "highlight", "in")] : []),
            ...(exit && !inside1 ? [node("exit", exit, "highlight", "out")] : []),
        ],
        edges: [...windowEdges, segmentEdge],
        description: exit
            ? `Exit boundary found at (${exit[0].toFixed(2)}, ${exit[1].toFixed(2)}).`
            : "No exit boundary exists for the second endpoint.",
        codeLineNumber: 3,
        layout: "point",
        meta: {
            region0,
            region1,
            entry: entry ? [entry[0], entry[1]] : [],
            exit: exit ? [exit[0], exit[1]] : [],
            accepted: false,
        },
    };
    step += 1;

    const accepted = entry !== null && exit !== null;
    const finalEntities = [
        ...windowNodes,
        ...endpoints,
        ...(accepted ? [
            node("clipped-a", entry as Pt, "path", "a"),
            node("clipped-b", exit as Pt, "path", "b"),
        ] : []),
    ];
    const finalEdges = [
        ...windowEdges,
        ...(accepted
            ? [edge("clipped", "clipped-a", "clipped-b", "path")]
            : [edge("rejected", "p0", "p1", "error")]),
    ];
    yield {
        stepNumber: step,
        entities: finalEntities,
        edges: finalEdges,
        description: accepted
            ? `Segment accepted: clipped from (${(entry as Pt)[0].toFixed(2)}, ${(entry as Pt)[1].toFixed(2)}) to (${(exit as Pt)[0].toFixed(2)}, ${(exit as Pt)[1].toFixed(2)}).`
            : "Segment lies completely outside the window and is rejected.",
        codeLineNumber: 4,
        layout: "point",
        meta: {
            region0,
            region1,
            entry: entry ? [entry[0], entry[1]] : [],
            exit: exit ? [exit[0], exit[1]] : [],
            accepted,
        },
    };
}

/** The Nicholl-Lee-Nicholl clipping module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Cohen-Sutherland repeatedly cuts a segment against one boundary at a time. Nicholl-Lee-Nicholl instead asks where the first endpoint sits among eight angular regions around the rectangle, and uses slope comparisons with the corners to name the exact entry and exit edges immediately. For a segment that crosses the window, one pass determines both clipped endpoints.",
        invariants: [
            "The eight regions partition the plane outside the window.",
            "An entry candidate always lies on a window boundary and within that boundary's extent.",
            "For a convex window the segment intersects it exactly when both an entry and an exit exist.",
        ],
        correctness:
            "The region of the first endpoint restricts which boundaries the segment can cross before entering the rectangle, and the ordered candidate list tests those boundaries in angular order. A valid intersection with one of them is by construction the first crossing, hence the true entry point. Repeating the test from the second endpoint toward the first yields the exit. A convex set is intersected in a single interval, so accepting exactly when both points exist reproduces the correct clipped segment.",
        complexityRationale:
            "Region classification and at most three boundary-line evaluations per endpoint use a fixed number of arithmetic operations, so time and space are both O(1) for a single segment.",
        uses: [
            "Viewport culling of line primitives in a renderer",
            "Clipping map features to a visible rectangular extent",
            "Teaching direct parametric clipping without iterative subdivision",
        ],
        references: [
            "Nicholl, Lee and Nicholl, An Efficient New Algorithm for 2-D Line Clipping, 1987",
            "Foley, van Dam, Feiner and Hughes, Computer Graphics: Principles and Practice",
        ],
        workedExample:
            "For p0 = (-2, 5) and p1 = (12, 3) with a window from (0,0) to (10,8), p0 is in the left region. The first valid boundary is x = 0 at y about 4.43, and from p1 the first valid boundary is x = 10 at y about 3.29, so the clipped segment runs between those two points.",
    },
    id: "line-clipping-nicholl-lee",
    name: "Nicholl-Lee-Nicholl Line Clipping",
    category: "geometry",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: {
        p0: [-2, 5],
        p1: [12, 3],
        window: { xmin: 0, ymin: 0, xmax: 10, ymax: 8 },
    },
    visualType: "point",
    run,
    pseudocode: [
        "classify each endpoint into one of nine regions",
        "list the candidate entry boundaries for the first region",
        "test each candidate in order and keep the first valid hit",
        "repeat from the second endpoint to find the exit",
        "accept only when both an entry and an exit exist",
        "draw the clipped segment between the two hits",
    ],
};

export default module;
