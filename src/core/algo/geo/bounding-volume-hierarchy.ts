/**
 * bounding-volume-hierarchy.ts - Top-down bounding volume hierarchy.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A BVH groups nearby objects into a tree of axis-aligned bounding boxes. The
 * root box encloses everything; each internal node splits its points by the
 * median along the axis with the larger spread, and a leaf holds a small
 * bucket of points. Ray and collision queries skip a whole subtree when they
 * miss its box, turning a linear scan into a logarithmic traversal on average.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n log^2 n) for n points with median sorting at each level
 *   Space: O(n) nodes and boxes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show the side length of their bounding box.
 *   - The tree layout places parents above their child boxes.
 *   - Nodes appear in breadth-first order as the hierarchy is built.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];
interface Node {
    id: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    left: number | null;
    right: number | null;
    points: number[];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[]; leafSize?: number } | null) ?? {};
    const points: Pt[] = task.points ?? [
        [1, 2], [2, 1], [3, 3], [4, 2], [5, 5],
        [6, 4], [7, 6], [8, 5], [2, 7], [9, 8],
    ];
    const leafSize = Math.max(1, Math.min(8, task.leafSize ?? 2));
    const nodes: Node[] = [];

    const build = (indices: number[]): number => {
        let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
        for (const index of indices) {
            const point = points[index] as Pt;
            minX = Math.min(minX, point[0]);
            minY = Math.min(minY, point[1]);
            maxX = Math.max(maxX, point[0]);
            maxY = Math.max(maxY, point[1]);
        }
        const node: Node = { id: nodes.length, minX, minY, maxX, maxY, left: null, right: null, points: [] };
        nodes.push(node);
        if (indices.length <= leafSize) {
            node.points = indices.slice();
            return node.id;
        }
        const spreadX = maxX - minX;
        const spreadY = maxY - minY;
        const axis = spreadX >= spreadY ? 0 : 1;
        const sorted = indices.slice().sort((a, b) => (points[a] as Pt)[axis] - (points[b] as Pt)[axis] || a - b);
        const middle = Math.floor(sorted.length / 2);
        node.left = build(sorted.slice(0, middle));
        node.right = build(sorted.slice(middle));
        return node.id;
    };

    const root = build(points.map((_point, index) => index));
    const order: number[] = [];
    const parentOf = new Map<number, number>();
    const queue: number[] = [root];
    while (queue.length > 0) {
        const id = queue.shift();
        if (id === undefined) continue;
        order.push(id);
        const node = nodes[id] as Node;
        if (node.left !== null) { parentOf.set(node.left, id); queue.push(node.left); }
        if (node.right !== null) { parentOf.set(node.right, id); queue.push(node.right); }
    }

    const frameFor = (count: number, step: number, description: string, codeLine: number): VisualFrame => {
        const visible = order.slice(0, count);
        const visibleSet = new Set(visible);
        const entities: VisualEntity[] = visible.map((id) => {
            const node = nodes[id] as Node;
            const side = Math.max(node.maxX - node.minX, node.maxY - node.minY);
            const parent = parentOf.get(id);
            return {
                id: `node-${id}`,
                type: "node" as const,
                label: `${side.toFixed(1)}`,
                value: [node.minX, node.minY, node.maxX, node.maxY],
                state: (node.left === null ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: parent === undefined || !visibleSet.has(parent) ? "root" : `node-${parent}`, side },
            };
        });
        const edges: VisualEdge[] = [];
        for (const id of visible) {
            const node = nodes[id] as Node;
            for (const child of [node.left, node.right]) {
                if (child !== null && visibleSet.has(child)) {
                    edges.push({ id: `edge-${id}-${child}`, sourceId: `node-${id}`, targetId: `node-${child}`, label: "", state: "idle", directed: true });
                }
            }
        }
        const structure = visible.map((id) => {
            const node = nodes[id] as Node;
            return {
                id,
                minX: node.minX, minY: node.minY, maxX: node.maxX, maxY: node.maxY,
                left: node.left, right: node.right, points: node.points.slice(),
            };
        });
        return {
            stepNumber: step,
            entities,
            edges,
            description,
            codeLineNumber: codeLine,
            layout: "tree",
            meta: { structure, root, count: visible.length, totalNodes: order.length, leafSize, pointCount: points.length },
        };
    };

    let step = 0;
    yield frameFor(0, step++, `Starting a BVH over ${points.length} points with leaf capacity ${leafSize}.`, 0);
    for (let i = 0; i < order.length; i += 1) {
        const node = nodes[order[i] as number] as Node;
        yield frameFor(
            i + 1,
            step++,
            i === 0
                ? `Root box spans ${(node.maxX - node.minX).toFixed(1)} by ${(node.maxY - node.minY).toFixed(1)}.`
                : `Added box ${i + 1} of ${order.length}; ${node.left === null ? "leaf holds " + node.points.length + " point(s)" : "internal node splits its points"}.`,
            i === 0 ? 1 : 3,
        );
    }
    yield frameFor(order.length, step, `BVH complete with ${order.length} boxes and ${points.length} points.`, 7);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Wrap nearby objects in a box, wrap groups of boxes in larger boxes, and keep doing this until one box holds everything. A query that misses a box can ignore every object inside it, so most of the scene is skipped.",
        invariants: [
            "Every node's box contains all points in its subtree.",
            "Each input point is stored in exactly one leaf.",
            "Leaves hold no more than the configured capacity, except when the root itself is small.",
        ],
        correctness:
            "A node's box is computed directly from the coordinates of the points assigned to it, so it encloses all of them. Splitting by the median along the widest axis partitions the indices into two disjoint sets that are recursively processed, so every point appears in exactly one leaf and no point is lost. Because each ancestor box contains its children's boxes, a query that misses a box cannot contain any descendant point.",
        complexityRationale:
            "At each level the points are sorted by one coordinate, costing O(n log n) per level for O(log n) levels, so O(n log^2 n) build time; the tree has O(n) nodes and each stores one box, giving O(n) space.",
        uses: [
            "Ray tracing acceleration structures",
            "Broad-phase collision detection and frustum culling",
            "Spatial indexing for large point clouds",
        ],
        references: [
            "Ericson, Real-Time Collision Detection, chapter 6",
            "Shirley and Morley, Realistic Ray Tracing, chapter 4",
        ],
        workedExample:
            "Ten points in a roughly square region produce a root box spanning the whole cloud. The wider horizontal axis is chosen first, the median split sends the left five points to one child and the right five to the other, and each child is split again until leaves hold at most two points.",
    },
    id: "bounding-volume-hierarchy",
    name: "Bounding Volume Hierarchy",
    category: "geometry",
    complexity: { time: "O(n log^2 n)", space: "O(n)" },
    defaultInput: {
        points: [
            [1, 2], [2, 1], [3, 3], [4, 2], [5, 5],
            [6, 4], [7, 6], [8, 5], [2, 7], [9, 8],
        ],
        leafSize: 2,
    },
    visualType: "tree",
    run,
    pseudocode: [
        "given points and a leaf capacity",
        "compute the axis-aligned box enclosing all points",
        "create a node storing that box",
        "if the bucket fits in a leaf, store the point indices",
        "otherwise pick the axis with the larger spread",
        "sort points by that axis and split at the median",
        "recursively build the two child boxes",
        "return the root of the finished hierarchy",
    ],
};

export default module;
