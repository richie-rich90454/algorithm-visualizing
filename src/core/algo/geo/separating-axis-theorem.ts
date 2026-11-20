/**
 * separating-axis-theorem.ts - Separating Axis Theorem for Convex Polygons
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The separating axis theorem says two convex shapes are disjoint exactly
 * when there exists a line onto which their projections do not overlap. For
 * convex polygons it is enough to test the axes perpendicular to every edge
 * of both polygons. Projecting each polygon onto such an axis and comparing
 * the min and max intervals detects a separating axis in O(n + m) time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n + m) for polygons with n and m vertices
 *   Space: O(n + m) for the projected interval endpoints
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices of polygon A and B are nodes; polygon edges connect them.
 *   - The axis currently tested drives the ACTIVE edge state.
 *   - Polygon A is GREEN (sorted), polygon B is BLUE (active), and a found
 *     separating axis turns the result GREEN.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

/** Project a polygon onto an axis, returning the [min, max] interval. */
function project(polygon: Point[], axis: Point): [number, number] {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.POSITIVE_INFINITY * -1;
    for (const point of polygon) {
        const value = point[0] * axis[0] + point[1] * axis[1];
        if (value < min) {
            min = value;
        }
        if (value > max) {
            max = value;
        }
    }
    return [min, max];
}

/** Build node entities for both polygons. */
function makeNodes(a: Point[], b: Point[], highlightEdge = -1, polygonFlag = 0): VisualEntity[] {
    const nodes: VisualEntity[] = a.map(([x, y], index) => ({
        id: `a-${index}`,
        type: "node" as const,
        label: `A${index}`,
        value: [x, y],
        state: (polygonFlag === 0 ? "sorted" : "unvisited") as VisualEntity["state"],
        x,
        y,
        width: 0,
        height: 0,
        metadata: { polygon: 0, index },
    }));
    for (let i = 0; i < b.length; i += 1) {
        const [x, y] = b[i] ?? [0, 0];
        nodes.push({
            id: `b-${i}`,
            type: "node" as const,
            label: `B${i}`,
            value: [x, y],
            state: (polygonFlag === 1 ? "active" : "unvisited") as VisualEntity["state"],
            x,
            y,
            width: 0,
            height: 0,
            metadata: { polygon: 1, index: i },
        });
    }
    if (highlightEdge >= 0) {
        const target = nodes.find(
            (entity) => entity.metadata["polygon"] === polygonFlag && entity.metadata["index"] === highlightEdge,
        );
        if (target) {
            target.state = "comparing";
        }
    }
    return nodes;
}

/** Build the polygon edge lines. */
function makeEdges(a: Point[], b: Point[]): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (const [prefix, polygon] of [
        ["a", a],
        ["b", b],
    ] as Array<[string, Point[]]>) {
        for (let i = 0; i < polygon.length; i += 1) {
            edges.push({
                id: `edge-${prefix}-${i}`,
                sourceId: `${prefix}-${i}`,
                targetId: `${prefix}-${(i + 1) % polygon.length}`,
                label: "",
                state: prefix === "a" ? "path" : "active",
                directed: false,
            });
        }
    }
    return edges;
}

/** The separating axis theorem generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { polygonA?: Point[]; polygonB?: Point[] } | null) ?? {};
    const polygonA: Point[] = task.polygonA ?? [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3],
    ];
    const polygonB: Point[] = task.polygonB ?? [
        [6, 1],
        [8, 1],
        [8, 4],
        [6, 4],
    ];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(polygonA, polygonB),
        edges: makeEdges(polygonA, polygonB),
        description: "Separating axis theorem: test edge normals of both convex polygons.",
        codeLineNumber: 0,
        layout: "point",
        meta: { intersect: true, axesTested: 0 },
    };
    step += 1;

    const polygons = [polygonA, polygonB];
    for (let polygonFlag = 0; polygonFlag < 2; polygonFlag += 1) {
        const polygon = polygons[polygonFlag] ?? [];
        for (let i = 0; i < polygon.length; i += 1) {
            const p1 = polygon[i] ?? [0, 0];
            const p2 = polygon[(i + 1) % polygon.length] ?? [0, 0];
            const edgeX = p2[0] - p1[0];
            const edgeY = p2[1] - p1[1];
            const axis: Point = [-edgeY, edgeX];
            const [minA, maxA] = project(polygonA, axis);
            const [minB, maxB] = project(polygonB, axis);
            const separated = maxA < minB || maxB < minA;

            yield {
                stepNumber: step,
                entities: makeNodes(polygonA, polygonB, i, polygonFlag),
                edges: makeEdges(polygonA, polygonB),
                description:
                    `Axis from polygon ${polygonFlag === 0 ? "A" : "B"} edge ${i}: ` +
                    `projections [${minA.toFixed(1)}, ${maxA.toFixed(1)}] and ` +
                    `[${minB.toFixed(1)}, ${maxB.toFixed(1)}] ` +
                    `${separated ? "do not overlap - separating axis found" : "overlap"}.`,
                codeLineNumber: separated ? 4 : 3,
                layout: "point",
                meta: {
                    intersect: !separated,
                    axesTested: step,
                    axis,
                    separated,
                    minA,
                    maxA,
                    minB,
                    maxB,
                },
            };
            step += 1;

            if (separated) {
                yield {
                    stepNumber: step,
                    entities: makeNodes(polygonA, polygonB),
                    edges: makeEdges(polygonA, polygonB),
                    description: `A separating axis exists, so the polygons do not intersect.`,
                    codeLineNumber: 5,
                    layout: "point",
                    meta: { intersect: false, axesTested: step, axis },
                };
                return;
            }
        }
    }

    yield {
        stepNumber: step,
        entities: makeNodes(polygonA, polygonB),
        edges: makeEdges(polygonA, polygonB),
        description: `No separating axis found - the two convex polygons intersect.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { intersect: true, axesTested: step },
    };
}

/** The separating axis theorem module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "If two convex shapes do not touch, you can slip a line between them. Projecting both shapes onto a line perpendicular to such a gap produces two intervals that do not overlap. The separating axis theorem says the converse is also true, so testing only the axes perpendicular to the polygon edges is enough to decide intersection.",
        invariants: [
            "Two convex polygons overlap on an axis exactly when their projection intervals overlap.",
            "If an axis separates the polygons, no point can belong to both.",
            "It suffices to test axes perpendicular to edges of either polygon.",
        ],
        correctness:
            "For disjoint convex polygons the distance-minimizing pair of points defines a separating line whose normal is perpendicular to an edge of one polygon, so one tested axis detects the gap. Conversely an axis with disjoint projections is a genuine separating line, proving the polygons cannot intersect. Testing all edge normals of both polygons therefore gives a correct and complete decision procedure.",
        complexityRationale:
            "Each of the n + m edge axes requires projecting both polygons, costing O(n + m) per axis if done naively, but with the polygons projected once per axis the total is O((n + m)^2) in this direct form; storing only the current intervals uses O(n + m) space.",
        uses: [
            "Broad-phase and narrow-phase collision detection in games",
            "Robotics collision checking for convex links",
            "Computational geometry intersection predicates",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 4",
            "Ericson, Real-Time Collision Detection, Chapter 4",
        ],
        workedExample:
            "A rectangle from (0,0) to (4,3) and a rectangle from (6,1) to (8,4) are tested on the x axis: projections [0,4] and [6,8] do not overlap, so the axis (0,1) separates them and they do not intersect. Moving the second rectangle to (3,1)-(5,4) makes every projection overlap, so they intersect.",
    },
    id: "separating-axis-theorem",
    name: "Separating Axis Theorem",
    category: "geometry",
    complexity: { time: "O((n + m)^2)", space: "O(n + m)" },
    defaultInput: {
        polygonA: [
            [0, 0],
            [4, 0],
            [4, 3],
            [0, 3],
        ],
        polygonB: [
            [6, 1],
            [8, 1],
            [8, 4],
            [6, 4],
        ],
    },
    visualType: "point",
    run,
    pseudocode: [
        "for each edge of polygon A and polygon B",
        "compute the axis perpendicular to that edge",
        "project both polygons onto the axis",
        "compare the two projection intervals",
        "if the intervals do not overlap, report no intersection",
        "after all axes, report the polygons intersect",
    ],
};

export default module;
