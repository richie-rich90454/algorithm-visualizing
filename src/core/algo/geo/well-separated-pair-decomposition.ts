/**
 * well-separated-pair-decomposition.ts - Well-Separated Pair Decomposition.
 *
 * A WSPD pairs up subsets of points so that every pair of distinct points is
 * represented by at least one subset pair, and each subset pair is geometrically
 * well separated: the boxes containing them are far apart compared with their
 * own diameters. A quadtree supplies the subsets, and a recursive pairing rule
 * splits the larger side until the separation condition holds.
 *
 * Time:  O(n log n) for a fixed separation constant
 * Space: O(n log n) pairs in the worst case
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];
type Box = { x1: number; y1: number; x2: number; y2: number };
type QNode = { id: string; box: Box; indices: number[]; children: QNode[]; leaf: boolean };

const boxOf = (points: Point[], indices: number[]): Box => ({
    x1: Math.min(...indices.map((i) => points[i][0])),
    y1: Math.min(...indices.map((i) => points[i][1])),
    x2: Math.max(...indices.map((i) => points[i][0])),
    y2: Math.max(...indices.map((i) => points[i][1])),
});
const diameter = (box: Box): number => Math.max(box.x2 - box.x1, box.y2 - box.y1);
const boxDistance = (a: Box, b: Box): number => {
    const dx = Math.max(0, a.x1 - b.x2, b.x1 - a.x2);
    const dy = Math.max(0, a.y1 - b.y2, b.y1 - a.y2);
    return Math.hypot(dx, dy);
};
const separated = (a: Box, b: Box): boolean => Math.max(diameter(a), diameter(b)) <= boxDistance(a, b);

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[] } | null) ?? {};
    const points: Point[] = task.points ?? [
        [0, 0], [1, 0], [0, 1], [1, 1], [8, 8], [9, 8], [8, 9], [9, 9], [4, 4],
    ];

    let seq = 0;
    const build = (indices: number[]): QNode => {
        seq += 1;
        const node: QNode = { id: `q-${seq}`, box: boxOf(points, indices), indices, children: [], leaf: true };
        if (indices.length <= 1) return node;
        const mx = (node.box.x1 + node.box.x2) / 2;
        const my = (node.box.y1 + node.box.y2) / 2;
        const quadrants: number[][] = [[], [], [], []];
        for (const i of indices) {
            const [x, y] = points[i] as Point;
            quadrants[(x < mx ? 0 : 1) + (y < my ? 0 : 2)]?.push(i);
        }
        const nonempty = quadrants.filter((q) => q.length > 0);
        if (nonempty.length > 1) {
            node.children = nonempty.map(build);
            node.leaf = false;
        }
        return node;
    };
    const root = build(points.map((_, i) => i));

    type Pair = { a: number[]; b: number[]; separated: boolean };
    const pairs: Pair[] = [];
    const findPairs = (a: QNode, b: QNode): void => {
        if (separated(a.box, b.box)) {
            pairs.push({ a: a.indices, b: b.indices, separated: true });
            return;
        }
        if (a.leaf && b.leaf) {
            pairs.push({ a: a.indices, b: b.indices, separated: separated(a.box, b.box) });
            return;
        }
        if (diameter(a.box) >= diameter(b.box)) {
            for (const child of a.children) findPairs(child, b);
        } else {
            for (const child of b.children) findPairs(a, child);
        }
    };
    const collectFrom = (node: QNode): void => {
        if (node.leaf) return;
        for (let i = 0; i < node.children.length; i += 1) {
            for (let j = i + 1; j < node.children.length; j += 1) {
                findPairs(node.children[i] as QNode, node.children[j] as QNode);
            }
        }
        for (const child of node.children) collectFrom(child);
    };
    collectFrom(root);

    let step = 0;
    const emit = (message: string, codeLine: number, edge: VisualEdge | null, active: Set<number>, meta: Record<string, number | string | boolean | Array<number | string>>): VisualFrame => {
        const entities: VisualEntity[] = points.map(([x, y], i) => ({
            id: `p-${i}`,
            type: "node" as const,
            label: String(i),
            value: [x, y],
            state: active.has(i) ? ("active" as const) : ("unvisited" as const),
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index: i },
        }));
        const edges: VisualEdge[] = edge ? [edge] : [];
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

    yield emit(`Built a quadtree over ${points.length} points; generating well-separated subset pairs.`, 1, null, new Set(), { points: points.length, pairs: pairs.length });

    for (let i = 0; i < pairs.length; i += 1) {
        const pair = pairs[i] as Pair;
        const edge: VisualEdge = {
            id: `pair-${i}`,
            sourceId: `p-${pair.a[0]}`,
            targetId: `p-${pair.b[0]}`,
            label: pair.separated ? "sep" : "leaf",
            state: "path",
            directed: false,
        };
        const active = new Set([...pair.a, ...pair.b]);
        yield emit(
            `Pair ${i + 1}: ${pair.a.length} point(s) versus ${pair.b.length} point(s), ${pair.separated ? "well separated" : "leaf fallback"}.`,
            4,
            edge,
            active,
            { points: points.length, pair: i + 1, pairs: pairs.length, separated: pair.separated },
        );
    }

    const encoded = JSON.stringify(pairs.map((p) => ({ a: p.a, b: p.b, separated: p.separated })));
    yield emit(`Done: produced ${pairs.length} well-separated pair(s) from the quadtree decomposition.`, 6, null, new Set(), { points: points.length, pairs: pairs.length, pairsJson: encoded });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Listing every pair of points is expensive when there are many points. A well-separated pair decomposition instead groups points into many small clusters and pairs those clusters when they are far apart relative to their own size. It is like summarizing all relationships by a compact set of far-apart group pairs, which is enough to approximate many geometric sums quickly.",
        invariants: [
            "Every emitted pair links two nonempty subsets of points.",
            "A pair is well separated when the larger box diameter is at most the distance between the two boxes.",
            "For any two distinct points there is at least one emitted pair that places them in opposite subsets.",
        ],
        correctness:
            "At an internal quadtree node, sibling boxes together cover all cross-sibling point pairs. If two sibling boxes are not separated, the recursive rule descends into the larger-diameter side, splitting it into smaller children; because diameters shrink with depth, the process reaches separated child boxes or single-point leaves. Single-point leaves have zero diameter and are separated from any box at positive distance, so recursion terminates and each original cross pair is eventually represented by a separated pair.",
        complexityRationale:
            "Building the quadtree takes O(n log n) and the pairing recursion emits O(n log n) pairs for a fixed separation constant and well-conditioned data. Each node and each pair stores O(1) information, so space matches the number of pairs, O(n log n).",
        uses: [
            "Fast approximation of sums over all point pairs",
            "Computing geometric distances and closest-pair estimates",
            "Accelerating n-body and kernel-density computations",
        ],
        references: [
            "P. B. Callahan and S. R. Kosaraju, A Decomposition of Multidimensional Point Sets with Applications, 1995",
            "de Berg et al., Computational Geometry: Algorithms and Applications, Chapter 10",
        ],
        workedExample:
            "For four points clustered near (0,0) and four near (8,8), the quadtree root splits the two clusters. Their boxes are far apart compared with their diameters, so one separated pair represents all sixteen cross-cluster point pairs at once, avoiding sixteen explicit enumerations.",
    },
    id: "well-separated-pair-decomposition",
    name: "Well-Separated Pair Decomposition",
    category: "geometry",
    complexity: { time: "O(n log n)", space: "O(n log n)" },
    defaultInput: {
        points: [[0, 0], [1, 0], [0, 1], [1, 1], [8, 8], [9, 8], [8, 9], [9, 9], [4, 4]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "build a quadtree with one point per leaf",
        "at each internal node consider every pair of child boxes",
        "if the boxes are well separated emit them as one pair",
        "otherwise descend into whichever box has the larger diameter",
        "repeat until the boxes separate or both sides are leaves",
        "record the point subsets for each emitted pair",
        "continue through all internal nodes of the tree",
        "done: return the compact well-separated pair set",
    ],
};

export default module;
