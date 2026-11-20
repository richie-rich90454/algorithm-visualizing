/**
 * kd-tree-range-search.ts - KD-Tree Orthogonal Range Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Builds a two-dimensional k-d tree, splitting alternately on x and y at the
 * median point of each subtree. A rectangular range query descends only into
 * children whose splitting coordinate can still intersect the rectangle, so
 * large parts of the tree are pruned. Every reported point lies inside the
 * query rectangle, and every point inside is reported.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) build; O(sqrt(n) + k) expected query for k reported points
 *   Space: O(n) for the tree
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Points are nodes; the query rectangle is drawn from four corner nodes.
 *   - The visited node flashes YELLOW (comparing); matches turn GREEN (sorted).
 *   - Tree edges along the search path turn BLUE (active).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Left children have splitting coordinate <= the parent; right children >=.
 *   - A child is skipped only when the rectangle is wholly on the far side.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

interface KdNode {
    point: Point;
    source: number;
    axis: 0 | 1;
    left: number;
    right: number;
    parent: number;
}

interface Rect {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

function buildKd(
    points: Point[],
    indices: number[],
    depth: number,
    parentIndex: number,
    nodes: KdNode[],
): number {
    if (indices.length === 0) return -1;
    const axis: 0 | 1 = depth % 2 === 0 ? 0 : 1;
    const ordered = [...indices].sort(
        (a, b) => (points[a] as Point)[axis] - (points[b] as Point)[axis] || a - b,
    );
    const mid = Math.floor(ordered.length / 2);
    const source = ordered[mid] as number;
    const nodeIndex = nodes.length;
    nodes.push({
        point: points[source] as Point,
        source,
        axis,
        left: -1,
        right: -1,
        parent: parentIndex,
    });
    const left = buildKd(points, ordered.slice(0, mid), depth + 1, nodeIndex, nodes);
    const right = buildKd(points, ordered.slice(mid + 1), depth + 1, nodeIndex, nodes);
    const node = nodes[nodeIndex] as KdNode;
    node.left = left;
    node.right = right;
    return nodeIndex;
}

function inside(point: Point, rect: Rect): boolean {
    const [x, y] = point;
    return x >= rect.x1 && x <= rect.x2 && y >= rect.y1 && y <= rect.y2;
}

interface Visit {
    node: number;
    found: number[];
    visited: number[];
}

function* collectVisits(nodes: KdNode[], root: number, rect: Rect): Generator<Visit, void, unknown> {
    if (root === -1) return;
    const visited: number[] = [];
    const foundSet = new Set<number>();

    function* walk(nodeIndex: number): Generator<Visit, void, unknown> {
        if (nodeIndex === -1) return;
        const node = nodes[nodeIndex] as KdNode;
        visited.push(nodeIndex);
        if (inside(node.point, rect)) foundSet.add(node.source);
        yield { node: nodeIndex, found: [...foundSet], visited: [...visited] };
        const value = node.point[node.axis];
        const lo = node.axis === 0 ? rect.x1 : rect.y1;
        const hi = node.axis === 0 ? rect.x2 : rect.y2;
        if (lo <= value) yield* walk(node.left);
        if (hi >= value) yield* walk(node.right);
    }

    yield* walk(root);
}

function makeFrameParts(
    points: Point[],
    nodes: KdNode[],
    rect: Rect,
    found: Set<number>,
    visited: Set<number>,
    currentNode: number,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const currentSource = currentNode >= 0 ? (nodes[currentNode] as KdNode).source : -1;
    const entities: VisualEntity[] = points.map((point, index) => {
        let state: EntityState = "idle";
        if (found.has(index)) state = "sorted";
        else if (index === currentSource) state = "comparing";
        else if ([...visited].some((n) => (nodes[n] as KdNode).source === index)) state = "active";
        return {
            id: `point-${index}`,
            type: "node" as const,
            label: `(${point[0]},${point[1]})`,
            value: point,
            state,
            x: point[0],
            y: point[1],
            width: 0,
            height: 0,
            metadata: { index, px: point[0], py: point[1] },
        };
    });

    const corners: Point[] = [
        [rect.x1, rect.y1],
        [rect.x2, rect.y1],
        [rect.x2, rect.y2],
        [rect.x1, rect.y2],
    ];
    corners.forEach((corner, i) => {
        entities.push({
            id: `corner-${i}`,
            type: "node" as const,
            label: "",
            value: corner,
            state: "highlight",
            x: corner[0],
            y: corner[1],
            width: 0,
            height: 0,
            metadata: { corner: i },
        });
    });

    const edges: VisualEdge[] = [];
    for (let i = 0; i < corners.length; i += 1) {
        edges.push({
            id: `rect-edge-${i}`,
            sourceId: `corner-${i}`,
            targetId: `corner-${(i + 1) % corners.length}`,
            label: "",
            state: "path",
            directed: false,
        });
    }
    for (let i = 1; i < nodes.length; i += 1) {
        const node = nodes[i] as KdNode;
        if (node.parent === -1) continue;
        const parentNode = nodes[node.parent] as KdNode;
        const state: EntityState = visited.has(i) && visited.has(node.parent) ? "active" : "idle";
        edges.push({
            id: `tree-edge-${parentNode.source}-${node.source}`,
            sourceId: `point-${parentNode.source}`,
            targetId: `point-${node.source}`,
            label: "",
            state,
            directed: false,
        });
    }
    return { entities, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { points?: Point[]; query?: { x1: number; y1: number; x2: number; y2: number } } | null
    ) ?? {};
    const points: Point[] = Array.isArray(task.points)
        ? task.points.map((p) => [Number(p[0]), Number(p[1])] as Point)
        : [
              [2, 3],
              [5, 4],
              [9, 1],
              [4, 7],
              [8, 8],
              [1, 2],
              [7, 6],
              [3, 9],
              [6, 2],
          ];
    const q = task.query ?? { x1: 3, y1: 2, x2: 7, y2: 8 };
    const rect: Rect = {
        x1: Math.min(q.x1, q.x2),
        x2: Math.max(q.x1, q.x2),
        y1: Math.min(q.y1, q.y2),
        y2: Math.max(q.y1, q.y2),
    };
    const nodes: KdNode[] = [];
    const root = buildKd(
        points,
        points.map((_p, i) => i),
        0,
        -1,
        nodes,
    );
    let step = 0;

    const initial = makeFrameParts(points, nodes, rect, new Set(), new Set(), -1);
    yield {
        stepNumber: step,
        entities: initial.entities,
        edges: initial.edges,
        description: `Built a k-d tree over ${points.length} points; querying the highlighted rectangle.`,
        codeLineNumber: 0,
        layout: "point",
        meta: {
            points: points.length,
            inside: 0,
            visited: 0,
            bounds: [rect.x1, rect.y1, rect.x2, rect.y2],
            found: [],
        },
    };
    step += 1;

    const visits = [...collectVisits(nodes, root, rect)];
    for (const visit of visits) {
        const found = new Set(visit.found);
        const visited = new Set(visit.visited);
        const parts = makeFrameParts(points, nodes, rect, found, visited, visit.node);
        yield {
            stepNumber: step,
            entities: parts.entities,
            edges: parts.edges,
            description: `Visiting k-d node ${visit.node}; ${found.size} point(s) inside so far.`,
            codeLineNumber: 3,
            layout: "point",
            meta: {
                points: points.length,
                inside: found.size,
                visited: visited.size,
                bounds: [rect.x1, rect.y1, rect.x2, rect.y2],
                found: visit.found,
            },
        };
        step += 1;
    }

    const last = visits[visits.length - 1];
    const finalFound = new Set(last?.found ?? []);
    const finalVisited = new Set(last?.visited ?? []);
    const parts = makeFrameParts(points, nodes, rect, finalFound, finalVisited, -1);
    yield {
        stepNumber: step,
        entities: parts.entities,
        edges: parts.edges,
        description: `Done: ${finalFound.size} of ${points.length} points lie inside the query rectangle.`,
        codeLineNumber: 6,
        layout: "point",
        meta: {
            points: points.length,
            inside: finalFound.size,
            visited: finalVisited.size,
            bounds: [rect.x1, rect.y1, rect.x2, rect.y2],
            found: last?.found ?? [],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A k-d tree repeatedly splits the points by their median x-coordinate, then median y-coordinate, and so on. To answer a rectangle query, compare the rectangle with the splitting line at each node: if the rectangle lies entirely on one side, skip the far subtree. The points that survive are exactly those inside the rectangle.",
        invariants: [
            "At each node, the left subtree's splitting coordinate is at most the node's, and the right subtree's is at least.",
            "Every reported point satisfies all four rectangle inequalities.",
            "A subtree is pruned only when no point in it can be inside the rectangle.",
        ],
        correctness:
            "The split invariant makes the pruning test sound: if the rectangle's lower bound exceeds the splitting coordinate, the left subtree cannot contain a qualifying point, and symmetrically for the right. Recursing into exactly the possibly intersecting children therefore visits every point inside the rectangle and no subtree that could be skipped, so the reported set equals the brute-force answer.",
        complexityRationale:
            "Building sorts the median at each level, costing O(n log n) overall. A balanced k-d tree query crosses O(sqrt(n)) nodes plus k reported points in two dimensions, and the tree stores one node per point, O(n) space.",
        uses: [
            "Geographic information systems and map viewport queries",
            "Nearest-neighbor and collision detection preprocessing",
            "Range filters in multidimensional databases",
        ],
        references: [
            "Bentley, Multidimensional Binary Search Trees, 1975",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 5",
        ],
        workedExample:
            "With points (2,3), (5,4), (9,1), (4,7), (1,2), (7,6) and rectangle x in [3,7], y in [2,8], the tree first splits on x at (4,7), prunes the branch holding (2,3) and (1,2), and reports (5,4), (4,7) and (7,6).",
    },
    id: "kd-tree-range-search",
    name: "KD-Tree Range Search",
    category: "searching",
    complexity: { time: "O(n log n) build; O(sqrt(n)+k) query", space: "O(n)" },
    defaultInput: {
        points: [
            [2, 3],
            [5, 4],
            [9, 1],
            [4, 7],
            [8, 8],
            [1, 2],
            [7, 6],
            [3, 9],
            [6, 2],
        ],
        query: { x1: 3, y1: 2, x2: 7, y2: 8 },
    },
    visualType: "point",
    run,
    pseudocode: [
        "build a k-d tree by median split, alternating x and y by depth",
        "store each point on the splitting coordinate axis",
        "for a rectangle query start at the root",
        "test whether the current point lies inside the rectangle",
        "descend into the near child when the rectangle reaches it",
        "descend into the far child only when the rectangle crosses the split",
        "skip a child that lies wholly outside the rectangle",
        "done: report every point collected inside the rectangle",
    ],
};

export default module;
