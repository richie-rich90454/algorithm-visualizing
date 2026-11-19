/**
 * rrt-rapidly-exploring-random-tree.ts - Rapidly exploring random tree.
 *
 * RRT grows a tree from a start point by repeatedly sampling a point, finding
 * the nearest tree node, stepping a fixed distance toward the sample, and
 * adding the new point when the short segment avoids every obstacle. A goal
 * bias steers some samples directly toward the target, so a path appears once
 * the tree reaches the goal region. The random stream is seeded for replay.
 *
 *   Time:  O(iterations * (n + obstacles))
 *   Space: O(n) for the tree
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
type Circle = [number, number, number];

function node(id: string, p: Pt, state: EntityState, label: string): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: p,
        state,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: {},
    };
}

function segmentHitsCircle(a: Pt, b: Pt, circle: Circle): boolean {
    const [cx, cy, r] = circle;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) t = ((cx - a[0]) * dx + (cy - a[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a[0] + t * dx;
    const py = a[1] + t * dy;
    return Math.hypot(px - cx, py - cy) <= r;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        start?: Pt;
        goal?: Pt;
        bounds?: [number, number, number, number];
        obstacles?: Circle[];
        step?: number;
        iterations?: number;
        goalRadius?: number;
        seed?: number;
    } | null) ?? {};
    const start: Pt = task.start ?? [0, 0];
    const goal: Pt = task.goal ?? [10, 10];
    const bounds: [number, number, number, number] = task.bounds ?? [0, 0, 12, 12];
    const obstacles: Circle[] = task.obstacles ?? [[5, 4, 1.7], [7, 7, 1.7]];
    const step = task.step ?? 1.0;
    const iterations = task.iterations ?? 400;
    const goalRadius = task.goalRadius ?? 0.8;
    let seed = (task.seed ?? 7) >>> 0;
    const rand = (): number => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };

    let nodeStep = 0;
    const frame = (
        points: Pt[],
        edges: VisualFrame["edges"],
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: nodeStep,
        entities: points.map((p, i) =>
            node(`n-${i}`, p, i === 0 ? "highlight" : i === points.length - 1 ? "comparing" : "sorted", `n${i}`),
        ),
        edges,
        description,
        codeLineNumber,
        layout: "point",
        meta: { iterations, step, obstacles: obstacles.length, ...meta },
    });

    const points: Pt[] = [start];
    const parent: number[] = [-1];
    const makeEdges = (): VisualFrame["edges"] =>
        parent.slice(1).map((p, i) => ({
            id: `e-${i}`,
            sourceId: `n-${p}`,
            targetId: `n-${i + 1}`,
            label: "",
            state: "sorted" as EntityState,
            directed: false,
        }));

    yield frame(points, makeEdges(), `RRT from (${start}) to (${goal}) with ${obstacles.length} obstacle(s).`, 0);
    nodeStep += 1;

    const free = (a: Pt, b: Pt): boolean =>
        obstacles.every((c) => !segmentHitsCircle(a, b, c)) &&
        b[0] >= bounds[0] && b[0] <= bounds[2] && b[1] >= bounds[1] && b[1] <= bounds[3];

    let goalNode = -1;
    const chunk = Math.max(1, Math.ceil(iterations / 4));
    for (let i = 0; i < iterations; i += 1) {
        const sample: Pt = rand() < 0.12
            ? goal
            : [bounds[0] + rand() * (bounds[2] - bounds[0]), bounds[1] + rand() * (bounds[3] - bounds[1])];
        let nearest = 0;
        let best = Infinity;
        for (let k = 0; k < points.length; k += 1) {
            const d = Math.hypot(points[k]![0] - sample[0], points[k]![1] - sample[1]);
            if (d < best) {
                best = d;
                nearest = k;
            }
        }
        const from = points[nearest]!;
        const dirX = sample[0] - from[0];
        const dirY = sample[1] - from[1];
        const norm = Math.hypot(dirX, dirY);
        if (norm < 1e-9) continue;
        const length = Math.min(step, norm);
        const next: Pt = [from[0] + (dirX / norm) * length, from[1] + (dirY / norm) * length];
        if (!free(from, next)) continue;
        points.push(next);
        parent.push(nearest);
        if (Math.hypot(next[0] - goal[0], next[1] - goal[1]) <= goalRadius && free(next, goal)) {
            points.push(goal);
            parent.push(points.length - 2);
            goalNode = points.length - 1;
            break;
        }
        if ((i + 1) % chunk === 0 && nodeStep < 12) {
            yield frame(points, makeEdges(), `Iteration ${i + 1}: tree has ${points.length} node(s).`, 3, {
                iteration: i + 1,
                nodes: points.length,
            });
            nodeStep += 1;
        }
    }

    const path: number[] = [];
    if (goalNode >= 0) {
        let cursor = goalNode;
        while (cursor >= 0) {
            path.push(cursor);
            cursor = parent[cursor] ?? -1;
        }
        path.reverse();
    }
    const pathSet = new Set(path);
    const finalEntities = points.map((p, i) =>
        node(`n-${i}`, p, pathSet.has(i) ? "path" : "sorted", `n${i}`),
    );
    const finalEdges = parent.slice(1).map((q, i) => ({
        id: `e-${i}`,
        sourceId: `n-${q}`,
        targetId: `n-${i + 1}`,
        label: "",
        state: (pathSet.has(i) && pathSet.has(q) ? "path" : "sorted") as EntityState,
        directed: false,
    }));
    yield {
        stepNumber: nodeStep,
        entities: finalEntities,
        edges: finalEdges,
        description:
            goalNode >= 0
                ? `Goal reached after ${nodeStep} frames; path has ${path.length} node(s).`
                : `No collision-free path found within ${iterations} samples; tree has ${points.length} node(s).`,
        codeLineNumber: goalNode >= 0 ? 6 : 7,
        layout: "point",
        meta: { nodes: points.length, found: goalNode >= 0, path, obstacles: obstacles.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "RRT explores a geometric space by growing a tree one short segment at a time. Each round it picks a random point, finds the nearest node already in the tree, and extends toward the sample by a fixed step only if that short move avoids obstacles. Occasional samples aim straight at the goal, which biases growth toward a solution without giving up the broad exploration that makes RRT good in high-dimensional spaces.",
        invariants: [
            "Every tree edge is short enough to be a single steering step and collision free.",
            "The tree stays connected to the start because each new node attaches to an existing one.",
            "No node is added inside an obstacle or outside the given bounds.",
        ],
        correctness:
            "Each accepted segment is checked against every obstacle before it is added, so the tree is always a valid collision-free subset of free space. Attaching each new node to its nearest existing node keeps the structure a tree rooted at the start. When the tree reaches a point within the goal radius with a clear segment to the goal, walking parent pointers back to the start yields a continuous collision-free path, which is exactly a feasible motion plan.",
        complexityRationale:
            "For each of the iterations the algorithm scans all current nodes to find the nearest one and tests the candidate segment against all obstacles, so time is O(iterations * (n + obstacles)). Each accepted node stores one point and one parent link, giving O(n) space.",
        uses: [
            "Motion planning for robots and autonomous vehicles",
            "Path finding for animated characters around obstacles",
            "Exploring configuration spaces in high dimensions",
        ],
        references: [
            "LaValle and Kuffner, Rapidly-Exploring Random Trees: A New Tool for Path Planning, 1998",
            "LaValle, Planning Algorithms, Chapter 5",
        ],
        workedExample:
            'With a start at (0,0), a goal at (10,10), two circular obstacles, and a step size of 1, the seeded samples grow a branching tree around the obstacles. One of the goal-biased samples eventually extends to within 0.8 of the target with a clear final segment, and the parent chain traces a feasible path.',
    },
    id: "rrt-rapidly-exploring-random-tree",
    name: "RRT Rapidly Exploring Random Tree",
    category: "geometry",
    complexity: { time: "O(iterations * (nodes + obstacles))", space: "O(nodes)" },
    defaultInput: {
        start: [0, 0],
        goal: [10, 10],
        bounds: [0, 0, 12, 12],
        obstacles: [[5, 4, 1.7], [7, 7, 1.7]],
        step: 1,
        iterations: 400,
        goalRadius: 0.8,
        seed: 7,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "seed the tree with the start point",
        "repeat for a fixed number of iterations",
        "sample a random point with an occasional goal bias",
        "find the nearest node already in the tree",
        "step toward the sample by at most one step size",
        "add the new point when the short segment is collision free",
        "stop when the goal region is reached with a clear segment",
        "trace parent links from the goal back to the start",
    ],
};

export default module;
