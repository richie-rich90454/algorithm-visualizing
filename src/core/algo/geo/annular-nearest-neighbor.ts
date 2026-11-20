/**
 * annular-nearest-neighbor.ts - Annular Nearest Neighbor Search
 *
 * Find the closest point to a query whose distance lies inside an annulus
 * [inner, outer]. A kd-tree stores the sites with an axis-aligned bounding box
 * on every node. A subtree is pruned when its box lies entirely inside the
 * empty inner disk or entirely outside the outer disk; the remaining leaves are
 * checked exactly. The same idea underlies radius and ring queries on spatial
 * indexes.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];
interface Box {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}
interface KdNode {
    point: Point;
    index: number;
    axis: number;
    box: Box;
    left?: KdNode;
    right?: KdNode;
}

function boxOf(p: Point): Box {
    return { minX: p[0], maxX: p[0], minY: p[1], maxY: p[1] };
}

function union(a: Box, b: Box): Box {
    return {
        minX: Math.min(a.minX, b.minX),
        maxX: Math.max(a.maxX, b.maxX),
        minY: Math.min(a.minY, b.minY),
        maxY: Math.max(a.maxY, b.maxY),
    };
}

function distSq(p: Point, q: Point): number {
    const dx = p[0] - q[0];
    const dy = p[1] - q[1];
    return dx * dx + dy * dy;
}

function boxDistSq(box: Box, q: Point): [number, number] {
    const nearX = Math.max(box.minX, Math.min(q[0], box.maxX));
    const nearY = Math.max(box.minY, Math.min(q[1], box.maxY));
    const dx = nearX - q[0];
    const dy = nearY - q[1];
    const minD = dx * dx + dy * dy;
    const farX = Math.max(Math.abs(box.minX - q[0]), Math.abs(box.maxX - q[0]));
    const farY = Math.max(Math.abs(box.minY - q[1]), Math.abs(box.maxY - q[1]));
    return [minD, farX * farX + farY * farY];
}

function build(points: Point[], depth: number): KdNode | undefined {
    if (points.length === 0) return undefined;
    const axis = depth % 2;
    const sorted = points.map((p, i) => ({ p, i })).sort((a, b) => a.p[axis] - b.p[axis] || a.i - b.i);
    const mid = Math.floor(sorted.length / 2);
    const chosen = sorted[mid]!;
    const node: KdNode = { point: chosen.p, index: chosen.i, axis, box: boxOf(chosen.p) };
    node.left = build(sorted.slice(0, mid).map((x) => x.p), depth + 1);
    node.right = build(sorted.slice(mid + 1).map((x) => x.p), depth + 1);
    if (node.left) node.box = union(node.box, node.left.box);
    if (node.right) node.box = union(node.box, node.right.box);
    return node;
}

function makeEntities(points: Point[], query: Point, highlight: number): VisualEntity[] {
    const entities: VisualEntity[] = points.map((p, index) => ({
        id: `point-${index}`,
        type: "node" as const,
        label: String(index),
        value: p,
        state: (index === highlight ? "active" : "idle") as EntityState,
        x: p[0],
        y: p[1],
        width: 0,
        height: 0,
        metadata: { index, x: p[0], y: p[1] },
    }));
    entities.push({
        id: "query",
        type: "node" as const,
        label: "Q",
        value: query,
        state: "pivot",
        x: query[0],
        y: query[1],
        width: 0,
        height: 0,
        metadata: { index: -1, x: query[0], y: query[1] },
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[]; query?: Point; inner?: number; outer?: number } | null) ?? {};
    const points: Point[] = Array.isArray(task.points) && task.points.length > 0
        ? task.points.map((p) => [Number(p[0]), Number(p[1])] as Point)
        : [[1, 1], [2, 5], [3, 3], [5, 5], [6, 2], [7, 7], [4, 6], [2, 2], [8, 4], [5, 1]];
    const query: Point = Array.isArray(task.query) ? [Number(task.query[0]), Number(task.query[1])] : [4, 4];
    const inner = typeof task.inner === "number" ? Math.max(0, task.inner) : 1;
    const outer = typeof task.outer === "number" ? Math.max(inner, task.outer) : 3;
    const innerSq = inner * inner;
    const outerSq = outer * outer;

    const frames: VisualFrame[] = [];
    let visits = 0;
    let prunes = 0;
    let bestIndex = -1;
    let bestDist = Infinity;

    const push = (highlight: number, desc: string, line: number): void => {
        frames.push({
            stepNumber: frames.length,
            entities: makeEntities(points, query, highlight),
            edges: [],
            description: desc,
            codeLineNumber: line,
            layout: "point",
            meta: {
                inner,
                outer,
                query,
                nearest: bestIndex,
                distance: bestIndex === -1 ? 0 : Math.sqrt(bestDist),
                visits,
                prunes,
                pointCount: points.length,
            },
        });
    };

    push(-1, `Annular query from (${query[0]}, ${query[1]}) with radii ${inner} to ${outer}.`, 0);
    const root = build(points, 0);
    push(-1, `Built a kd-tree over ${points.length} point(s).`, 1);

    const visit = (node: KdNode | undefined): void => {
        if (!node) return;
        visits += 1;
        const [minD, maxD] = boxDistSq(node.box, query);
        if (minD > outerSq || maxD < innerSq) {
            prunes += 1;
            if (frames.length < 26) push(node.index, `Pruned a subtree whose box misses the annulus.`, 3);
            return;
        }
        const d = distSq(node.point, query);
        if (d >= innerSq && d <= outerSq && d < bestDist) {
            bestDist = d;
            bestIndex = node.index;
            if (frames.length < 26) push(node.index, `New nearest in annulus: point ${node.index} at distance ${Math.sqrt(d).toFixed(2)}.`, 4);
        }
        const first = query[node.axis] <= node.point[node.axis] ? node.left : node.right;
        const second = first === node.left ? node.right : node.left;
        visit(first);
        visit(second);
    };
    visit(root);

    for (const frame of frames) yield frame;
    yield {
        stepNumber: frames.length,
        entities: makeEntities(points, query, bestIndex).map((e) => ({
            ...e,
            state: (e.id === `point-${bestIndex}` ? "sorted" : e.id === "query" ? "pivot" : "idle") as EntityState,
        })),
        edges: [],
        description:
            bestIndex === -1
                ? `Done: no point lies in the annulus between ${inner} and ${outer}.`
                : `Done: nearest annular point is ${bestIndex} at distance ${Math.sqrt(bestDist).toFixed(2)}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: {
            inner,
            outer,
            query,
            nearest: bestIndex,
            distance: bestIndex === -1 ? 0 : Math.sqrt(bestDist),
            visits,
            prunes,
            pointCount: points.length,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An annular query asks for the nearest site that is neither too close nor too far. A kd-tree lets us discard whole subtrees at once: if a node's bounding box sits entirely inside the empty inner disk, or entirely beyond the outer radius, no point inside it can qualify.",
        invariants: [
            "A node's bounding box contains every point in its subtree.",
            "A subtree is pruned only when its entire box cannot intersect the annulus.",
            "The best distance always refers to a point whose distance is within the annulus.",
        ],
        correctness:
            "Because a bounding box encloses all descendant points, any subtree whose closest possible distance exceeds the outer radius or whose farthest possible distance is below the inner radius cannot contain a valid answer. Every unpruned leaf is examined, so the globally closest point in the annulus is found; if none exists the result is empty.",
        complexityRationale:
            "Building the balanced kd-tree takes O(n log n). A typical annular query visits O(sqrt(n) + k) nodes in two dimensions, though degenerate distributions can degrade to O(n).",
        uses: [
            "Location-based search within a distance band",
            "Collision detection restricted to a shell around an object",
            "Range queries on spatial databases and GIS indexes",
        ],
        references: [
            "Bentley, Multidimensional Binary Search Trees Used for Associative Searching, 1975",
            "de Berg et al., Computational Geometry: Algorithms and Applications, chapter on range searching",
        ],
        workedExample:
            "With points at (1,1), (3,3) and (5,5) and query (3,3), the site at the query has distance zero and is excluded by inner radius 0.5. The other two sites are both at distance about 2.83, so the search reports one of them as the annular nearest neighbor.",
    },
    id: "annular-nearest-neighbor",
    name: "Annular Nearest Neighbor",
    category: "geometry",
    complexity: { time: "O(sqrt n) typical", space: "O(n)" },
    defaultInput: {
        points: [[1, 1], [2, 5], [3, 3], [5, 5], [6, 2], [7, 7], [4, 6], [2, 2], [8, 4], [5, 1]],
        query: [4, 4],
        inner: 1,
        outer: 3,
    },
    visualType: "point",
    run,
    pseudocode: [
        "read the site set, query point, and annulus radii",
        "build a kd-tree with a bounding box on each node",
        "for the current node, compute its nearest and farthest box distance",
        "if the box misses the annulus, prune this subtree",
        "otherwise test the node point and recurse into children",
        "keep the closest point whose distance lies in the annulus",
        "done: report the annular nearest neighbor",
    ],
};

export default module;
