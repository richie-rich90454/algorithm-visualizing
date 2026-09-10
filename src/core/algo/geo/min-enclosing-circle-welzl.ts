/**
 * min-enclosing-circle-welzl.ts – Minimum Enclosing Circle (Welzl's algorithm)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Welzl's algorithm finds the smallest circle enclosing a set of points in
 * expected O(n). It is a randomized incremental algorithm: points are added
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
 * Visualization mapping
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

    // Degenerate inputs are their own answer.
    if (points.length === 0) {
        yield {
            stepNumber: step,
            entities: entities.map((e) => ({ ...e })),
            edges: [],
            description: "No points – the enclosing circle is empty.",
            codeLineNumber: 0,
            layout: "point",
            meta: {},
        };
        return;
    }

    const result = welzl(points, []);

    const segments = 48;
    const buildCircle = (
        cx: number,
        cy: number,
        radius: number,
    ): { nodes: VisualEntity[]; edges: VisualEdge[] } => {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i < segments; i += 1) {
            const angle = (i / segments) * Math.PI * 2;
            pts.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
        }
        const nodes: VisualEntity[] = pts.map(([x, y], index) => ({
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
        return { nodes, edges: circleEdges };
    };

    const resetPoints = (): void => {
        for (const node of entities) {
            node.state = "unvisited";
        }
    };

    // Points on the final circle define the boundary set.
    const defining: number[] = [];
    points.forEach((p, index) => {
        if (Math.abs(dist(p, [result.x, result.y]) - result.r) <= 1e-6) {
            defining.push(index);
        }
    });
    if (defining.length === 0) {
        defining.push(0);
    }

    // Boundary set: 0 points – the defined circle is empty.
    resetPoints();
    yield {
        stepNumber: step,
        entities: entities.map((e) => ({ ...e })),
        edges: [],
        description: `Welzl boundary set: 0 points – defined circle is empty (center (0.00, 0.00), radius 0.00).`,
        codeLineNumber: 1,
        layout: "point",
        meta: {},
    };
    step += 1;

    // Boundary set: 1 point – a zero-radius circle at that point.
    const b1 = defining[0] ?? 0;
    const p1 = points[b1] ?? [0, 0];
    const circle1 = buildCircle(p1[0], p1[1], 0);
    resetPoints();
    const b1Node = nodeById.get(`p-${b1}`);
    if (b1Node) {
        b1Node.state = "comparing";
    }
    yield {
        stepNumber: step,
        entities: [...entities.map((e) => ({ ...e })), ...circle1.nodes],
        edges: circle1.edges,
        description: `Welzl boundary set: 1 point (p-${b1}) – defined circle center (${p1[0].toFixed(2)}, ${p1[1].toFixed(2)}), radius 0.00.`,
        codeLineNumber: 1,
        layout: "point",
        meta: {},
    };
    step += 1;

    // Boundary set: 2 points – the circle with those points as diameter.
    if (points.length >= 2) {
        const second = defining[1] ?? (b1 === 0 ? 1 : 0);
        const q1 = points[b1] ?? [0, 0];
        const q2 = points[second] ?? [0, 0];
        const circle2 = circleFrom2(q1, q2);
        const drawn2 = buildCircle(circle2.x, circle2.y, circle2.r);
        resetPoints();
        for (const idx of [b1, second]) {
            const node = nodeById.get(`p-${idx}`);
            if (node) {
                node.state = "comparing";
            }
        }
        yield {
            stepNumber: step,
            entities: [...entities.map((e) => ({ ...e })), ...drawn2.nodes],
            edges: drawn2.edges,
            description: `Welzl boundary set: 2 points (p-${b1}, p-${second}) – defined circle center (${circle2.x.toFixed(2)}, ${circle2.y.toFixed(2)}), radius ${circle2.r.toFixed(2)}.`,
            codeLineNumber: 1,
            layout: "point",
            meta: {},
        };
        step += 1;
    }

    // Draw the circle as a polyline of points.
    const drawn = buildCircle(result.x, result.y, result.r);
    const circleNodes = drawn.nodes;
    const circleEdges = drawn.edges;

    resetPoints();
    for (const idx of defining) {
        const node = nodeById.get(`p-${idx}`);
        if (node) {
            node.state = "sorted";
        }
    }
    yield {
        stepNumber: step,
        entities: [...entities.map((e) => ({ ...e })), ...circleNodes],
        edges: circleEdges,
        description: `Minimum enclosing circle: center (${result.x.toFixed(2)}, ${result.y.toFixed(2)}), radius ${result.r.toFixed(2)}.`,
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
    // Points spread around a center so the circle is well-defined.
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
