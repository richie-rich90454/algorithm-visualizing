/**
 * divide-conquer-convex-hull.ts - Divide-and-Conquer Convex Hull
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Sorts the points by x, recursively computes the lower and upper hulls of
 * each half, then merges the two hulls with the monotone-chain pop rule. The
 * merge is linear, so the recurrence T(n) = 2T(n/2) + O(n) gives O(n log n).
 * This is the Preparata-Hong divide-and-conquer hull, distinct from the
 * incremental, gift-wrapping, Graham-scan, and Chan hulls already cataloged.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n)   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Points are nodes; the current hull is a closed cycle of edges.
 *   - Points on the hull are GREEN; interior points stay GRAY.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makePointNodes } from "./geo-util";

type Point = [number, number];

/** Twice the signed area of the triangle (a, b, c); positive for a left turn. */
function cross(a: Point, b: Point, c: Point): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Andrew pop rule applied to an already x-sorted list. */
function chain(points: Point[]): Point[] {
    const hull: Point[] = [];
    for (const p of points) {
        while (hull.length >= 2 && cross(hull[hull.length - 2] as Point, hull[hull.length - 1] as Point, p) <= 0) {
            hull.pop();
        }
        hull.push(p);
    }
    return hull;
}

/** Recursively build a lower hull of an x-sorted point list. */
function lower(points: Point[]): Point[] {
    if (points.length <= 1) {
        return points.slice();
    }
    const mid = Math.floor(points.length / 2);
    const left = lower(points.slice(0, mid));
    const right = lower(points.slice(mid));
    return chain(left.concat(right));
}

/** Recursively build an upper hull of an x-sorted point list. */
function upper(points: Point[]): Point[] {
    if (points.length <= 1) {
        return points.slice();
    }
    const mid = Math.floor(points.length / 2);
    const left = upper(points.slice(0, mid));
    const right = upper(points.slice(mid));
    return chain(left.concat(right).slice().reverse()).reverse();
}

/** Build hull entities: green for hull points, gray for the rest. */
function makeFrame(
    points: Point[],
    hull: Point[],
    step: number,
    codeLine: number,
    description: string,
    extra: Record<string, number | string | boolean | Array<number | string>> = {},
): VisualFrame {
    const onHull = new Set(hull.map((p) => `${p[0]},${p[1]}`));
    const entities: VisualEntity[] = makePointNodes(points).map((e) => {
        const p = e.value as Point;
        const state: EntityState = onHull.has(`${p[0]},${p[1]}`) ? "sorted" : "unvisited";
        return { ...e, state };
    });
    const edges: VisualEdge[] = [];
    if (hull.length >= 3) {
        for (let i = 0; i < hull.length; i += 1) {
            const a = hull[i] as Point;
            const b = hull[(i + 1) % hull.length] as Point;
            edges.push({
                id: `hull-edge-${i}`,
                sourceId: `point-${points.findIndex((p) => p[0] === a[0] && p[1] === a[1])}`,
                targetId: `point-${points.findIndex((p) => p[0] === b[0] && p[1] === b[1])}`,
                label: "",
                state: "path",
                directed: false,
            });
        }
    }
    return {
        stepNumber: step,
        entities,
        edges,
        description,
        codeLineNumber: codeLine,
        layout: "point",
        meta: { hullSize: hull.length, ...extra },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[] } | null) ?? {};
    const points: Point[] = (task.points ?? [
        [0, 0], [4, 0], [5, 3], [2, 5], [-1, 3], [1, 2], [3, 1], [2, 2],
    ]).map((p) => [p[0], p[1]] as Point);
    let step = 0;

    if (points.length < 3) {
        yield makeFrame(points, points.slice(), step, 0, "Fewer than three points: every point is on the hull.", { degenerate: true });
        return;
    }

    yield makeFrame(points, [], step, 0, `Starting divide-and-conquer hull on ${points.length} points.`);
    step += 1;

    const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    yield makeFrame(points, [], step, 1, "Points sorted lexicographically by x, then y.", { sorted: true });
    step += 1;

    const low = lower(sorted);
    yield makeFrame(points, low, step, 2, `Lower hull merged recursively: ${low.length} points.`, { phase: "lower" });
    step += 1;

    const up = upper(sorted);
    yield makeFrame(points, up, step, 3, `Upper hull merged recursively: ${up.length} points.`, { phase: "upper" });
    step += 1;

    const hull = low.concat(up.slice(1, -1).reverse());
    yield makeFrame(points, hull, step, 4, `Convex hull complete with ${hull.length} vertices after joining upper and lower chains.`, { complete: true, hullSize: hull.length });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Split the points by x-coordinate, find the convex hull of each half, then stitch the two hulls together. To stitch, keep only the points that make a left turn as you walk from left to right along the lower side and right to left along the upper side. Because the merge is linear and the split is balanced, the total work is O(n log n).",
        invariants: [
            "At every recursion level each sub-hull is convex and its points are sorted by x.",
            "The lower chain keeps only counter-clockwise turns, so it can never bow downward.",
            "The upper chain is the mirror image of the lower chain on reversed x-order.",
        ],
        correctness:
            "By induction, each recursive call returns the exact hull of its point subset. The merge of two x-separated convex lower hulls with the left-turn pop rule removes precisely the points that lie above the lower tangent, so the result is the lower hull of the union; the symmetric argument holds for the upper hull. Concatenating the two chains gives the full convex hull.",
        complexityRationale:
            "Sorting costs O(n log n). The merge at each level scans each point once, and there are O(log n) balanced levels, so the recurrence is T(n) = 2T(n/2) + O(n) = O(n log n). The recursion and hull arrays use O(n) space.",
        uses: [
            "Computing the shape of a set of geographic coordinates",
            "Collision-detection bounding shapes in game engines",
            "A preprocessing step for diameter and rotating-calipers computations",
        ],
        references: [
            "Preparata and Hong, Convex Hulls of Finite Sets of Points in Two and Three Dimensions, 1977",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 1",
        ],
        workedExample:
            "For points (0,0), (4,0), (5,3), (2,5), (-1,3), (1,2), (3,1), (2,2), the lower chain keeps (-1,3), (0,0), (4,0), (5,3) and the upper chain keeps (5,3), (2,5), (-1,3). Joining them drops the duplicated endpoints and yields the five-vertex hull.",
    },
    id: "divide-conquer-convex-hull",
    name: "Divide-and-Conquer Convex Hull",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        points: [[0, 0], [4, 0], [5, 3], [2, 5], [-1, 3], [1, 2], [3, 1], [2, 2]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "sort points lexicographically by x then y",
        "recursively split the sorted points into left and right halves",
        "merge the lower hulls with the left-turn pop rule",
        "merge the upper hulls on reversed x-order with the same rule",
        "drop the shared leftmost and rightmost endpoints from the upper chain",
        "concatenate the lower chain with the reversed upper interior",
        "done: report the hull vertices in counter-clockwise order",
    ],
};

export default module;
