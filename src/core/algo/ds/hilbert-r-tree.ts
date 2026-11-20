/**
 * hilbert-r-tree.ts - Hilbert-Packed R-Tree for Spatial Window Queries.
 *
 * An R-tree groups nearby geometric objects under minimum bounding rectangles
 * arranged in a tree. This variant bulk-loads the tree by sorting object centers
 * along a Hilbert space-filling curve, which keeps spatially close objects in
 * the same leaf. A window query descends only into nodes whose bounding box
 * overlaps the query window.
 *
 * Time:  O(n log n) bulk load, O(log n + k) expected query
 * Space: O(n)
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Rect = { id: string; x1: number; y1: number; x2: number; y2: number };
type Box = { x1: number; y1: number; x2: number; y2: number };

const order = 6;
const GRID = 2 ** order;
const CAPACITY = 4;

/** Convert an integer grid coordinate pair to a Hilbert curve position. */
function hilbertIndex(x: number, y: number): number {
    let px = x;
    let py = y;
    let d = 0;
    for (let s = GRID >> 1; s > 0; s >>= 1) {
        const rx = (px & s) > 0 ? 1 : 0;
        const ry = (py & s) > 0 ? 1 : 0;
        d += s * s * ((3 * rx) ^ ry);
        if (ry === 0) {
            if (rx === 1) {
                px = GRID - 1 - px;
                py = GRID - 1 - py;
            }
            const tmp = px;
            px = py;
            py = tmp;
        }
    }
    return d;
}

const mbr = (rects: Rect[]): Box => ({
    x1: Math.min(...rects.map((r) => r.x1)),
    y1: Math.min(...rects.map((r) => r.y1)),
    x2: Math.max(...rects.map((r) => r.x2)),
    y2: Math.max(...rects.map((r) => r.y2)),
});
const overlaps = (a: Box, b: Box): boolean => a.x1 <= b.x2 && b.x1 <= a.x2 && a.y1 <= b.y2 && b.y1 <= a.y2;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { rectangles?: Array<[number, number, number, number]>; queries?: Array<[number, number, number, number]> } | null) ?? {};
    const rawRects: Array<[number, number, number, number]> = task.rectangles ?? [
        [0, 0, 2, 2], [3, 0, 5, 2], [1, 4, 3, 6], [6, 5, 8, 7], [5, 1, 7, 3], [2, 7, 4, 9], [7, 7, 9, 9], [0, 6, 2, 8],
    ];
    const queries: Array<[number, number, number, number]> = task.queries ?? [
        [0, 0, 4, 4], [5, 4, 9, 9],
    ];
    const rects: Rect[] = rawRects.map(([x1, y1, x2, y2], i) => ({ id: `rect-${i}`, x1, y1, x2, y2 }));

    const allX = rects.flatMap((r) => [r.x1, r.x2]);
    const allY = rects.flatMap((r) => [r.y1, r.y2]);
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    const scaleX = (x: number): number => Math.round(((x - minX) / (maxX - minX || 1)) * (GRID - 1));
    const scaleY = (y: number): number => Math.round(((y - minY) / (maxY - minY || 1)) * (GRID - 1));

    const sorted = [...rects].sort((a, b) => {
        const ha = hilbertIndex(scaleX((a.x1 + a.x2) / 2), scaleY((a.y1 + a.y2) / 2));
        const hb = hilbertIndex(scaleX((b.x1 + b.x2) / 2), scaleY((b.y1 + b.y2) / 2));
        return ha - hb;
    });

    type TreeNode = { id: string; box: Box; rectIds: string[]; children: TreeNode[]; leaf: boolean };
    let nodeSeq = 0;
    const buildLevel = (items: Array<{ rectIds: string[]; box: Box }>): TreeNode[] => {
        const groups: TreeNode[] = [];
        for (let i = 0; i < items.length; i += CAPACITY) {
            const chunk = items.slice(i, i + CAPACITY);
            nodeSeq += 1;
            groups.push({
                id: `node-${nodeSeq}`,
                box: mbr(chunk.map((c) => ({ id: "", ...c.box }))),
                rectIds: chunk.flatMap((c) => c.rectIds),
                children: [],
                leaf: false,
            });
        }
        return groups;
    };

    let leaves = buildLevel(sorted.map((r) => ({ rectIds: [r.id], box: { x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2 } })));
    let level = leaves;
    const allLevels: TreeNode[][] = [level];
    while (level.length > 1) {
        level = buildLevel(level.map((n) => ({ rectIds: [n.id], box: n.box })));
        // Rebuild children links from the previous level by matching ids.
        const prev = allLevels[allLevels.length - 1] as TreeNode[];
        for (const parent of level) {
            parent.children = prev.filter((n) => parent.rectIds.includes(n.id));
            parent.rectIds = parent.children.flatMap((c) => c.rectIds);
            parent.leaf = false;
        }
        allLevels.push(level);
    }
    const root = level[0] as TreeNode;
    root.children.length > 0 ? (root.leaf = false) : (root.leaf = root.rectIds.every((id) => id.startsWith("rect")));

    const queryTree = (node: TreeNode, window: Box, out: Set<string>): void => {
        if (!overlaps(node.box, window)) {
            return;
        }
        if (node.children.length > 0) {
            for (const child of node.children) queryTree(child, window, out);
            return;
        }
        for (const id of node.rectIds) {
            const rect = rects.find((r) => r.id === id);
            if (rect && overlaps(rect, window)) out.add(id);
        }
    };

    let step = 0;
    const makeFrame = (message: string, codeLine: number, highlight: Set<string>, meta: Record<string, number | string | boolean | Array<number | string>>): VisualFrame => {
        const entities: VisualEntity[] = rects.map((r) => ({
            id: r.id,
            type: "node" as const,
            label: r.id.replace("rect-", "r"),
            value: [(r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2],
            state: highlight.has(r.id) ? ("active" as const) : ("unvisited" as const),
            x: (r.x1 + r.x2) / 2,
            y: (r.y1 + r.y2) / 2,
            width: 0,
            height: 0,
            metadata: { role: "rect" },
        }));
        const edges: VisualEdge[] = [];
        const walk = (node: TreeNode): void => {
            const cx = (node.box.x1 + node.box.x2) / 2;
            const cy = (node.box.y1 + node.box.y2) / 2;
            entities.push({
                id: node.id,
                type: "node" as const,
                label: "box",
                value: [cx, cy],
                state: "idle",
                x: cx,
                y: cy,
                width: 0,
                height: 0,
                metadata: { role: "mbr", parentId: "root" },
            });
            for (const child of node.children) {
                edges.push({
                    id: `${node.id}-${child.id}`,
                    sourceId: node.id,
                    targetId: child.id,
                    label: "",
                    state: "idle",
                    directed: false,
                });
                walk(child);
            }
        };
        walk(root);
        queries.forEach((q, qi) => {
            entities.push({
                id: `q-${qi}`,
                type: "node" as const,
                label: "Q",
                value: [(q[0] + q[2]) / 2, (q[1] + q[3]) / 2],
                state: "comparing",
                x: (q[0] + q[2]) / 2,
                y: (q[1] + q[3]) / 2,
                width: 0,
                height: 0,
                metadata: { role: "query" },
            });
        });
        return {
            stepNumber: step,
            entities,
            edges,
            description: message,
            codeLineNumber: codeLine,
            layout: "point",
            meta,
        };
    };
    const emit = (message: string, codeLine: number, highlight: Set<string>, meta: Record<string, number | string | boolean | Array<number | string>>): VisualFrame => {
        const frame = makeFrame(message, codeLine, highlight, meta);
        frame.stepNumber = step;
        step += 1;
        return frame;
    };

    yield emit(`Placed ${rects.length} rectangles; assigning each a Hilbert curve position from its center.`, 1, new Set(), { rects: rects.length, leaves: leaves.length, levels: allLevels.length });

    yield emit(
        `Sorted rectangles along the Hilbert curve and grouped ${leaves.length} leaves of up to ${CAPACITY}.`,
        3,
        new Set(sorted.slice(0, CAPACITY).map((r) => r.id)),
        { rects: rects.length, leaves: leaves.length, levels: allLevels.length, order: sorted.map((r) => r.id) },
    );

    yield emit(`Bulk-loaded an R-tree of height ${allLevels.length} with a single root bounding box.`, 4, new Set(), { rects: rects.length, leaves: leaves.length, levels: allLevels.length });

    const results: string[][] = [];
    for (let qi = 0; qi < queries.length; qi += 1) {
        const q = queries[qi] as [number, number, number, number];
        const window = { x1: q[0], y1: q[1], x2: q[2], y2: q[3] };
        const found = new Set<string>();
        queryTree(root, window, found);
        const ids = [...found];
        results.push(ids);
        yield emit(
            `Window query ${qi + 1} found ${ids.length} rectangle(s) by visiting overlapping bounding boxes only.`,
            6,
            found,
            { rects: rects.length, query: qi, matches: ids },
        );
    }

    yield emit(`Done: answered ${queries.length} window queries with the Hilbert-packed R-tree.`, 7, new Set(), { rects: rects.length, resultsJson: JSON.stringify(results) });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An R-tree is a family tree of bounding boxes: nearby shapes share a box, boxes are grouped into larger boxes, and one root box covers everything. To keep the groups compact, this version sorts shape centers along a Hilbert curve, a path that visits nearby places before faraway ones, then slices the sorted list into leaves. A window query skips any branch whose box does not overlap the window.",
        invariants: [
            "Every node's bounding box contains the boxes of all its children.",
            "A rectangle is stored in exactly one leaf.",
            "A window query visits only nodes whose bounding box overlaps the query window.",
        ],
        correctness:
            "Because every stored rectangle lies inside its leaf box and every leaf box lies inside each ancestor box, a rectangle that meets the query window cannot be hidden under a node whose box misses the window. Skipping those branches therefore cannot discard a true match. At a visited leaf, testing each rectangle against the window returns exactly the rectangles that intersect it.",
        complexityRationale:
            "Computing a Hilbert index and sorting costs O(n log n); building each level touches every node once, O(n). A well-packed tree gives query cost proportional to the tree height plus the number of reported objects, O(log n + k), though worst-case overlap can degrade it.",
        uses: [
            "Spatial indexes in geographic information systems",
            "Bounding-box collision and viewport culling in games",
            "Indexing multidimensional features in databases",
        ],
        references: [
            "A. Guttman, R-Trees: A Dynamic Index Structure for Spatial Searching, SIGMOD 1984",
            "I. Kamel and C. Faloutsos, Hilbert R-Tree: An Improved R-Tree Using Fractals, VLDB 1994",
        ],
        workedExample:
            "For eight small squares scattered over a grid, the Hilbert order groups the lower-left squares into one leaf and the upper-right squares into another. A query over the lower-left quadrant descends only into the leaf whose box overlaps that quadrant and returns those squares, never examining the upper-right leaf.",
    },
    id: "hilbert-r-tree",
    name: "Hilbert R-Tree",
    category: "data-structures",
    complexity: { time: "O(n log n) build", space: "O(n)" },
    defaultInput: {
        rectangles: [
            [0, 0, 2, 2], [3, 0, 5, 2], [1, 4, 3, 6], [6, 5, 8, 7],
            [5, 1, 7, 3], [2, 7, 4, 9], [7, 7, 9, 9], [0, 6, 2, 8],
        ],
        queries: [[0, 0, 4, 4], [5, 4, 9, 9]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "compute a Hilbert curve position for each rectangle center",
        "sort rectangles by increasing Hilbert position",
        "slice the sorted rectangles into leaves of fixed capacity",
        "compute a bounding box for every group",
        "repeat grouping boxes into higher levels until one root remains",
        "for a query skip any node whose box misses the window",
        "at each reached leaf test rectangles against the window",
        "done: return all rectangles intersecting the query window",
    ],
};

export default module;
