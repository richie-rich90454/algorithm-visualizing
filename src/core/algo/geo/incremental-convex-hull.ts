/**
 * incremental-convex-hull.ts - Incremental (Online) Convex Hull
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The incremental hull inserts points one at a time into an existing convex
 * polygon in counterclockwise order. For a new point, the hull edges whose
 * supporting line leaves the point on the outside form one contiguous chain.
 * Replacing that chain with the new point splices it into the hull in O(h)
 * time for a hull of h vertices, giving O(nh) total for n insertions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * h) for n insertions into a hull of at most h vertices
 *   Space: O(n) for the hull vertex list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - All inserted points are nodes; current hull vertices are GREEN.
 *   - The point being inserted is ACTIVE and its visible edges turn RED.
 *   - Hull edges are drawn as connections between hull vertices.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

/** Cross product of (a, b, c). */
function cross(a: Point, b: Point, c: Point): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Monotone-chain hull over a list of point indices (used as a safe fallback). */
function hullOfIndices(points: Point[], indices: number[]): number[] {
    const sorted = indices.slice().sort((i, j) => {
        const pi = points[i] as Point;
        const pj = points[j] as Point;
        return pi[0] - pj[0] || pi[1] - pj[1];
    });
    const build = (seq: number[]): number[] => {
        const stack: number[] = [];
        for (const idx of seq) {
            while (stack.length >= 2) {
                const a = points[stack[stack.length - 2] as number] as Point;
                const b = points[stack[stack.length - 1] as number] as Point;
                const c = points[idx] as Point;
                if (cross(a, b, c) <= 0) {
                    stack.pop();
                } else {
                    break;
                }
            }
            stack.push(idx);
        }
        return stack;
    };
    const lower = build(sorted);
    const upper = build(sorted.slice().reverse());
    return [...lower, ...upper.slice(1, -1)];
}

/** Insert one point index into a counterclockwise hull of point indices. */
function insertPoint(hull: number[], point: number, points: Point[]): number[] {
    if (hull.length === 0) {
        return [point];
    }
    if (hull.length === 1) {
        return hull[0] === point ? hull.slice() : [hull[0] as number, point];
    }
    if (hull.length === 2) {
        const a = points[hull[0] as number] as Point;
        const b = points[hull[1] as number] as Point;
        const c = points[point] as Point;
        const turn = cross(a, b, c);
        if (turn > 0) {
            return [hull[0] as number, hull[1] as number, point];
        }
        if (turn < 0) {
            return [hull[0] as number, point, hull[1] as number];
        }
        const triple = [hull[0] as number, hull[1] as number, point].sort(
            (i, j) => (points[i] as Point)[0] - (points[j] as Point)[0] || (points[i] as Point)[1] - (points[j] as Point)[1],
        );
        return [triple[0] as number, triple[2] as number];
    }

    const h = hull.length;
    const visible: number[] = [];
    for (let i = 0; i < h; i += 1) {
        const a = points[hull[i] as number] as Point;
        const b = points[hull[(i + 1) % h] as number] as Point;
        const c = points[point] as Point;
        if (cross(a, b, c) < -1e-12) {
            visible.push(i);
        }
    }
    if (visible.length === 0) {
        return hull.slice();
    }
    if (visible.length >= h) {
        return hullOfIndices(points, [...hull, point]);
    }

    const visibleSet = new Set(visible);
    let start = -1;
    for (const i of visible) {
        if (!visibleSet.has((i - 1 + h) % h)) {
            start = i;
            break;
        }
    }
    if (start < 0) {
        return hullOfIndices(points, [...hull, point]);
    }
    const end = (start + visible.length) % h;

    const result: number[] = [hull[start] as number, point, hull[end] as number];
    let index = (end + 1) % h;
    while (index !== start) {
        result.push(hull[index] as number);
        index = (index + 1) % h;
    }
    return result;
}

/** Build nodes for all inserted points with hull states. */
function makeNodes(points: Point[], hull: number[], active = -1): VisualEntity[] {
    const hullSet = new Set(hull);
    return points.map(([x, y], index) => ({
        id: `p-${index}`,
        type: "node" as const,
        label: String(index),
        value: [x, y],
        state: (index === active
            ? "active"
            : hullSet.has(index)
              ? "sorted"
              : "unvisited") as VisualEntity["state"],
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index, onHull: hullSet.has(index) },
    }));
}

/** Build the current hull edges. */
function makeEdges(hull: number[]): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let i = 0; i < hull.length; i += 1) {
        edges.push({
            id: `hull-${i}`,
            sourceId: `p-${hull[i]}`,
            targetId: `p-${hull[(i + 1) % hull.length]}`,
            label: "",
            state: "path",
            directed: false,
        });
    }
    return edges;
}

/** The incremental convex hull generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[] } | null) ?? {};
    const points: Point[] = task.points ?? [
        [0, 3],
        [1, 1],
        [2, 2],
        [4, 4],
        [0, 0],
        [1, 2],
        [3, 1],
        [3, 3],
        [2, 4],
    ];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(points, []),
        edges: [],
        description: `Insert ${points.length} points one at a time into the growing hull.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { hull: [], inserted: 0 },
    };
    step += 1;

    let hull: number[] = [];
    for (let i = 0; i < points.length; i += 1) {
        hull = insertPoint(hull, i, points);
        yield {
            stepNumber: step,
            entities: makeNodes(points, hull, i),
            edges: makeEdges(hull),
            description: `Inserted point ${i}; the current hull has ${hull.length} vertices: [${hull.join(", ")}].`,
            codeLineNumber: hull.length <= 2 ? 1 : 4,
            layout: "point",
            meta: { hull: hull.slice(), inserted: i + 1 },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(points, hull),
        edges: makeEdges(hull),
        description: `Final hull after ${points.length} insertions: [${hull.join(", ")}].`,
        codeLineNumber: 5,
        layout: "point",
        meta: { hull: hull.slice(), inserted: points.length },
    };
}

/** The incremental convex hull module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "An online hull grows one point at a time. When a new point lies outside the current polygon, the edges it can see form a single contiguous chain along the boundary. Removing that chain and connecting the two tangent endpoints through the new point keeps the polygon convex and adds the point in time proportional to the chain length.",
        invariants: [
            "After each insertion the maintained polygon is convex and listed in counterclockwise order.",
            "A point inside the polygon leaves the hull unchanged.",
            "The visible edges of an outside point form one contiguous boundary chain.",
        ],
        correctness:
            "If the new point is inside or on the hull, no edge has it strictly outside and the polygon is already the hull of the enlarged set. Otherwise the visible edges are exactly those whose supporting line separates the point, and they form a contiguous chain because the polygon is convex; their endpoints are the two tangents from the point. Replacing the chain by the path through the new point removes precisely the vertices that became interior, so the result is the convex hull of the enlarged set.",
        complexityRationale:
            "Each insertion scans the h hull edges to find the visible chain and rebuilds the boundary in O(h). With n insertions and hull size at most n, the total is O(n * h), and storing the hull uses O(n) space.",
        uses: [
            "Maintaining a hull as streaming points arrive",
            "Dynamic geometric data structures",
            "Online collision and visibility preprocessing",
        ],
        references: [
            "Preparata and Shamos, Computational Geometry: An Introduction, Chapter 3",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 1",
        ],
        workedExample:
            "Inserting the corners of a square first gives the hull [0, 1, 2, 3]. Inserting an interior point changes nothing. Inserting a point beyond the right edge makes that single edge visible, so it is replaced by two edges through the new point, which becomes a new hull vertex.",
    },
    id: "incremental-convex-hull",
    name: "Incremental Convex Hull",
    category: "geometry",
    complexity: { time: "O(n * h)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 3],
            [1, 1],
            [2, 2],
            [4, 4],
            [0, 0],
            [1, 2],
            [3, 1],
            [3, 3],
            [2, 4],
        ],
    },
    visualType: "point",
    run,
    pseudocode: [
        "start with an empty hull",
        "insert the next point into the counterclockwise hull",
        "if fewer than three hull vertices, extend directly",
        "find the contiguous edge chain visible from the point",
        "if no edge is visible, the point is inside and the hull is unchanged",
        "replace the visible chain with the point and keep the hull convex",
        "done: report the final hull after all insertions",
    ],
};

export default module;
