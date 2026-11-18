/**
 * chan-convex-hull.ts - Chan's convex hull algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Chan's algorithm combines Graham scan with gift wrapping to get an output
 * sensitive O(n log h) hull. It partitions the n points into groups of about
 * sqrt(n), builds a convex hull for each small group, and then wraps around
 * the whole set by repeatedly finding, for every group hull, the tangent from
 * the current hull vertex and choosing the best of those tangents. Each wrap
 * step touches every group once instead of every point.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log h) with binary tangents; O(n log n) for these small groups
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Group hull vertices are highlighted while each mini hull is built.
 *   - The current wrap vertex is active and the chosen tangent is green.
 *   - The final hull is drawn as a closed path.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

/** Orientation of (o, a, b): positive is a left turn. */
function cross(o: Pt, a: Pt, b: Pt): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

/** Squared distance between two points. */
function dist2(a: Pt, b: Pt): number {
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

/** Build point nodes; logical y is negated so the plot reads in math orientation. */
function nodes(points: Pt[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return points.map(([x, y], index) => ({
        id: `p-${index}`,
        type: "node" as const,
        label: `${index}`,
        value: [x, y],
        state: states.get(index) ?? "unvisited",
        x,
        y: -y,
        width: 0,
        height: 0,
        metadata: { x, y, index },
    }));
}

/** Path edges over the supplied ordered indices, optionally closed. */
function pathEdges(order: number[], closed: boolean, prefix: string): VisualEdge[] {
    const edges: VisualEdge[] = [];
    const count = order.length;
    for (let i = 0; i < count - (closed ? 0 : 1); i += 1) {
        const from = order[i];
        const to = order[(i + 1) % count];
        if (from === undefined || to === undefined) {
            continue;
        }
        edges.push({
            id: `${prefix}-${from}-${to}-${i}`,
            sourceId: `p-${from}`,
            targetId: `p-${to}`,
            label: "",
            state: closed ? "path" : "active",
            directed: false,
        });
    }
    return edges;
}

/** The Chan convex hull generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[] } | null) ?? {};
    const points: Pt[] = (task.points ?? [
        [0, 0],
        [3, 1],
        [1, 2],
        [4, 3],
        [2, 4],
        [5, 0],
        [0, 5],
        [6, 2],
        [3, 5],
    ]).map((p) => [p[0], p[1]] as Pt);

    let step = 0;
    const emit = (
        states: Map<number, EntityState>,
        edges: VisualEdge[],
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean | Array<number | string>>,
    ): VisualFrame => ({
        stepNumber: step++,
        entities: nodes(points, states),
        edges,
        description,
        codeLineNumber,
        layout: "point",
        meta,
    });

    if (points.length <= 1) {
        yield emit(
            new Map(),
            [],
            points.length === 0 ? "Chan: no points, so the hull is empty." : "Chan: one point is its own hull.",
            0,
            { hull: points.map((_, i) => i), groups: 0 },
        );
        return;
    }

    const groupSize = Math.max(2, Math.ceil(Math.sqrt(points.length)));
    const groups: number[][] = [];
    for (let i = 0; i < points.length; i += groupSize) {
        groups.push(points.slice(i, i + groupSize).map((_, offset) => i + offset));
    }

    // Monotone chain builds one group's extreme vertices in CCW order.
    const groupHull = (indices: number[]): number[] => {
        const sorted = [...indices].sort(
            (a, b) => (points[a] as Pt)[0] - (points[b] as Pt)[0] || (points[a] as Pt)[1] - (points[b] as Pt)[1],
        );
        const lower: number[] = [];
        const upper: number[] = [];
        for (const idx of sorted) {
            while (
                lower.length >= 2 &&
                cross(
                    points[lower[lower.length - 2] as number] as Pt,
                    points[lower[lower.length - 1] as number] as Pt,
                    points[idx] as Pt,
                ) <= 0
            ) {
                lower.pop();
            }
            lower.push(idx);
        }
        for (const idx of [...sorted].reverse()) {
            while (
                upper.length >= 2 &&
                cross(
                    points[upper[upper.length - 2] as number] as Pt,
                    points[upper[upper.length - 1] as number] as Pt,
                    points[idx] as Pt,
                ) <= 0
            ) {
                upper.pop();
            }
            upper.push(idx);
        }
        return [...lower.slice(0, -1), ...upper.slice(0, -1)];
    };

    yield emit(
        new Map(),
        [],
        `Chan: split ${points.length} points into ${groups.length} groups of at most ${groupSize}.`,
        1,
        { groups: groups.length, groupSize },
    );

    const groupHulls: number[][] = [];
    for (let g = 0; g < groups.length; g += 1) {
        const hull = groupHull(groups[g] as number[]);
        groupHulls.push(hull);
        const states = new Map<number, EntityState>();
        for (const idx of groups[g] as number[]) {
            states.set(idx, hull.includes(idx) ? "sorted" : "unvisited");
        }
        yield emit(
            states,
            pathEdges(hull, true, `g${g}`),
            `Chan: group ${g} has a mini hull of ${hull.length} vertex(es).`,
            2,
            { group: g, groupHull: hull },
        );
    }

    // Leftmost point (tie: lower y) starts the wrap.
    let start = 0;
    for (let i = 1; i < points.length; i += 1) {
        const p = points[i] as Pt;
        const s = points[start] as Pt;
        if (p[0] < s[0] || (p[0] === s[0] && p[1] < s[1])) {
            start = i;
        }
    }

    // Pick the better gift-wrap candidate: all other points must lie to its left.
    const better = (current: number, a: number, b: number): number => {
        if (a < 0) {
            return b;
        }
        if (b < 0 || b === current) {
            return a;
        }
        if (a === current) {
            return b;
        }
        const turn = cross(points[current] as Pt, points[a] as Pt, points[b] as Pt);
        if (turn < 0) {
            return b;
        }
        if (turn > 0) {
            return a;
        }
        return dist2(points[current] as Pt, points[b] as Pt) > dist2(points[current] as Pt, points[a] as Pt)
            ? b
            : a;
    };

    const hull: number[] = [start];
    let current = start;
    for (let iteration = 0; iteration < points.length; iteration += 1) {
        let best = -1;
        for (const gh of groupHulls) {
            for (const q of gh) {
                best = better(current, best, q);
            }
        }
        if (best < 0 || best === start) {
            break;
        }
        const states = new Map<number, EntityState>([
            [current, "active"],
            [best, "sorted"],
        ]);
        yield emit(
            states,
            pathEdges(hull, false, "wrap"),
            `Chan: wrap from ${current} chooses tangent ${best}.`,
            3,
            { from: current, tangent: best, hullSoFar: [...hull] },
        );
        hull.push(best);
        current = best;
    }

    const finalStates = new Map<number, EntityState>();
    for (const idx of hull) {
        finalStates.set(idx, "sorted");
    }
    yield emit(
        finalStates,
        pathEdges(hull, hull.length > 2, "final"),
        `Chan: the wrapped hull has ${hull.length} extreme point(s).`,
        5,
        { hull, groups: groups.length, groupSize },
    );
}

/** The Chan convex hull module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Chan's algorithm gets the best of two worlds. Building a full hull is O(n log n) and plain gift wrapping is O(n h), so Chan splits the points into small groups, hulls each group once, and then wraps around using only the group hulls. Because the number of groups is small, each wrap step is cheap and the total depends on the number of hull vertices actually found.",
        invariants: [
            "Every group hull contains exactly the extreme points of its group.",
            "The wrap always advances to a point with all remaining hulls on its left.",
            "The current point is a vertex of the final convex hull.",
        ],
        correctness:
            "A tangent from an external point to a convex group hull is a group vertex, so the best tangent over all groups is the same vertex that ordinary gift wrapping would pick from the whole set. Gift wrapping is known to produce the convex hull, and Chan's shortcut selects that identical next vertex at each step, so the wrapped polygon is the true hull.",
        complexityRationale:
            "There are about sqrt(n) groups, each hulled in O(m log m) with m about sqrt(n), for O(n log n) total preprocessing. This teaching version finds each tangent by scanning a small group hull, so a wrap of h steps costs O(n h) here; the textbook O(n log h) bound replaces that scan with a binary search on each sorted group hull. Storing the groups and their hulls uses O(n) space.",
        uses: [
            "Output-sensitive hull computation when the hull is much smaller than the point set",
            "A canonical example of combining two simpler algorithms for a better bound",
            "Preprocessing for geometric range searching and shape analysis",
        ],
        references: [
            "Chan, Optimal Output-Sensitive Convex Hull Algorithms in Two and Three Dimensions, 1996",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 1",
        ],
        workedExample:
            "For nine points split into groups of three, each group's mini hull drops any interior point. Wrapping starts at the leftmost point, queries the three mini hulls for their tangents, and takes the most clockwise of the three. Repeating visits each top and bottom corner once and closes when the start is chosen again.",
    },
    id: "chan-convex-hull",
    name: "Chan's Convex Hull",
    category: "geometry",
    complexity: { time: "O(n log h)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [3, 1],
            [1, 2],
            [4, 3],
            [2, 4],
            [5, 0],
            [0, 5],
            [6, 2],
            [3, 5],
        ],
    },
    visualType: "point",
    run,
    pseudocode: [
        "set group size m to ceil of the square root of n",
        "partition the points into groups of at most m",
        "build a sorted convex hull for every group",
        "start the wrap at the leftmost point",
        "for each group find the tangent from the current vertex",
        "choose the tangent with all groups to its left and advance",
        "stop when the wrap selects the start again",
        "the visited vertices form the convex hull",
    ],
};

export default module;
