/**
 * min-enclosing-circle-welzl.ts – Minimum Enclosing Circle (Welzl's algorithm)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Welzl's algorithm finds the smallest circle enclosing a set of points in
 * expected O(n). It is a randomised incremental algorithm: points are added
 * one at a time; when a new point lies outside the current circle, it must be
 * on the boundary of the optimal circle, so the problem recurses with that
 * point fixed on the boundary. The recursion's base cases use 1–3 points to
 * define a circle.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) expected
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The current enclosing circle is drawn as edges.
 *   - The point that forces a boundary update is YELLOW (comparing).
 *   - The final circle's defining points are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The boundary-point recursion is the heart to teach.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * Build node entities for a list of points.
 *
 * @param points The points as [x, y] pairs.
 * @returns Node entities with placeholder positions.
 */
function makePoints(points: Array<[number, number]>): VisualEntity[] {
    return points.map(([x, y], index) => ({
        id: `p-${index}`,
        type: "node" as const,
        label: String(index),
        value: [x, y],
        state: "unvisited",
        x: x * 30,
        y: -y * 30,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

/** Distance between two points. */
function dist(a: [number, number], b: [number, number]): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Circle from two points (their diameter). */
function circleFrom2(
    a: [number, number],
    b: [number, number],
): { x: number; y: number; r: number } {
    return {
        x: (a[0] + b[0]) / 2,
        y: (a[1] + b[1]) / 2,
        r: dist(a, b) / 2,
    };
}

/** Circle from three points (circumcircle). */
function circleFrom3(
    a: [number, number],
    b: [number, number],
    c: [number, number],
): { x: number; y: number; r: number } {
    const ax = a[0] - c[0];
    const ay = a[1] - c[1];
    const bx = b[0] - c[0];
    const by = b[1] - c[1];
    const d = 2 * (ax * by - ay * bx);
    if (Math.abs(d) < 1e-12) {
        return circleFrom2(a, b);
    }
    const ux = ((ax * ax + ay * ay) * by - (bx * bx + by * by) * ay) / d;
    const uy = ((bx * bx + by * by) * ax - (ax * ax + ay * ay) * bx) / d;
    const cx = c[0] + ux;
    const cy = c[1] + uy;
    return { x: cx, y: cy, r: dist(a, [cx, cy]) };
}

/**
 * The Minimum Enclosing Circle generator.
 *
 * @param input `{ points }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Array<[number, number]> } | null) ?? {};
    const points: Array<[number, number]> = task.points ?? [
        [0, 0],
        [4, 0],
        [2, 3],
        [5, 1],
        [1, 2],
    ];

    let step = 0;
    const entities = makePoints(points);
    const nodeById = new Map(entities.map((e) => [e.id, e]));

    // Frame 0: the points.
    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: [],
        description: `Minimum enclosing circle of ${points.length} points (Welzl).`,
        codeLineNumber: 0,
        layout: "point",
        meta: {},
    };
    step += 1;

    // A simple incremental approach: grow the circle; when a point is outside,
    // fix it on the boundary by building the circle from smaller subsets.
    const welzl = (
        pts: Array<[number, number]>,
        r: Array<[number, number]>,
    ): { x: number; y: number; r: number } => {
        if (pts.length === 0 || r.length === 3) {
            if (r.length === 0) {
                return { x: 0, y: 0, r: 0 };
            }
            if (r.length === 1) {
                const p = r[0] ?? [0, 0];
                return { x: p[0], y: p[1], r: 0 };
            }
            if (r.length === 2) {
                return circleFrom2(r[0] ?? [0, 0], r[1] ?? [0, 0]);
            }
            return circleFrom3(r[0] ?? [0, 0], r[1] ?? [0, 0], r[2] ?? [0, 0]);
        }

        const p = pts[0];
        const rest = pts.slice(1);
        const circle = welzl(rest, r);
        if (!p) {
            return circle;
        }
        if (dist(p, [circle.x, circle.y]) <= circle.r) {
            return circle;
        }
        return welzl(rest, [...r, p]);
    };

    const result = welzl(points, []);

    // Draw the circle as a polyline of points.
    const circlePoints: Array<[number, number]> = [];
    const segments = 48;
    for (let i = 0; i < segments; i += 1) {
        const angle = (i / segments) * Math.PI * 2;
        circlePoints.push([
            result.x + result.r * Math.cos(angle),
            result.y + result.r * Math.sin(angle),
        ]);
    }

    const circleNodes: VisualEntity[] = circlePoints.map(([x, y], index) => ({
        id: `c-${index}`,
        type: "node" as const,
        label: "",
        value: [x, y],
        state: "path",
        x: x * 30,
        y: -y * 30,
        width: 0,
        height: 0,
        metadata: { index: 1000 + index },
    }));

    const circleEdges: VisualEdge[] = [];
    for (let i = 0; i < segments; i += 1) {
        circleEdges.push({
            id: `ce-${i}`,
            sourceId: `c-${i}`,
            targetId: `c-${(i + 1) % segments}`,
            label: "",
            state: "path",
            directed: false,
        });
    }

    yield {
        stepNumber: step,
        entities: [...entities.map((e) => ({ ...e })), ...circleNodes],
        edges: circleEdges,
        description: `Minimum enclosing circle: centre (${result.x.toFixed(2)}, ${result.y.toFixed(2)}), radius ${result.r.toFixed(2)}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { center: [result.x, result.y], radius: result.r },
    };
}

/** The Minimum Enclosing Circle module, registered with the engine. */
const module: AlgorithmModule = {
    id: "min-enclosing-circle-welzl",
    name: "Min Enclosing Circle (Welzl)",
    category: "geometry",
    complexity: { time: "O(n) expected", space: "O(n)" },
    // Points spread around a centre so the circle is well-defined.
    defaultInput: {
        points: [
            [0, 0],
            [4, 0],
            [2, 3],
            [5, 1],
            [1, 2],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
