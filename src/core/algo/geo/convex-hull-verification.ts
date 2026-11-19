/**
 * convex-hull-verification.ts - Convex Hull Verification
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a point set and a claimed hull polygon, verification checks two
 * conditions: every consecutive triple of claimed vertices turns left (so the
 * polygon is strictly convex in counterclockwise order), and every input
 * point lies on or to the left of each hull edge (so nothing is outside).
 * Both conditions together certify the claimed polygon is exactly the hull.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(h * n) for h claimed vertices and n input points
 *   Space: O(1) beyond the emitted frames
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - All input points are nodes; claimed hull vertices start ACTIVE.
 *   - A point found outside an edge is RED (error).
 *   - A verified hull turns every claimed vertex GREEN (sorted).
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

/** Cross product of (a, b, c). */
function cross(a: Point, b: Point, c: Point): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Build point nodes, marking the claimed hull and any offending point. */
function makeNodes(
    points: Point[],
    hull: number[],
    culprit = -1,
    verified = false,
): VisualEntity[] {
    const hullSet = new Set(hull);
    return points.map(([x, y], index) => ({
        id: `p-${index}`,
        type: "node" as const,
        label: String(index),
        value: [x, y],
        state: (index === culprit
            ? "error"
            : verified && hullSet.has(index)
              ? "sorted"
              : hullSet.has(index)
                ? "active"
                : "unvisited") as VisualEntity["state"],
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index, onHull: hullSet.has(index) },
    }));
}

/** Build hull outline edges. */
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

/** The convex hull verification generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[]; hull?: number[] } | null) ?? {};
    const points: Point[] = task.points ?? [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3],
        [2, 1],
    ];
    const hull: number[] = task.hull ?? [0, 1, 2, 3];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(points, hull),
        edges: makeEdges(hull),
        description: `Verify a claimed hull with ${hull.length} vertices over ${points.length} points.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { valid: false, reason: "pending", hull },
    };
    step += 1;

    // Check that the indices are valid and distinct.
    const distinct = new Set(hull);
    const indicesValid = hull.length >= 3 && distinct.size === hull.length && hull.every((i) => i >= 0 && i < points.length);
    if (!indicesValid) {
        yield {
            stepNumber: step,
            entities: makeNodes(points, hull, -1, false),
            edges: makeEdges(hull.filter((i) => i >= 0 && i < points.length)),
            description: `Invalid hull: indices must be distinct and within range, with at least three vertices.`,
            codeLineNumber: 1,
            layout: "point",
            meta: { valid: false, reason: "invalid-indices", hull },
        };
        return;
    }

    // Check strict convexity in counterclockwise order.
    for (let i = 0; i < hull.length; i += 1) {
        const a = points[hull[i] as number] ?? [0, 0];
        const b = points[hull[(i + 1) % hull.length] as number] ?? [0, 0];
        const c = points[hull[(i + 2) % hull.length] as number] ?? [0, 0];
        const turn = cross(a, b, c);
        yield {
            stepNumber: step,
            entities: makeNodes(points, hull, hull[i]),
            edges: makeEdges(hull),
            description: `Convexity at vertex ${hull[i]}: cross = ${turn} ${turn > 0 ? "is a left turn" : "is not a left turn"}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { valid: false, reason: "checking-convexity", hull, turn },
        };
        step += 1;
        if (turn <= 0) {
            yield {
                stepNumber: step,
                entities: makeNodes(points, hull, hull[i], false),
                edges: makeEdges(hull),
                description: `Invalid hull: vertex ${hull[i]} is not strictly convex.`,
                codeLineNumber: 5,
                layout: "point",
                meta: { valid: false, reason: "not-convex", hull, culprit: hull[i] },
            };
            return;
        }
    }

    // Check that no input point lies strictly outside any hull edge.
    for (let e = 0; e < hull.length; e += 1) {
        const a = points[hull[e] as number] ?? [0, 0];
        const b = points[hull[(e + 1) % hull.length] as number] ?? [0, 0];
        for (let p = 0; p < points.length; p += 1) {
            const point = points[p] ?? [0, 0];
            const side = cross(a, b, point);
            if (side < 0) {
                yield {
                    stepNumber: step,
                    entities: makeNodes(points, hull, p, false),
                    edges: makeEdges(hull),
                    description: `Invalid hull: point ${p} lies outside edge ${hull[e]}-${hull[(e + 1) % hull.length]}.`,
                    codeLineNumber: 5,
                    layout: "point",
                    meta: { valid: false, reason: "point-outside", hull, culprit: p },
                };
                return;
            }
        }
    }

    yield {
        stepNumber: step,
        entities: makeNodes(points, hull, -1, true),
        edges: makeEdges(hull),
        description: `Verified: the claimed polygon is exactly the convex hull of the point set.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { valid: true, reason: "verified", hull },
    };
}

/** The convex hull verification module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "To check a claimed convex hull we do not need to rebuild it. A polygon is the hull of a point set when it is strictly convex in counterclockwise order and every input point lies on or to the left of each of its directed edges. If either condition fails, the claim is refuted by a specific vertex or outside point.",
        invariants: [
            "A counterclockwise convex polygon has a positive cross product at every consecutive triple.",
            "For a counterclockwise hull edge, every point of the hull interior is on the left side.",
            "A point with a negative cross product on some edge is strictly outside the polygon.",
        ],
        correctness:
            "If the claimed polygon is strictly convex and contains every input point, then it is a convex polygon enclosing the set, and each of its vertices is a point of the set, so it must be the smallest such polygon up to collinear boundary points, which strict convexity excludes. Conversely a true hull satisfies both tests. Hence the verification accepts exactly the correct hulls.",
        complexityRationale:
            "The convexity pass inspects h triples and the containment pass inspects h edges times n points, so the total is O(h * n) time. Only counters and the emitted frames are stored, giving O(1) auxiliary space.",
        uses: [
            "Validating hull output from another algorithm",
            "Checking geometric predicates in computational-geometry tests",
            "Confirming polygon convexity in graphics pipelines",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 1",
            "Preparata and Shamos, Computational Geometry: An Introduction, Chapter 3",
        ],
        workedExample:
            "For points (0,0), (4,0), (4,3), (0,3), (2,1) and claimed hull [0,1,2,3], each consecutive triple turns left and the interior point (2,1) lies left of all four edges, so the claim is verified. Claiming [0,1,3] fails because the point (4,3) lies outside the edge from (0,3) back to (0,0).",
    },
    id: "convex-hull-verification",
    name: "Convex Hull Verification",
    category: "geometry",
    complexity: { time: "O(h * n)", space: "O(1)" },
    defaultInput: {
        points: [
            [0, 0],
            [4, 0],
            [4, 3],
            [0, 3],
            [2, 1],
        ],
        hull: [0, 1, 2, 3],
    },
    visualType: "point",
    run,
    pseudocode: [
        "check the claimed indices are distinct and in range",
        "for each consecutive triple require a positive cross product",
        "if a triple is not a left turn, reject",
        "for each hull edge test every input point for the left side",
        "if any point is outside, reject",
        "if all tests pass, accept the polygon as the hull",
    ],
};

export default module;
