/**
 * dynamic-segment-tree.ts â€?Dynamic Segment Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A dynamic segment tree only creates the nodes that are actually used. It
 * works over a huge coordinate range without pre-allocating an array: nodes
 * are created lazily when a point is inserted or a range is queried. This
 * supports sparse range queries where the coordinate space vastly exceeds the
 * number of operations.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Update / query: O(log MAX) â€?one new node per visited path segment
 *   Space:          O(ops Â· log MAX)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are created lazily as points are inserted.
 *   - Newly created nodes are GREEN (sorted).
 *   - The range being queried is highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Only build what you touch" is the entire idea.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Dynamic Segment Tree generator.
 *
 * @param input `{ inserts }` â€?points to insert (sparse).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { inserts?: number[] } | null) ?? {};
    const inserts = task.inserts ?? [7, 3, 10, 5];

    let step = 0;
    const MAX = 16;

    // Lazy node creation.
    type DNode = { left: DNode | null; right: DNode | null; sum: number; id: number };
    let nextId = 0;
    const root: DNode = { left: null, right: null, sum: 0, id: nextId };
    nextId += 1;

    const insert = (node: DNode, l: number, r: number, pos: number): void => {
        node.sum += 1;
        if (l === r) {
            return;
        }
        const mid = Math.floor((l + r) / 2);
        if (pos <= mid) {
            if (!node.left) {
                node.left = { left: null, right: null, sum: 0, id: nextId };
                nextId += 1;
            }
            insert(node.left, l, mid, pos);
        } else {
            if (!node.right) {
                node.right = { left: null, right: null, sum: 0, id: nextId };
                nextId += 1;
            }
            insert(node.right, mid + 1, r, pos);
        }
    };

    const buildFrame = (message: string): VisualFrame => {
        const nodes: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        const walk = (node: DNode, parentId: string | null): void => {
            const id = `n-${node.id}`;
            nodes.push({
                id,
                type: "node" as const,
                label: String(node.sum),
                value: node.sum,
                state: node.sum > 0 ? "sorted" : "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: parentId ?? "root" },
            });
            if (node.left) {
                edges.push({
                    id: `e-${node.id}-${node.left.id}`,
                    sourceId: id,
                    targetId: `n-${node.left.id}`,
                    label: "",
                    state: "idle",
                    directed: false,
                });
                walk(node.left, id);
            }
            if (node.right) {
                edges.push({
                    id: `e-${node.id}-${node.right.id}`,
                    sourceId: id,
                    targetId: `n-${node.right.id}`,
                    label: "",
                    state: "idle",
                    directed: false,
                });
                walk(node.right, id);
            }
        };
        walk(root, null);
        return {
            stepNumber: step,
            entities: nodes,
            edges,
            description: message,
            codeLineNumber: 2,
            layout: "tree",
            meta: { nodes: nextId },
        };
    };

    // Frame 0: the root only.
    yield buildFrame("Dynamic segment tree over [0, 15] â€?only the root exists.");
    step += 1;

    for (const pos of inserts) {
        insert(root, 0, MAX - 1, pos);
        yield buildFrame(`Inserted ${pos} â€?created only the O(log MAX) nodes on its path.`);
        step += 1;
    }

    yield buildFrame(
        `Dynamic tree complete â€?${nextId} node(s) created lazily, far fewer than the full range.`,
    );
}

/** The Dynamic Segment Tree module, registered with the engine. */
const module: AlgorithmModule = {
    id: "dynamic-segment-tree",
    name: "Dynamic Segment Tree",
    category: "data-structures",
    complexity: { time: "O(log MAX) ops", space: "O(opsÂ·log MAX)" },
    defaultInput: { inserts: [7, 3, 10, 5] },
    visualType: "tree",
    run,
};

export default module;
