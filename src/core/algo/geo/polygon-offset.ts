/**
 * polygon-offset.ts - Convex Polygon Offset
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Offsetting a convex polygon by a distance r moves every edge outward by r
 * along its outward normal. The offset polygon's vertices are the intersections
 * of consecutive shifted edge lines. For a counterclockwise polygon the
 * outward normal of edge (dx, dy) is the normalized (dy, -dx), and intersecting
 * adjacent offset lines reconstructs the expanded boundary in O(n).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n polygon edges
 *   Space: O(n) for the offset vertices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Original vertices are nodes left UNVISITED; offset vertices are SORTED.
 *   - The original outline is drawn ACTIVE and the offset outline PATH.
 *   - Each emitted frame shows one shifted edge line being intersected.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

/** Cross product of 2D vectors. */
function crossVec(a: Point, b: Point): number {
    return a[0] * b[1] - a[1] * b[0];
}

/** Shoelace area of a polygon. */
function area(polygon: Point[]): number {
    let sum = 0;
    for (let i = 0; i < polygon.length; i += 1) {
        const p = polygon[i] as Point;
        const q = polygon[(i + 1) % polygon.length] as Point;
        sum += p[0] * q[1] - q[0] * p[1];
    }
    return Math.abs(sum) / 2;
}

/** Build nodes for the original and offset polygons. */
function makeNodes(original: Point[], offset: Point[], showOffset: number): VisualEntity[] {
    const nodes: VisualEntity[] = original.map(([x, y], index) => ({
        id: `o-${index}`,
        type: "node" as const,
        label: `o${index}`,
        value: [x, y],
        state: "unvisited" as const,
        x,
        y,
        width: 0,
        height: 0,
        metadata: { polygon: 0, index },
    }));
    for (let i = 0; i < showOffset && i < offset.length; i += 1) {
        const [x, y] = offset[i] ?? [0, 0];
        nodes.push({
            id: `n-${i}`,
            type: "node" as const,
            label: `n${i}`,
            value: [x, y],
            state: "sorted",
            x,
            y,
            width: 0,
            height: 0,
            metadata: { polygon: 1, index: i },
        });
    }
    return nodes;
}

/** Build the two polygon outlines. */
function makeEdges(original: Point[], offsetCount: number): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let i = 0; i < original.length; i += 1) {
        edges.push({
            id: `orig-${i}`,
            sourceId: `o-${i}`,
            targetId: `o-${(i + 1) % original.length}`,
            label: "",
            state: "active",
            directed: false,
        });
        if (i < offsetCount) {
            edges.push({
                id: `off-${i}`,
                sourceId: `n-${i}`,
                targetId: `n-${(i + 1) % offsetCount}`,
                label: "",
                state: "path",
                directed: false,
            });
        }
    }
    return edges;
}

/** The convex polygon offset generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { polygon?: Point[]; distance?: number } | null) ?? {};
    const polygon: Point[] = task.polygon ?? [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3],
    ];
    const distance = typeof task.distance === "number" ? Math.abs(task.distance) : 1;
    let step = 0;

    if (polygon.length < 3 || !Number.isFinite(distance)) {
        yield {
            stepNumber: 0,
            entities: makeNodes(polygon, [], 0),
            edges: makeEdges(polygon, 0),
            description: "Polygon offset needs at least three vertices and a finite distance.",
            codeLineNumber: 0,
            layout: "point",
            meta: { distance, offset: [], area: 0 },
        };
        return;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(polygon, [], 0),
        edges: makeEdges(polygon, 0),
        description: `Offset a ${polygon.length}-vertex convex polygon outward by ${distance}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { distance, offset: [], area: area(polygon) },
    };
    step += 1;

    // Each edge gets a shifted supporting line; intersect adjacent lines.
    const n = polygon.length;
    const shiftedPoint: Point[] = [];
    const direction: Point[] = [];
    for (let i = 0; i < n; i += 1) {
        const p = polygon[i] as Point;
        const q = polygon[(i + 1) % n] as Point;
        const dx = q[0] - p[0];
        const dy = q[1] - p[1];
        const len = Math.hypot(dx, dy) || 1;
        const normal: Point = [dy / len, -dx / len];
        shiftedPoint.push([p[0] + distance * normal[0], p[1] + distance * normal[1]]);
        direction.push([dx, dy]);
        yield {
            stepNumber: step,
            entities: makeNodes(polygon, [], 0),
            edges: makeEdges(polygon, 0),
            description: `Edge ${i} shifted outward along normal (${normal[0].toFixed(2)}, ${normal[1].toFixed(2)}).`,
            codeLineNumber: 2,
            layout: "point",
            meta: { distance, edge: i, normal, offset: [], area: area(polygon) },
        };
        step += 1;
    }

    const offset: Point[] = [];
    for (let i = 0; i < n; i += 1) {
        const a = shiftedPoint[i] as Point;
        const b = shiftedPoint[(i + 1) % n] as Point;
        const da = direction[i] as Point;
        const db = direction[(i + 1) % n] as Point;
        const denom = crossVec(da, db);
        let vertex: Point;
        if (Math.abs(denom) < 1e-12) {
            vertex = [b[0], b[1]];
        } else {
            const diff: Point = [b[0] - a[0], b[1] - a[1]];
            const t = crossVec(diff, db) / denom;
            vertex = [a[0] + t * da[0], a[1] + t * da[1]];
        }
        offset.push(vertex);
        yield {
            stepNumber: step,
            entities: makeNodes(polygon, offset, offset.length),
            edges: makeEdges(polygon, offset.length),
            description: `Intersected offset lines ${i} and ${(i + 1) % n} at (${vertex[0].toFixed(2)}, ${vertex[1].toFixed(2)}).`,
            codeLineNumber: 4,
            layout: "point",
            meta: { distance, offset: offset.flatMap((point) => [point[0], point[1]]), offsetCount: offset.length, area: area(polygon) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(polygon, offset, offset.length),
        edges: makeEdges(polygon, offset.length),
        description: `Offset polygon has ${offset.length} vertices and area ${area(offset).toFixed(2)} (original ${area(polygon).toFixed(2)}).`,
        codeLineNumber: 5,
        layout: "point",
        meta: { distance, offset: offset.flatMap((point) => [point[0], point[1]]), offsetCount: offset.length, area: area(offset), originalArea: area(polygon) },
    };
}

/** The convex polygon offset module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Moving a convex polygon outward by a fixed distance means sliding each edge sideways along its outward normal. The shifted edges no longer meet at the old corners, so the new corners are found by intersecting each pair of neighboring shifted edge lines. Because the polygon is convex, those intersections are well defined and stay in the same cyclic order.",
        invariants: [
            "Each shifted edge line is exactly the original edge translated by the offset distance.",
            "For a counterclockwise edge (dx, dy), the outward unit normal is (dy, -dx) normalized.",
            "Offset vertices are intersections of consecutive shifted edge lines and keep the polygon convex.",
        ],
        correctness:
            "A point lies on the offset polygon boundary when it is at signed distance r from at least one original edge on the outside. The intersection of two consecutive shifted lines is precisely the point at distance r from both adjacent edges, which is the correct expanded corner. Taking all such intersections in order reconstructs the boundary of the Minkowski sum of the polygon with a disk of radius r, restricted to straight edges for a convex polygon.",
        complexityRationale:
            "Computing each shifted line and each line intersection is constant work, so n edges take O(n) time and the n offset vertices use O(n) space.",
        uses: [
            "Computing clearance buffers around convex obstacles",
            "Offsetting shapes for computer-aided design and machining",
            "Growing collision margins in robotics motion planning",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 13",
            "Preparata and Shamos, Computational Geometry: An Introduction, Chapter 6",
        ],
        workedExample:
            "Offsetting the unit square (0,0), (1,0), (1,1), (0,1) by 0.5 shifts the bottom edge to y = -0.5 and the right edge to x = 1.5, among others. Their intersections give the expanded square (-0.5,-0.5), (1.5,-0.5), (1.5,1.5), (-0.5,1.5) with area 4, up from the original area 1.",
    },
    id: "polygon-offset",
    name: "Convex Polygon Offset",
    category: "geometry",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        polygon: [
            [0, 0],
            [4, 0],
            [4, 3],
            [0, 3],
        ],
        distance: 1,
    },
    visualType: "point",
    run,
    pseudocode: [
        "for each polygon edge compute its outward unit normal",
        "translate the edge line outward by the offset distance",
        "for each pair of adjacent shifted lines",
        "intersect them to obtain one offset vertex",
        "collect the offset vertices in boundary order",
        "done: report the offset polygon and its area",
    ],
};

export default module;
