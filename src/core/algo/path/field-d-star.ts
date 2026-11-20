/**
 * field-d-star.ts - Field D Star (interpolation-based grid path planning)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Field D* improves grid path planning by interpolating traversal costs
 * between grid cells instead of treating each cell as a uniform block. An edge
 * between two grid points is charged using the bilinear interpolation of the
 * four surrounding cell costs at the edge midpoint, so diagonal moves and
 * partial crossings are costed smoothly. This is the core cost model that lets
 * Field D* produce natural-looking paths and replan cheaply as costs change.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) with a binary heap over n grid points and 8 neighbors
 *   Space: O(n) for distances, predecessors, and the priority queue
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid points show their traversal cost.
 *   - The point currently being settled is highlighted.
 *   - Relaxed edges are active; the final path is drawn in cyan.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type GridPoint = [number, number];

const DIRECTIONS: GridPoint[] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
];

/** Tiny binary min-heap keyed by distance. */
class MinHeap {
    private items: Array<{ dist: number; key: string }> = [];

    push(dist: number, key: string): void {
        this.items.push({ dist, key });
        let i = this.items.length - 1;
        while (i > 0) {
            const parent = Math.floor((i - 1) / 2);
            const p = this.items[parent];
            const c = this.items[i];
            if (!p || !c || p.dist <= c.dist) {
                break;
            }
            this.items[i] = p;
            this.items[parent] = c;
            i = parent;
        }
    }

    get size(): number {
        return this.items.length;
    }

    pop(): { dist: number; key: string } | undefined {
        const top = this.items[0];
        const last = this.items.pop();
        if (last === undefined) {
            return top;
        }
        if (this.items.length > 0) {
            this.items[0] = last;
            let i = 0;
            for (;;) {
                const left = 2 * i + 1;
                const right = 2 * i + 2;
                let smallest = i;
                const l = this.items[left];
                const r = this.items[right];
                const c = this.items[i];
                if (l && c && l.dist < c.dist) {
                    smallest = left;
                }
                const s = this.items[smallest];
                if (r && s && r.dist < s.dist) {
                    smallest = right;
                }
                if (smallest === i) {
                    break;
                }
                const sv = this.items[smallest];
                const cv = this.items[i];
                if (sv && cv) {
                    this.items[i] = sv;
                    this.items[smallest] = cv;
                }
                i = smallest;
            }
        }
        return top;
    }
}

/** The Field D* generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { costs?: number[][]; start?: GridPoint; goal?: GridPoint } | null) ?? {};
    const costs: number[][] = task.costs ?? [
        [1, 1, 1, 1, 1],
        [1, 5, 5, 5, 1],
        [1, 5, 1, 5, 1],
        [1, 5, 5, 5, 1],
        [1, 1, 1, 1, 1],
    ];
    const height = costs.length;
    const width = height > 0 ? (costs[0]?.length ?? 0) : 0;
    const start: GridPoint = task.start ?? [0, 0];
    const goal: GridPoint = task.goal ?? [width - 1, height - 1];

    const inBounds = (x: number, y: number): boolean =>
        x >= 0 && y >= 0 && x < width && y < height;
    const keyOf = (x: number, y: number): string => `${x},${y}`;
    const costAt = (x: number, y: number): number => {
        const cx = Math.min(width - 1, Math.max(0, x));
        const cy = Math.min(height - 1, Math.max(0, y));
        return costs[cy]?.[cx] ?? 1;
    };

    /** Bilinear interpolation of the four surrounding cell costs. */
    const interpolate = (x: number, y: number): number => {
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const fx = x - x0;
        const fy = y - y0;
        const c00 = costAt(x0, y0);
        const c10 = costAt(x0 + 1, y0);
        const c01 = costAt(x0, y0 + 1);
        const c11 = costAt(x0 + 1, y0 + 1);
        return (
            c00 * (1 - fx) * (1 - fy) +
            c10 * fx * (1 - fy) +
            c01 * (1 - fx) * fy +
            c11 * fx * fy
        );
    };

    /** Charge an 8-neighbor move using the interpolated midpoint cost. */
    const edgeCost = (ax: number, ay: number, bx: number, by: number): number => {
        const length = Math.hypot(bx - ax, by - ay);
        return length * interpolate((ax + bx) / 2, (ay + by) / 2);
    };
    const edgeId = (ax: number, ay: number, bx: number, by: number): string => {
        const a = keyOf(ax, ay);
        const b = keyOf(bx, by);
        return a <= b ? `edge-${a}-${b}` : `edge-${b}-${a}`;
    };

    let step = 0;

    const makeFrame = (
        states: Map<string, string>,
        activeEdges: Set<string>,
        pathEdges: Set<string>,
        pathNodes: Set<string>,
        description: string,
        codeLine: number,
        meta: Record<string, number | string | boolean>,
    ): VisualFrame => {
        const entities: VisualEntity[] = [];
        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const key = keyOf(x, y);
                let state = states.get(key) ?? "unvisited";
                if (pathNodes.has(key)) {
                    state = "path";
                }
                entities.push({
                    id: `cell-${key}`,
                    type: "node" as const,
                    label: String(costAt(x, y)),
                    value: costAt(x, y),
                    state: state as VisualEntity["state"],
                    x,
                    y,
                    width: 0,
                    height: 0,
                    metadata: { x, y, cost: costAt(x, y) },
                });
            }
        }
        if (entities.length === 0) {
            entities.push({
                id: "empty",
                type: "node" as const,
                label: "-",
                value: 0,
                state: "unvisited" as const,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { x: 0, y: 0, cost: 0 },
            });
        }
        const edges: VisualEdge[] = [];
        if (width > 0 && height > 0) {
            for (let y = 0; y < height; y += 1) {
                for (let x = 0; x < width; x += 1) {
                    for (const [dx, dy] of DIRECTIONS) {
                        const nx = x + dx;
                        const ny = y + dy;
                        if (!inBounds(nx, ny)) {
                            continue;
                        }
                        if (dx < 0 || (dx === 0 && dy < 0)) {
                            continue;
                        }
                        const id = edgeId(x, y, nx, ny);
                        edges.push({
                            id,
                            sourceId: `cell-${keyOf(x, y)}`,
                            targetId: `cell-${keyOf(nx, ny)}`,
                            label: edgeCost(x, y, nx, ny).toFixed(1),
                            state: pathEdges.has(id)
                                ? ("path" as const)
                                : activeEdges.has(id)
                                  ? ("active" as const)
                                  : ("idle" as const),
                            directed: false,
                        });
                    }
                }
            }
        }
        return {
            stepNumber: step,
            entities,
            edges,
            description,
            codeLineNumber: codeLine,
            layout: "point",
            meta,
        };
    };

    // Setup frame.
    const initialStates = new Map<string, string>([
        [keyOf(start[0], start[1]), "highlight"],
        [keyOf(goal[0], goal[1]), "highlight"],
    ]);
    yield makeFrame(
        initialStates,
        new Set(),
        new Set(),
        new Set(),
        "Field D*: edge costs come from bilinear interpolation of the four surrounding cell costs.",
        0,
        { width, height, settled: 0, found: false },
    );
    step += 1;

    if (!inBounds(start[0], start[1]) || !inBounds(goal[0], goal[1])) {
        yield makeFrame(
            initialStates,
            new Set(),
            new Set(),
            new Set(),
            "Start or goal is outside the grid; no path can be planned.",
            7,
            { width, height, settled: 0, found: false, pathCost: -1 },
        );
        return;
    }

    const dist = new Map<string, number>();
    const parent = new Map<string, string>();
    const settled = new Set<string>();
    const heap = new MinHeap();
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            dist.set(keyOf(x, y), Infinity);
        }
    }
    dist.set(keyOf(start[0], start[1]), 0);
    heap.push(0, keyOf(start[0], start[1]));

    while (heap.size > 0) {
        const item = heap.pop();
        if (!item) {
            break;
        }
        const current = item.key;
        if (settled.has(current)) {
            continue;
        }
        settled.add(current);
        const [cx, cy] = current.split(",").map(Number) as [number, number];
        const currentStates = new Map<string, string>();
        for (const key of settled) {
            currentStates.set(key, "visited");
        }
        currentStates.set(current, "active");
        currentStates.set(keyOf(start[0], start[1]), "highlight");
        currentStates.set(keyOf(goal[0], goal[1]), "highlight");
        const relaxed = new Set<string>();

        for (const [dx, dy] of DIRECTIONS) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (!inBounds(nx, ny)) {
                continue;
            }
            const nextKey = keyOf(nx, ny);
            if (settled.has(nextKey)) {
                continue;
            }
            const candidate = (dist.get(current) as number) + edgeCost(cx, cy, nx, ny);
            relaxed.add(edgeId(cx, cy, nx, ny));
            if (candidate < (dist.get(nextKey) as number)) {
                dist.set(nextKey, candidate);
                parent.set(nextKey, current);
                heap.push(candidate, nextKey);
            }
        }

        yield makeFrame(
            currentStates,
            relaxed,
            new Set(),
            new Set(),
            `Settled ${current} with interpolated cost ${(dist.get(current) as number).toFixed(2)}; relaxed ${relaxed.size} neighbor edge(s).`,
            4,
            { settled: settled.size, found: false, current },
        );
        step += 1;
    }

    // Reconstruct the final path using predecessor links.
    const goalKey = keyOf(goal[0], goal[1]);
    const found = dist.get(goalKey) !== Infinity;
    const pathNodes = new Set<string>();
    const pathEdges = new Set<string>();
    if (found) {
        let cursor = goalKey;
        pathNodes.add(cursor);
        while (parent.has(cursor)) {
            const prev = parent.get(cursor) as string;
            const [px, py] = prev.split(",").map(Number) as [number, number];
            const [qx, qy] = cursor.split(",").map(Number) as [number, number];
            pathEdges.add(edgeId(px, py, qx, qy));
            pathNodes.add(prev);
            cursor = prev;
        }
    }
    const finalStates = new Map<string, string>();
    for (const key of settled) {
        finalStates.set(key, "visited");
    }
    yield makeFrame(
        finalStates,
        new Set(),
        pathEdges,
        pathNodes,
        found
            ? `Path found with interpolated cost ${(dist.get(goalKey) as number).toFixed(2)} across ${pathNodes.size} point(s).`
            : "Goal is unreachable from the start.",
        7,
        {
            settled: settled.size,
            found,
            pathCost: found ? (dist.get(goalKey) as number) : -1,
            pathLength: pathNodes.size,
        },
    );
}

/** The Field D* module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain grid pathfinder charges a whole cell for stepping into it, which makes diagonal paths jagged. Field D* instead looks at the four cells surrounding a segment and blends their costs at the segment's midpoint. Cheap corners pull the path toward them, so the route follows the cost field smoothly rather than snapping to cell boundaries.",
        invariants: [
            "Every grid point keeps the cheapest discovered distance from the start.",
            "Relaxing an edge uses the bilinear interpolation at that edge's midpoint.",
            "Once a point is settled, its distance is final because all edge costs are positive.",
        ],
        correctness:
            "All edge costs are positive because cell costs are positive and interpolation is a convex combination. Dijkstra therefore settles points in nondecreasing distance order, and the standard relaxation argument shows each settled distance is optimal. The predecessor chain from the goal reconstructs a path whose summed interpolated edge costs equal that optimal distance.",
        complexityRationale:
            "There are n grid points and eight neighbors each, so the heap performs O(n) insertions and O(n) relaxations at O(log n) cost, giving O(n log n) time and O(n) space. Interpolation at a midpoint is constant work.",
        uses: [
            "Robot navigation over continuous terrain cost maps",
            "Video game pathfinding on elevation or risk fields",
            "Any grid planner that needs natural diagonal movement",
        ],
        references: [
            "Fergusson and Stentz, Field D*: An Interpolation-Based Path Planner and Replanner, 2007",
            "Dijkstra, A Note on Two Problems in Connexion with Graphs, 1959",
        ],
        workedExample:
            "On a 5 by 5 grid where the middle three by three block costs 5 and the border costs 1, a diagonal step from (0,1) to (1,2) samples the midpoint (0.5,1.5): its blended cost is below 5, so the path hugs the cheap border instead of cutting through the expensive block.",
    },
    id: "field-d-star",
    name: "Field D Star",
    category: "shortest-path",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        costs: [
            [1, 1, 1, 1, 1],
            [1, 5, 5, 5, 1],
            [1, 5, 1, 5, 1],
            [1, 5, 5, 5, 1],
            [1, 1, 1, 1, 1],
        ],
        start: [0, 0],
        goal: [4, 4],
    },
    visualType: "point",
    run,
    pseudocode: [
        "read the grid of cell traversal costs",
        "define cost at a point by bilinear interpolation of nearby cells",
        "charge each move by its length times interpolated midpoint cost",
        "push the start with distance zero into a min-heap",
        "pop the nearest unsettled point and settle it",
        "relax all eight neighbors using interpolated edge costs",
        "reconstruct the path from predecessor links at the goal",
        "done: report the path and its interpolated total cost",
    ],
};

export default module;
