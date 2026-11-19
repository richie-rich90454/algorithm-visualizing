/**
 * parallel-binary-search-tree.ts - Balanced BST Built by Parallel Level Insertion.
 *
 * Instead of inserting keys one at a time, this construction sorts the keys and
 * builds a height-balanced binary search tree one level at a time. At each round
 * every node of that depth is created independently, which is the parallel step;
 * the median of each sorted segment becomes the node key so the tree stays
 * balanced and every search takes logarithmic time.
 *
 * Time:  O(n log n) for sorting plus O(n) parallel node work
 * Space: O(n)
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type TNode = {
    id: string;
    value: number;
    depth: number;
    left: TNode | null;
    right: TNode | null;
};

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values: number[] = task.values ?? [8, 3, 10, 1, 6, 14, 4, 7];
    const sorted = [...new Set(values)].sort((a, b) => a - b);

    let seq = 0;
    const build = (lo: number, hi: number, depth: number): TNode | null => {
        if (lo > hi) {
            return null;
        }
        const mid = (lo + hi) >> 1;
        seq += 1;
        return {
            id: `node-${seq}`,
            value: sorted[mid] as number,
            depth,
            left: build(lo, mid - 1, depth + 1),
            right: build(mid + 1, hi, depth + 1),
        };
    };
    const root = build(0, sorted.length - 1, 0);

    const byDepth = new Map<number, TNode[]>();
    const gather = (node: TNode | null): void => {
        if (!node) {
            return;
        }
        const list = byDepth.get(node.depth) ?? [];
        list.push(node);
        byDepth.set(node.depth, list);
        gather(node.left);
        gather(node.right);
    };
    gather(root);
    const maxDepth = byDepth.size;

    let step = 0;
    const makeFrame = (
        message: string,
        codeLine: number,
        visibleDepths: number,
        meta: Record<string, number | string | boolean | Array<number | string>>,
    ): VisualFrame => {
        const entities: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        const emitNode = (node: TNode | null): void => {
            if (!node || node.depth >= visibleDepths) {
                return;
            }
            entities.push({
                id: node.id,
                type: "node" as const,
                label: String(node.value),
                value: node.value,
                state: node.depth === visibleDepths - 1 ? ("active" as const) : ("unvisited" as const),
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: node.depth === 0 ? "root" : `depth-${node.depth - 1}`, depth: node.depth },
            });
            if (node.left && node.left.depth < visibleDepths) {
                edges.push({
                    id: `${node.id}-L`,
                    sourceId: node.id,
                    targetId: node.left.id,
                    label: "L",
                    state: "idle",
                    directed: false,
                });
            }
            if (node.right && node.right.depth < visibleDepths) {
                edges.push({
                    id: `${node.id}-R`,
                    sourceId: node.id,
                    targetId: node.right.id,
                    label: "R",
                    state: "idle",
                    directed: false,
                });
            }
            emitNode(node.left);
            emitNode(node.right);
        };
        emitNode(root);
        if (entities.length === 0) {
            entities.push({
                id: "empty",
                type: "node" as const,
                label: "-",
                value: 0,
                state: "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            });
        }
        const frame: VisualFrame = {
            stepNumber: step,
            entities,
            edges,
            description: message,
            codeLineNumber: codeLine,
            layout: "tree",
            meta,
        };
        step += 1;
        return frame;
    };

    yield makeFrame(
        `Sorted the ${sorted.length} distinct keys; building a balanced BST level by level.`,
        1,
        0,
        { levels: 0, nodes: 0, sorted },
    );

    for (let depth = 0; depth < maxDepth; depth += 1) {
        const count = byDepth.get(depth)?.length ?? 0;
        yield makeFrame(
            `Parallel round ${depth + 1}: created ${count} node(s) at depth ${depth} simultaneously.`,
            3,
            depth + 1,
            { levels: depth + 1, nodes: [...byDepth.keys()].filter((d) => d <= depth).reduce((sum, d) => sum + (byDepth.get(d)?.length ?? 0), 0), sorted },
        );
    }

    yield makeFrame(
        `Balanced BST complete with ${sorted.length} keys across ${maxDepth} level(s).`,
        6,
        maxDepth + 1,
        { levels: maxDepth, nodes: sorted.length, sorted, height: maxDepth },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than inserting keys one after another and hoping the tree stays bushy, sort the keys first and then lay them into a balanced tree a whole level at a time. Each level can be built independently because the key at a node depends only on the sorted range assigned to it, not on any other node at the same depth.",
        invariants: [
            "For every node, all keys in its left subtree are smaller and all keys in its right subtree are larger.",
            "Nodes at the same depth are created in one parallel round and never depend on one another.",
            "Choosing the median of each sorted segment keeps the two subtree sizes within one of each other.",
        ],
        correctness:
            "Sorting puts the keys in total order. Selecting the median of a segment as its root makes every smaller key fall in the left segment and every larger key fall in the right segment, so the BST ordering property holds by construction at every node. Because medians split segments almost evenly, the recursion depth is logarithmic, bounding search time.",
        complexityRationale:
            "Sorting costs O(n log n), and assigning each of the n keys to exactly one node costs O(n) total work spread across O(log n) parallel rounds. The tree stores one node per distinct key, so space is O(n).",
        uses: [
            "Bulk loading a searchable index from a sorted dataset",
            "Building balanced trees on multi-core processors",
            "Constructing static ordered sets for read-heavy workloads",
        ],
        references: [
            "CLRS, Introduction to Algorithms, Chapter 12 (Binary Search Trees)",
            "Blelloch, Maggs, and Zagha, A Comparison of Sorting Algorithms for the Connection Machine CM-2, 1991",
        ],
        workedExample:
            "For keys 1, 3, 4, 6, 8, 10, 14 the median 6 becomes the root. Round one creates just 6. Round two creates the medians of the left and right halves, 3 and 10. Round three creates 1, 4, 8, and 14. Every left subtree key is smaller than its parent and every right subtree key is larger, so the result is a valid balanced BST.",
    },
    id: "parallel-binary-search-tree",
    name: "Parallel BST Construction",
    category: "data-structures",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: { values: [8, 3, 10, 1, 6, 14, 4, 7] },
    visualType: "tree",
    run,
    pseudocode: [
        "sort the distinct keys into ascending order",
        "define a recursive segment from low index to high index",
        "pick the median index of the current segment as its root",
        "in one parallel round create every node at the current depth",
        "recurse on the left segment and the right segment",
        "attach each child to its parent node",
        "repeat until no keys remain",
        "done: a height-balanced BST over all keys",
    ],
};

export default module;
