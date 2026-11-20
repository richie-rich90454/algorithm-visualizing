/**
 * kd-tree-nearest-neighbor.ts - Nearest Neighbor Search in a KD-Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A kd-tree recursively splits a point set by alternating coordinate axes.
 * Nearest neighbor search descends toward the query first, then backtracks and
 * visits the other branch only when the bounding box of that branch could hold
 * a point closer than the best candidate found so far. For low-dimensional,
 * well-balanced data this prunes most of the tree.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) on balanced low-dimensional data, O(n) worst case
 *   Space: O(n) for the tree
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are plotted at their own coordinates (point layout).
 *   - The node under test is comparing; the current best is sorted.
 *   - Visited nodes are visited; pruned subtrees stay idle.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];
type BBox = { minX: number; maxX: number; minY: number; maxY: number };

interface TreeNode {
    index: number;
    point: Point;
    depth: number;
    left: TreeNode | null;
    right: TreeNode | null;
    bbox: BBox;
}

type TreeInput = { points?: Point[]; query?: Point };

function dist2(a: Point, b: Point): number {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return dx * dx + dy * dy;
}

function boxDist2(box: BBox, q: Point): number {
    const dx = q[0] < box.minX ? box.minX - q[0] : q[0] > box.maxX ? q[0] - box.maxX : 0;
    const dy = q[1] < box.minY ? box.minY - q[1] : q[1] > box.maxY ? q[1] - box.maxY : 0;
    return dx * dx + dy * dy;
}

function buildTree(points: Point[], indices: number[], depth: number): TreeNode | null {
    if (indices.length === 0) {
        return null;
    }
    const dim = depth % 2;
    const ordered = [...indices].sort((a, b) => {
        const pa = points[a] as Point;
        const pb = points[b] as Point;
        return pa[dim] - pb[dim] || a - b;
    });
    const mid = Math.floor(ordered.length / 2);
    const index = ordered[mid] as number;
    const left = buildTree(points, ordered.slice(0, mid), depth + 1);
    const right = buildTree(points, ordered.slice(mid + 1), depth + 1);
    const bbox: BBox = {
        minX: (points[index] as Point)[0],
        maxX: (points[index] as Point)[0],
        minY: (points[index] as Point)[1],
        maxY: (points[index] as Point)[1],
    };
    for (const child of [left, right]) {
        if (child) {
            bbox.minX = Math.min(bbox.minX, child.bbox.minX);
            bbox.maxX = Math.max(bbox.maxX, child.bbox.maxX);
            bbox.minY = Math.min(bbox.minY, child.bbox.minY);
            bbox.maxY = Math.max(bbox.maxY, child.bbox.maxY);
        }
    }
    return { index, point: points[index] as Point, depth, left, right, bbox };
}

function collectEdges(root: TreeNode | null, states: Map<string, EntityState>): VisualEdge[] {
    const edges: VisualEdge[] = [];
    const visit = (node: TreeNode | null): void => {
        if (!node) {
            return;
        }
        for (const child of [node.left, node.right]) {
            if (child) {
                const id = `edge-${node.index}-${child.index}`;
                edges.push({
                    id,
                    sourceId: `point-${node.index}`,
                    targetId: `point-${child.index}`,
                    label: "",
                    state: states.get(id) ?? "idle",
                    directed: false,
                });
                visit(child);
            }
        }
    };
    visit(root);
    return edges;
}

function makeNodes(points: Point[], states: Map<number, EntityState>): VisualEntity[] {
    return points.map(([x, y], index) => ({
        id: `point-${index}`,
        type: "node" as const,
        label: String(index),
        value: [x, y],
        state: states.get(index) ?? "unvisited",
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index, x, y },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TreeInput | null) ?? {};
    const points: Point[] = Array.isArray(task.points)
        ? task.points.map((p) => [p[0], p[1]] as Point)
        : [
              [1, 2],
              [3, 1],
              [5, 4],
              [7, 2],
              [2, 6],
              [6, 6],
              [8, 7],
              [4, 8],
          ];
    const query: Point = Array.isArray(task.query) ? [task.query[0], task.query[1]] : [6, 3];

    const root = buildTree(
        points,
        points.map((_, i) => i),
        0,
    );
    const visited = new Set<number>();
    const activeEdges = new Map<string, EntityState>();
    let bestIndex = -1;
    let bestDist = Infinity;
    let step = 1;
    const frames: VisualFrame[] = [];

    frames.push({
        stepNumber: 0,
        entities: makeNodes(points, new Map()),
        edges: collectEdges(root, activeEdges),
        description: `KD-tree built over ${points.length} points; searching nearest neighbor to (${query[0]}, ${query[1]}).`,
        codeLineNumber: 0,
        layout: "point",
        meta: { query, bestIndex, bestDist, visited: 0, pruned: 0 },
    });

    let pruned = 0;
    const visit = (node: TreeNode | null): void => {
        if (!node) {
            return;
        }
        visited.add(node.index);
        const d = dist2(node.point, query);
        if (d < bestDist) {
            bestDist = d;
            bestIndex = node.index;
        }
        const dim = node.depth % 2;
        const delta = query[dim] - node.point[dim];
        const near = delta < 0 ? node.left : node.right;
        const far = delta < 0 ? node.right : node.left;
        const nearId = near ? `edge-${node.index}-${near.index}` : "";
        if (near) {
            activeEdges.set(nearId, "active");
        }
        const states = new Map<number, EntityState>();
        for (const index of visited) {
            states.set(index, index === bestIndex ? "sorted" : "visited");
        }
        states.set(node.index, "comparing");
        if (bestIndex >= 0 && states.get(bestIndex) === "visited") {
            states.set(bestIndex, "sorted");
        }

        frames.push({
            stepNumber: step,
            entities: makeNodes(points, states),
            edges: collectEdges(root, activeEdges),
            description: `Visit point ${node.index} at (${node.point[0]}, ${node.point[1]}); squared distance ${d}, current best index ${bestIndex}.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { query, bestIndex, bestDist, visited: visited.size, pruned },
        });
        step += 1;
        activeEdges.delete(nearId);

        visit(near);
        if (far && boxDist2(far.bbox, query) <= bestDist) {
            const farId = `edge-${node.index}-${far.index}`;
            activeEdges.set(farId, "comparing");
            visit(far);
            activeEdges.delete(farId);
        } else if (far) {
            pruned += 1;
        }
    };

    if (root) {
        visit(root);
    }

    for (const frame of frames) {
        yield frame;
    }

    const finalStates = new Map<number, EntityState>();
    for (const index of visited) {
        finalStates.set(index, index === bestIndex ? "sorted" : "visited");
    }
    yield {
        stepNumber: frames.length,
        entities: makeNodes(points, finalStates),
        edges: collectEdges(root, new Map()),
        description: `Nearest neighbor to (${query[0]}, ${query[1]}) is point ${bestIndex} with squared distance ${bestDist}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { query, bestIndex, bestDist, visited: visited.size, pruned, found: bestIndex >= 0 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Organize points into a binary tree whose split axis alternates with depth. Starting at the root, go toward the side the query falls on, then consider the far side only if its bounding box is closer than the best point already found. The boxes turn most branches into cheap rejections.",
        invariants: [
            "A node's bounding box contains every point in its subtree.",
            "After each visit, bestDist is the smallest squared distance to a visited point.",
            "A subtree is skipped only when its box cannot contain a closer point.",
        ],
        correctness:
            "The near branch is explored first and the far branch is explored whenever its bounding box distance is no larger than the current best. Any point closer than the best must lie inside that box, so no closer point can be missed. The final best is therefore the exact nearest neighbor.",
        complexityRationale:
            "A balanced kd-tree has depth O(log n). Well-separated points prune most branches in O(log n) expected time; adversarial point sets can force visiting all n nodes, which is the O(n) worst case. The tree stores one node and one bounding box per point.",
        uses: [
            "Nearest neighbor lookup in low-dimensional feature spaces",
            "Collision and proximity queries in games and simulations",
            "Spatial joins and geographic point-of-interest search",
        ],
        references: [
            "Bentley, Multidimensional Binary Search Trees Used for Associative Searching, 1975",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 5",
        ],
        workedExample:
            "With points (1,2), (3,1), (5,4), (7,2) and query (6,3), the root splits on x at (5,4). The near child contains (7,2) at squared distance 2, so the far branch with (3,1) is pruned once its box is farther than 2. The answer is (7,2).",
    },
    id: "kd-tree-nearest-neighbor",
    name: "KD-Tree Nearest Neighbor Search",
    category: "geometry",
    complexity: { time: "O(log n) expected, O(n) worst", space: "O(n)" },
    defaultInput: {
        points: [
            [1, 2],
            [3, 1],
            [5, 4],
            [7, 2],
            [2, 6],
            [6, 6],
            [8, 7],
            [4, 8],
        ],
        query: [6, 3],
    },
    visualType: "point",
    run,
    pseudocode: [
        "build a balanced kd-tree by alternating split axes",
        "set the best point to none and best distance to infinity",
        "at each node update the best point with its own distance",
        "visit the child on the query side of the split first",
        "visit the far child only if its box is closer than the best",
        "otherwise prune that subtree",
        "done: report the best point and its squared distance",
    ],
};

export default module;
