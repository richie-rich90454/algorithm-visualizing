/**
 * visibility-graph-path-planning.ts - Shortest Obstacle-Avoiding Path via a Visibility Graph.
 *
 * In a plane with polygonal obstacles the shortest path between two points is a
 * polyline whose intermediate corners are obstacle vertices. This algorithm
 * builds a graph whose nodes are the start, the goal, and every obstacle vertex;
 * two nodes are joined when the straight segment between them does not cross an
 * obstacle. Running Dijkstra on that graph yields the shortest collision-free
 * path.
 *
 * Time:  O(v^3) graph construction plus O(v^2) Dijkstra for v vertices
 * Space: O(v^2)
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

const cross = (o: Point, a: Point, b: Point): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
const same = (a: Point, b: Point): boolean => a[0] === b[0] && a[1] === b[1];

/** True when segments ab and cd cross at interior points of both. */
function properIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
    const c1 = cross(a, b, c);
    const c2 = cross(a, b, d);
    const c3 = cross(c, d, a);
    const c4 = cross(c, d, b);
    return ((c1 > 0 && c2 < 0) || (c1 < 0 && c2 > 0)) && ((c3 > 0 && c4 < 0) || (c3 < 0 && c4 > 0));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { obstacles?: Point[][]; start?: Point; goal?: Point } | null) ?? {};
    const obstacles: Point[][] = task.obstacles ?? [
        [[2, 2], [4, 2], [4, 4], [2, 4]],
        [[6, 1], [8, 1], [8, 3], [6, 3]],
    ];
    const start: Point = task.start ?? [0, 0];
    const goal: Point = task.goal ?? [10, 5];

    const vertices: Point[] = [start, goal, ...obstacles.flat()];
    const obsEdges: Array<[Point, Point]> = obstacles.flatMap((poly) =>
        poly.map((p, i) => [p, poly[(i + 1) % poly.length] as Point] as [Point, Point]),
    );

    const visible = (i: number, j: number): boolean => {
        const a = vertices[i] as Point;
        const b = vertices[j] as Point;
        for (const [c, d] of obsEdges) {
            if (same(a, c) || same(a, d) || same(b, c) || same(b, d)) continue;
            if (properIntersect(a, b, c, d)) return false;
        }
        return true;
    };

    const n = vertices.length;
    const adjacency: Array<Array<{ to: number; w: number }>> = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            if (!visible(i, j)) continue;
            const w = dist(vertices[i] as Point, vertices[j] as Point);
            adjacency[i]?.push({ to: j, w });
            adjacency[j]?.push({ to: i, w });
        }
    }

    const best = new Array<number>(n).fill(Infinity);
    const prev = new Array<number>(n).fill(-1);
    const settled = new Array<boolean>(n).fill(false);
    best[0] = 0;
    const order: number[] = [];
    for (let iter = 0; iter < n; iter += 1) {
        let u = -1;
        for (let i = 0; i < n; i += 1) {
            if (!settled[i] && (u === -1 || (best[i] as number) < (best[u] as number))) u = i;
        }
        if (u === -1 || (best[u] as number) === Infinity) break;
        settled[u] = true;
        order.push(u);
        for (const edge of adjacency[u] ?? []) {
            const candidate = (best[u] as number) + edge.w;
            if (candidate < (best[edge.to] as number)) {
                best[edge.to] = candidate;
                prev[edge.to] = u;
            }
        }
    }

    const path: number[] = [];
    if ((best[1] as number) !== Infinity) {
        let node = 1;
        while (node !== -1) {
            path.unshift(node);
            if (node === 0) break;
            node = prev[node] as number;
        }
    }

    let step = 0;
    const emit = (message: string, codeLine: number, pathSet: Set<string>, settledSet: Set<number>, meta: Record<string, number | string | boolean | Array<number | string>>): VisualFrame => {
        const entities: VisualEntity[] = vertices.map(([x, y], i) => ({
            id: `v-${i}`,
            type: "node" as const,
            label: i === 0 ? "S" : i === 1 ? "G" : String(i - 2),
            value: [x, y],
            state: i === 0 ? ("highlight" as const) : i === 1 ? ("pivot" as const) : (settledSet.has(i) ? "visited" : "unvisited"),
            x,
            y,
            width: 0,
            height: 0,
            metadata: { role: i === 0 ? "start" : i === 1 ? "goal" : "vertex" },
        }));
        const edges: VisualEdge[] = [];
        for (const [c, d] of obsEdges) {
            const ci = vertices.findIndex((p) => same(p, c));
            const di = vertices.findIndex((p) => same(p, d));
            edges.push({
                id: `obs-${edges.length}`,
                sourceId: `v-${ci}`,
                targetId: `v-${di}`,
                label: "",
                state: "idle",
                directed: false,
            });
        }
        const pathEdges = new Set<string>();
        for (let i = 0; i + 1 < path.length; i += 1) {
            const a = path[i] as number;
            const b = path[i + 1] as number;
            pathEdges.add(`${Math.min(a, b)}-${Math.max(a, b)}`);
        }
        for (let i = 0; i < n; i += 1) {
            for (const edge of adjacency[i] ?? []) {
                const key = `${Math.min(i, edge.to)}-${Math.max(i, edge.to)}`;
                edges.push({
                    id: `vis-${key}`,
                    sourceId: `v-${i}`,
                    targetId: `v-${edge.to}`,
                    label: edge.w.toFixed(1),
                    state: pathEdges.has(key) ? "path" : "comparing",
                    directed: false,
                });
            }
        }
        const frame: VisualFrame = {
            stepNumber: step,
            entities,
            edges,
            description: message,
            codeLineNumber: codeLine,
            layout: "point",
            meta,
        };
        step += 1;
        return frame;
    };

    yield emit(`Placed ${n} graph nodes (start, goal, and obstacle vertices); testing pairwise visibility.`, 1, new Set(), new Set(), { vertices: n, obstacles: obstacles.length });

    yield emit(`Built the visibility graph with ${adjacency.reduce((s, a) => s + a.length, 0) / 2} edges crossing no obstacle.`, 3, new Set(), new Set(), { vertices: n, edges: adjacency.reduce((s, a) => s + a.length, 0) / 2 });

    for (let i = 0; i < order.length; i += 1) {
        const u = order[i] as number;
        yield emit(`Dijkstra settled node ${u} at distance ${(best[u] as number).toFixed(2)}; relaxing its visible neighbors.`, 5, new Set(), new Set(order.slice(0, i + 1)), { settled: i + 1, node: u, distance: best[u] });
    }

    const length = best[1] as number;
    yield emit(
        length === Infinity ? "No collision-free path reaches the goal." : `Shortest path found with length ${length.toFixed(2)} through ${path.length} node(s).`,
        7,
        new Set(path.map((p) => `v-${p}`)),
        new Set(order),
        { reachable: length !== Infinity, length: Number.isFinite(length) ? length : 0, path },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The shortest route around polygon obstacles never needs a turn in open space: if a bend is not at an obstacle corner, it can be straightened to shorten the path. So the only useful waypoints are obstacle vertices plus the start and goal. Connect every pair of waypoints whose connecting segment is unobstructed, then find the shortest route in that visibility graph.",
        invariants: [
            "Every visibility edge lies entirely in free space and crosses no obstacle interior.",
            "Dijkstra never finalizes a node with a distance larger than a pending one.",
            "The path starts at the start node and ends at the goal node when reachable.",
        ],
        correctness:
            "Any collision-free path can be shortened so that all bends occur at obstacle vertices, giving a path composed of visibility edges and hence a path in the constructed graph. Conversely every graph path is collision-free because each edge is visible. Dijkstra returns the minimum-weight graph path, so its weight is the length of the shortest collision-free path.",
        complexityRationale:
            "For v waypoints and e obstacle edges, testing all pairs against all obstacle edges costs O(v^3). The visibility graph has O(v^2) edges, and Dijkstra with a linear search over nodes runs in O(v^2). Storage for the dense visibility graph is O(v^2).",
        uses: [
            "Robot motion planning among known polygonal obstacles",
            "Pathfinding for game characters around walls",
            "Computing shortest paths in CAD and map networks",
        ],
        references: [
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 15",
            "T. Lozano-Perez and M. A. Wesley, An Algorithm for Planning Collision-Free Paths, 1979",
        ],
        workedExample:
            "With one square obstacle between the start at (0,0) and the goal at (6,4), the straight segment crosses the square and is rejected. The visible routes go around either the lower-right or upper-left corner. Dijkstra compares the two polyline lengths through those corners and returns the shorter one as the path.",
    },
    id: "visibility-graph-path-planning",
    name: "Visibility Graph Path Planning",
    category: "geometry",
    complexity: { time: "O(v^3)", space: "O(v^2)" },
    defaultInput: {
        obstacles: [
            [[2, 2], [4, 2], [4, 4], [2, 4]],
            [[6, 1], [8, 1], [8, 3], [6, 3]],
        ],
        start: [0, 0],
        goal: [10, 5],
    },
    visualType: "point",
    run,
    pseudocode: [
        "collect the start, goal, and all obstacle vertices as nodes",
        "for every pair of nodes check the connecting segment",
        "accept an edge when it crosses no obstacle edge interior",
        "weight each accepted edge by Euclidean distance",
        "initialize distances with infinity and the start with zero",
        "settle the nearest unseen node and relax its visible neighbors",
        "stop when the goal is settled or no node remains",
        "done: reconstruct and report the shortest collision-free path",
    ],
};

export default module;
