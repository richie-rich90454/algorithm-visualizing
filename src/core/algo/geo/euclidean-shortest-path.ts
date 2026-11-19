/**
 * euclidean-shortest-path.ts - Euclidean Shortest Path Among Point Obstacles
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The shortest path between two points that must avoid a set of point
 * obstacles bends only at obstacle vertices. Building a visibility graph whose
 * nodes are the start, the goal, and the obstacles, and connecting two nodes
 * when the segment between them passes through no other obstacle, reduces the
 * continuous problem to a finite graph. Dijkstra then finds the minimum total
 * Euclidean length.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k^3) to build the visibility graph plus O(k^2) Dijkstra for k nodes
 *   Space: O(k^2) for the graph
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Start and goal are highlighted; obstacle points are ACTIVE.
 *   - Visible graph edges are drawn, and the chosen route is PATH.
 *   - The final frame reports the shortest path length.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

const EPS = 1e-9;

/** Cross product of (a, b, c). */
function cross(a: Point, b: Point, c: Point): number {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Euclidean distance. */
function distance(a: Point, b: Point): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** True when segment a-b passes strictly through obstacle point c. */
function blockedBy(a: Point, b: Point, c: Point): boolean {
    if (Math.abs(cross(a, b, c)) > EPS) {
        return false;
    }
    const dot = (c[0] - a[0]) * (c[0] - b[0]) + (c[1] - a[1]) * (c[1] - b[1]);
    return dot < -EPS;
}

/** Build nodes for all graph points. */
function makeNodes(points: Point[], path: number[] = []): VisualEntity[] {
    const pathSet = new Set(path);
    return points.map(([x, y], index) => ({
        id: `n-${index}`,
        type: "node" as const,
        label: index === 0 ? "S" : index === 1 ? "G" : String(index - 2),
        value: [x, y],
        state: (index === 0 || index === 1
            ? "pivot"
            : pathSet.has(index)
              ? "sorted"
              : "active") as VisualEntity["state"],
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index, role: index === 0 ? "start" : index === 1 ? "goal" : "obstacle" },
    }));
}

/** Build visibility graph edges, optionally highlighting the chosen route. */
function makeEdges(points: Point[], visible: boolean[][], path: number[] = []): VisualEdge[] {
    const edges: VisualEdge[] = [];
    const pathPairs = new Set<string>();
    for (let i = 0; i < path.length - 1; i += 1) {
        pathPairs.add(`${Math.min(path[i] as number, path[i + 1] as number)}-${Math.max(path[i] as number, path[i + 1] as number)}`);
    }
    for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
            if (!visible[i]?.[j]) {
                continue;
            }
            const key = `${i}-${j}`;
            edges.push({
                id: `e-${i}-${j}`,
                sourceId: `n-${i}`,
                targetId: `n-${j}`,
                label: distance(points[i] as Point, points[j] as Point).toFixed(1),
                state: pathPairs.has(key) ? "path" : "idle",
                directed: false,
            });
        }
    }
    return edges;
}

/** The euclidean shortest path generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { start?: Point; goal?: Point; obstacles?: Point[] } | null) ?? {};
    const start: Point = task.start ?? [0, 0];
    const goal: Point = task.goal ?? [6, 0];
    const obstacles: Point[] = task.obstacles ?? [
        [2, 1],
        [3, -1],
        [4, 1],
    ];
    const points: Point[] = [start, goal, ...obstacles];
    const k = points.length;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeNodes(points),
        edges: [],
        description: `Find the shortest path from start to goal around ${obstacles.length} point obstacles.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { distance: 0, path: [0, 1], edges: 0 },
    };
    step += 1;

    // Build the visibility graph.
    const visible: boolean[][] = Array.from({ length: k }, () => new Array<boolean>(k).fill(false));
    let edgeCount = 0;
    for (let i = 0; i < k; i += 1) {
        for (let j = i + 1; j < k; j += 1) {
            let blocked = false;
            for (let m = 0; m < k && !blocked; m += 1) {
                if (m === i || m === j) {
                    continue;
                }
                if (blockedBy(points[i] as Point, points[j] as Point, points[m] as Point)) {
                    blocked = true;
                }
            }
            if (!blocked) {
                visible[i]![j] = true;
                visible[j]![i] = true;
                edgeCount += 1;
            }
        }
    }

    yield {
        stepNumber: step,
        entities: makeNodes(points),
        edges: makeEdges(points, visible),
        description: `Visibility graph built with ${edgeCount} edges between mutually visible points.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { distance: 0, path: [0, 1], edges: edgeCount },
    };
    step += 1;

    // Dijkstra from the start node to the goal node.
    const dist = new Array<number>(k).fill(Number.POSITIVE_INFINITY);
    const prev = new Array<number>(k).fill(-1);
    const visited = new Array<boolean>(k).fill(false);
    dist[0] = 0;

    for (let iteration = 0; iteration < k; iteration += 1) {
        let u = -1;
        for (let i = 0; i < k; i += 1) {
            if (!visited[i] && (u < 0 || (dist[i] as number) < (dist[u] as number))) {
                u = i;
            }
        }
        if (u < 0 || !Number.isFinite(dist[u])) {
            break;
        }
        visited[u] = true;
        for (let v = 0; v < k; v += 1) {
            if (!visible[u]?.[v] || visited[v]) {
                continue;
            }
            const candidate = (dist[u] as number) + distance(points[u] as Point, points[v] as Point);
            if (candidate < (dist[v] as number)) {
                dist[v] = candidate;
                prev[v] = u;
            }
        }
        yield {
            stepNumber: step,
            entities: makeNodes(points),
            edges: makeEdges(points, visible),
            description: `Relaxed node ${u}: tentative distance to goal is ${Number.isFinite(dist[1]) ? (dist[1] as number).toFixed(2) : "infinite"}.`,
            codeLineNumber: 4,
            layout: "point",
            meta: { distance: dist[1] ?? 0, path: [0, 1], edges: edgeCount, current: u },
        };
        step += 1;
    }

    const path: number[] = [];
    if (Number.isFinite(dist[1])) {
        let cursor = 1;
        while (cursor !== -1) {
            path.push(cursor);
            cursor = prev[cursor] as number;
        }
        path.reverse();
    }

    yield {
        stepNumber: step,
        entities: makeNodes(points, path),
        edges: makeEdges(points, visible, path),
        description: Number.isFinite(dist[1])
            ? `Shortest path length ${(dist[1] as number).toFixed(2)} via nodes [${path.join(", ")}].`
            : `No visible route from start to goal.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { distance: dist[1] ?? 0, path, edges: edgeCount },
    };
}

/** The euclidean shortest path module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A shortest path that may bend around point obstacles only needs to turn at obstacle points, because between turns a straight segment is always shortest. That observation turns a continuous geometry problem into a finite one: build a graph of the start, goal, and obstacles, connect pairs that can see each other, and run a shortest-path search with Euclidean edge lengths.",
        invariants: [
            "Two nodes share an edge only if their segment passes through no other obstacle point.",
            "Every edge length is the straight-line Euclidean distance between its endpoints.",
            "Dijkstra settles nodes in nondecreasing distance from the start.",
        ],
        correctness:
            "Any shortest feasible path is polygonal with bends only at obstacles, since a subpath with no obstacle on its segment can be replaced by the straight chord without increasing length. Therefore the optimal path corresponds to a path in the visibility graph, and every visibility-graph path is feasible. Dijkstra finds the minimum-length path in that finite graph, so its length is the true Euclidean shortest path.",
        complexityRationale:
            "Testing visibility for each of O(k^2) pairs against O(k) obstacles takes O(k^3) time, and Dijkstra on a dense graph with a linear scan takes O(k^2). The visibility matrix stores O(k^2) entries.",
        uses: [
            "Robot motion planning around sparse point hazards",
            "Network routing with line-of-sight constraints",
            "Teaching the visibility graph reduction in computational geometry",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 15",
            "Latombe, Robot Motion Planning, Chapter 4",
        ],
        workedExample:
            "With start (0,0), goal (6,0), and one obstacle at (3,1), the direct segment is clear so the shortest path is length 6. Moving the obstacle to (3,0) blocks the direct line; the shortest route bends through (3, epsilon) or an equivalent detour, illustrating why the obstacle becomes a graph node.",
    },
    id: "euclidean-shortest-path",
    name: "Euclidean Shortest Path (Visibility Graph)",
    category: "geometry",
    complexity: { time: "O(k^3)", space: "O(k^2)" },
    defaultInput: {
        start: [0, 0],
        goal: [6, 0],
        obstacles: [
            [2, 1],
            [3, -1],
            [4, 1],
        ],
    },
    visualType: "point",
    run,
    pseudocode: [
        "collect the start, goal, and obstacle points as graph nodes",
        "for every pair of nodes test whether other obstacles block the segment",
        "connect mutually visible pairs with an edge of Euclidean length",
        "initialize distances with infinity and the start at zero",
        "repeatedly settle the nearest node and relax its visible neighbors",
        "reconstruct the route from goal back to start",
        "done: report the shortest path and its length",
    ],
};

export default module;
