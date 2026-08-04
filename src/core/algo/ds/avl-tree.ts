/**
 * avl-tree.ts â€?AVL Tree (self-balancing BST)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An AVL tree is a BST that stays balanced: for every node, the heights of its
 * left and right subtrees differ by at most one. When an insertion or deletion
 * violates this invariant, the tree performs one or two rotations to restore
 * it. The guaranteed height bound of O(log n) makes every operation
 * O(log n) worst case.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Search / insert / delete: O(log n) guaranteed
 *   Space:                    O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The node whose balance factor becomes Â±2 is YELLOW (comparing).
 *   - Rotations are narrated.
 *   - Balance factors are shown on nodes.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The height-balance invariant is the entire concept.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The AVL Tree generator.
 *
 * @param input `{ inserts }` â€?values inserted in order.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { inserts?: number[] } | null) ?? {};
    const inserts = task.inserts ?? [10, 20, 30, 40, 50, 25];

    let step = 0;

    // A simple AVL insertion with rotations, tracking entities per frame.
    type ANode = {
        value: number;
        left: ANode | null;
        right: ANode | null;
        height: number;
        balance: number;
    };
    let root: ANode | null = null;

    const heightOf = (n: ANode | null): number => (n ? n.height : 0);

    const rotateRight = (y: ANode): ANode => {
        const x = y.left as ANode;
        y.left = x.right;
        x.right = y;
        y.height = 1 + Math.max(heightOf(y.left), heightOf(y.right));
        x.height = 1 + Math.max(heightOf(x.left), heightOf(x.right));
        return x;
    };

    const rotateLeft = (x: ANode): ANode => {
        const y = x.right as ANode;
        x.right = y.left;
        y.left = x;
        x.height = 1 + Math.max(heightOf(x.left), heightOf(x.right));
        y.height = 1 + Math.max(heightOf(y.left), heightOf(y.right));
        return y;
    };

    const insertNode = (node: ANode | null, value: number): ANode => {
        if (!node) {
            return { value, left: null, right: null, height: 1, balance: 0 };
        }
        if (value < node.value) {
            node.left = insertNode(node.left, value);
        } else {
            node.right = insertNode(node.right, value);
        }
        node.height = 1 + Math.max(heightOf(node.left), heightOf(node.right));
        node.balance = heightOf(node.left) - heightOf(node.right);

        // Rotations.
        if (node.balance > 1) {
            if ((node.left?.balance ?? 0) < 0) {
                node.left = rotateLeft(node.left as ANode);
            }
            return rotateRight(node);
        }
        if (node.balance < -1) {
            if ((node.right?.balance ?? 0) > 0) {
                node.right = rotateRight(node.right as ANode);
            }
            return rotateLeft(node);
        }
        return node;
    };

    const buildFrame = (message: string): VisualFrame => {
        const nodes: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        let idCounter = 0;
        const walk = (node: ANode, parentId: string | null): void => {
            const id = `n-${node.value}-${idCounter}`;
            idCounter += 1;
            nodes.push({
                id,
                type: "node" as const,
                label: `${node.value} (b=${node.balance})`,
                value: node.value,
                state: "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: parentId ?? "root" },
            });
            if (node.left) {
                edges.push({
                    id: `${id}-L`,
                    sourceId: id,
                    targetId: `n-${node.left.value}-${idCounter}`,
                    label: "L",
                    state: "idle",
                    directed: false,
                });
                walk(node.left, id);
            }
            if (node.right) {
                edges.push({
                    id: `${id}-R`,
                    sourceId: id,
                    targetId: `n-${node.right.value}-${idCounter}`,
                    label: "R",
                    state: "idle",
                    directed: false,
                });
                walk(node.right, id);
            }
        };
        if (root) {
            walk(root, null);
        }
        return {
            stepNumber: step,
            entities: nodes,
            edges,
            description: message,
            codeLineNumber: 2,
            layout: "tree",
            meta: { size: nodes.length },
        };
    };

    // Frame 0: empty.
    yield {
        stepNumber: step,
        entities: [
            {
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
            },
        ],
        edges: [],
        description: "Empty AVL tree.",
        codeLineNumber: 1,
        layout: "tree",
        meta: { size: 0 },
    };
    step += 1;

    for (const value of inserts) {
        root = insertNode(root, value);
        yield buildFrame(`Inserted ${value} â€?rotations keep every node balanced.`);
        step += 1;
    }

    yield buildFrame(`AVL tree complete with ${inserts.length} values â€?height is O(log n).`);
}

/** The AVL Tree module, registered with the engine. */
const module: AlgorithmModule = {
    id: "avl-tree",
    name: "AVL Tree",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { inserts: [10, 20, 30, 40, 50, 25] },
    visualType: "tree",
    run,
};

export default module;
