/**
 * sah-bvh.ts - Surface-Area-Heuristic Bounding Volume Hierarchy
 *
 * Primitives are axis-aligned boxes. A BVH is built top down by trying a set
 * of centroid bins along each axis and keeping the split that minimizes the
 * surface-area heuristic cost. Leaves hold primitive indices and internal
 * nodes hold the union box of their children, so point queries can prune
 * whole subtrees.
 *
 * Limit: two-dimensional boxes use perimeter as the analogue of 3D surface
 * area; a fixed number of bins and a depth cap keep the teaching build small.
 *
 * Time:  O(depth * bins * n log n) to build, O(log n) typical query
 * Space: O(n) nodes
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Box = [number, number, number, number];

interface Node {
    box: Box;
    left?: Node;
    right?: Node;
    ids?: number[];
}

interface Step {
    ids: number[];
    box: Box;
    perimeter: number;
    leafCost: number;
    bestCost: number;
    axis: number;
    split: number;
    leftCount: number;
    rightCount: number;
    isLeaf: boolean;
}

function union(boxes: Box[], ids: number[]): Box {
    let minx = Infinity;
    let miny = Infinity;
    let maxx = -Infinity;
    let maxy = -Infinity;
    for (const id of ids) {
        const b = boxes[id]!;
        minx = Math.min(minx, b[0] ?? 0);
        miny = Math.min(miny, b[1] ?? 0);
        maxx = Math.max(maxx, b[2] ?? 0);
        maxy = Math.max(maxy, b[3] ?? 0);
    }
    return [minx, miny, maxx, maxy];
}

function perimeter(box: Box): number {
    return 2 * ((box[2] ?? 0) - (box[0] ?? 0) + (box[3] ?? 0) - (box[1] ?? 0));
}

function contains(box: Box, point: number[]): boolean {
    const x = point[0] ?? 0;
    const y = point[1] ?? 0;
    return (box[0] ?? 0) <= x && x <= (box[2] ?? 0) && (box[1] ?? 0) <= y && y <= (box[3] ?? 0);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { boxes?: Box[]; query?: number[]; bins?: number; maxDepth?: number } | null) ?? {};
    const boxes: Box[] = task.boxes ?? [
        [0, 0, 2, 2],
        [1, 1, 3, 3],
        [6, 0, 8, 2],
        [7, 1, 9, 3],
        [0, 6, 2, 8],
        [1, 7, 3, 9],
        [6, 6, 8, 8],
        [7, 7, 9, 9],
    ];
    const query = task.query ?? [1.5, 1.5];
    const bins = typeof task.bins === "number" ? Math.max(2, Math.min(8, task.bins)) : 4;
    const maxDepth = typeof task.maxDepth === "number" ? Math.max(1, Math.min(6, task.maxDepth)) : 4;
    const steps: Step[] = [];
    let nodeCount = 0;

    const centroid = (box: Box, axis: number): number =>
        axis === 0 ? ((box[0] ?? 0) + (box[2] ?? 0)) / 2 : ((box[1] ?? 0) + (box[3] ?? 0)) / 2;

    const build = (ids: number[], depth: number): Node => {
        nodeCount += 1;
        const box = union(boxes, ids);
        const perim = perimeter(box);
        const leafCost = ids.length;
        let bestCost = Infinity;
        let bestAxis = -1;
        let bestSplit = -1;
        let bestLeft: number[] = [];
        let bestRight: number[] = [];

        if (ids.length > 1 && depth < maxDepth && perim > 0) {
            for (let axis = 0; axis < 2; axis += 1) {
                const lo = axis === 0 ? (box[0] ?? 0) : (box[1] ?? 0);
                const hi = axis === 0 ? (box[2] ?? 0) : (box[3] ?? 0);
                const span = hi - lo;
                if (span <= 0) continue;
                for (let s = 1; s < bins; s += 1) {
                    const left: number[] = [];
                    const right: number[] = [];
                    for (const id of ids) {
                        const b = boxes[id]!;
                        const c = centroid(b, axis);
                        const bin = Math.max(0, Math.min(bins - 1, Math.floor(((c - lo) / span) * bins)));
                        (bin < s ? left : right).push(id);
                    }
                    if (left.length === 0 || right.length === 0) continue;
                    const cost = (perimeter(union(boxes, left)) * left.length + perimeter(union(boxes, right)) * right.length) / perim;
                    if (cost < bestCost) {
                        bestCost = cost;
                        bestAxis = axis;
                        bestSplit = s;
                        bestLeft = left;
                        bestRight = right;
                    }
                }
            }
        }

        const isLeaf = bestCost >= leafCost || bestAxis < 0;
        steps.push({
            ids: [...ids],
            box,
            perimeter: perim,
            leafCost,
            bestCost: isLeaf ? leafCost : bestCost,
            axis: bestAxis,
            split: bestSplit,
            leftCount: bestLeft.length,
            rightCount: bestRight.length,
            isLeaf,
        });
        if (isLeaf) return { box, ids: [...ids] };
        return { box, left: build(bestLeft, depth + 1), right: build(bestRight, depth + 1) };
    };

    const root = build(boxes.map((_, i) => i), 0);

    const queryBvh = (node: Node): number[] => {
        if (!contains(node.box, query)) return [];
        if (node.ids) return node.ids.filter((id) => contains(boxes[id]!, query));
        return [...queryBvh(node.left!), ...queryBvh(node.right!)];
    };
    const hits = queryBvh(root);
    const expected: number[] = [];
    boxes.forEach((box, i) => {
        if (contains(box, query)) expected.push(i);
    });
    const leaves: number[][] = [];
    const collectLeaves = (node: Node): void => {
        if (node.ids) leaves.push([...node.ids]);
        else {
            collectLeaves(node.left!);
            collectLeaves(node.right!);
        }
    };
    collectLeaves(root);
    const match = JSON.stringify([...hits].sort((a, b) => a - b)) === JSON.stringify([...expected].sort((a, b) => a - b));

    const entitiesFor = (focus: number[], hitsNow: number[]): VisualEntity[] =>
        boxes.map((box, i) => ({
            id: `box-${i}`,
            type: "cell" as const,
            label: `B${i} [${box.join(",")}]`,
            value: box,
            state: hitsNow.includes(i) ? ("sorted" as const) : focus.includes(i) ? ("active" as const) : ("idle" as const),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i, id: i },
        }));

    let step = 0;
    yield {
        stepNumber: step,
        entities: entitiesFor([], []),
        edges: [],
        description: `Building a surface-area-heuristic BVH over ${boxes.length} box(es) with ${bins} centroid bins.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: boxes.length, boxes: boxes.length, nodes: nodeCount },
    };
    step += 1;

    for (let i = 0; i < steps.length; i += 1) {
        const s = steps[i]!;
        yield {
            stepNumber: step,
            entities: entitiesFor(s.ids, []),
            edges: [],
            description: s.isLeaf
                ? `Node ${i + 1}: ${s.ids.length} primitive(s), leaf cost ${s.leafCost}; keeping as a leaf.`
                : `Node ${i + 1}: split axis ${s.axis === 0 ? "x" : "y"} at bin ${s.split}, SAH cost ${s.bestCost.toFixed(3)} below leaf cost ${s.leafCost}.`,
            codeLineNumber: s.isLeaf ? 3 : 6,
            layout: "grid",
            meta: {
                rows: 1,
                cols: boxes.length,
                node: i + 1,
                ids: s.ids,
                perimeter: s.perimeter,
                leafCost: s.leafCost,
                bestCost: s.bestCost,
                axis: s.axis,
                split: s.split,
                isLeaf: s.isLeaf,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: entitiesFor([], hits),
        edges: [],
        description: `BVH query at (${query[0]}, ${query[1]}) returned ${hits.length} hit(s); brute force found ${expected.length}; match ${match}.`,
        codeLineNumber: 8,
        layout: "grid",
        meta: {
            rows: 1,
            cols: boxes.length,
            nodes: nodeCount,
            leaves,
            queryPoint: query,
            hits,
            expected,
            match,
        },
    };
}

const module: AlgorithmModule = {
    id: "sah-bvh",
    name: "Surface-Area-Heuristic BVH",
    category: "geometry",
    complexity: { time: "O(depth * bins * n log n) build, O(log n) query", space: "O(n)" },
    defaultInput: {
        boxes: [
            [0, 0, 2, 2],
            [1, 1, 3, 3],
            [6, 0, 8, 2],
            [7, 1, 9, 3],
            [0, 6, 2, 8],
            [1, 7, 3, 9],
            [6, 6, 8, 8],
            [7, 7, 9, 9],
        ],
        query: [1.5, 1.5],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "compute the union box and its perimeter for the current node",
        "if the node holds one primitive or reached the depth cap, make a leaf",
        "for each axis and each centroid bin boundary",
        "partition primitives into a left and right set by centroid bin",
        "evaluate the surface-area heuristic cost of the partition",
        "keep the partition with the lowest cost, but never below the leaf cost",
        "recursively build the two children and store their union boxes",
        "query by pruning children whose box misses the point",
        "done: report the primitives reported by the BVH query",
    ],
    education: {
        intuition:
            "A bounding volume hierarchy groups nearby primitives under larger boxes so a query can discard many at once. The surface-area heuristic picks the split whose two child boxes have the smallest combined weighted perimeter, which tends to keep empty space out of the tree and makes queries fast.",
        invariants: [
            "Every primitive appears in exactly one leaf of the hierarchy.",
            "A node's box contains the boxes of all of its children.",
            "A query descends only into children whose box contains the query point.",
        ],
        correctness:
            "Because a node box is the union of its children's boxes, any primitive whose box contains the point lies inside every ancestor box on its path, so pruning cannot discard a true hit. Conversely, a primitive in a visited leaf has a box inside the leaf box, each visited leaf is tested primitive by primitive, so a primitive whose box misses the point is filtered out. The query therefore returns exactly the primitives whose boxes contain the point, which is verified against brute force.",
        complexityRationale:
            "At each level the build evaluates a constant number of bins and sorts at most n centroids, so with a depth cap the build is O(depth * bins * n log n). A query visits one branch per level, giving O(log n) typical cost, and the tree stores O(n) nodes.",
        uses: [
            "Ray tracing acceleration structures in offline and real-time renderers",
            "Broad-phase collision detection in physics engines",
            "Spatial indexing for large static scene graphs",
        ],
        references: [
            "Goldsmith and Salmon, Automatic Generation of Triangulation Hierarchies Using the Surface Area Heuristic, 1987",
            "Pharr, Jakob, and Humphreys, Physically Based Rendering, chapter 4",
        ],
        workedExample:
            "Eight boxes sit in four small clusters. The heuristic splits along x first, separating the left and right clusters, then splits each pair along y. Querying the point (1.5, 1.5) prunes the three other clusters and visits only the leaf whose two boxes both contain the point, returning boxes 0 and 1.",
    },
};

export default module;
