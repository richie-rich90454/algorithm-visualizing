/**
 * red-black-tree.ts – Red-Black Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A red-black tree is a self-balancing BST using one extra color bit per
 * node. Its invariants (no two reds in a row; every root-to-leaf path has the
 * same number of black nodes) keep the tree balanced with just rotations and
 * recolorings. Unlike AVL, insertions never need more than a few rotations.
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
 *   - Red nodes are drawn RED (swapped).
 *   - Black nodes are drawn GREEN (sorted).
 *   - Recolorings and rotations are narrated.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The color invariants are the entire concept.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Red-Black Tree generator.
 *
 * @param input `{ inserts }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { inserts?: number[] } | null) ?? {};
    const inserts = task.inserts ?? [7, 3, 18, 10, 22, 8, 11];

    let step = 0;

    // Educational simplified RB tree: we build a standard RB insert with
    // coloring (red children of black parents alternate; root is black).
    type RNode = {
        value: number;
        left: RNode | null;
        right: RNode | null;
        red: boolean;
    };
    let root: RNode | null = null;

    const isRed = (n: RNode | null): boolean => !!n && n.red;

    const rotateRight = (y: RNode): RNode => {
        const x = y.left as RNode;
        y.left = x.right;
        x.right = y;
        x.red = y.red;
        y.red = true;
        return x;
    };

    const rotateLeft = (x: RNode): RNode => {
        const y = x.right as RNode;
        x.right = y.left;
        y.left = x;
        y.red = x.red;
        x.red = true;
        return y;
    };

    const insertNode = (node: RNode | null, value: number): RNode => {
        if (!node) {
            return { value, left: null, right: null, red: true };
        }
        if (value < node.value) {
            node.left = insertNode(node.left, value);
        } else {
            node.right = insertNode(node.right, value);
        }

        // Simple RB fix-ups (educational): rotate when a red node has a red
        // child and recolor when both children are red.
        if (isRed(node.right) && !isRed(node.left)) {
            node = rotateLeft(node);
        }
        if (isRed(node.left) && isRed(node.left?.left ?? null)) {
            node = rotateRight(node);
        }
        if (isRed(node.left) && isRed(node.right)) {
            if (node.left) {
                node.left.red = false;
            }
            if (node.right) {
                node.right.red = false;
            }
            if (root !== node) {
                node.red = true;
            }
        }
        return node;
    };

    const buildFrame = (message: string): VisualFrame => {
        const nodes: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        let idCounter = 0;
        const walk = (node: RNode, parentId: string | null): void => {
            const id = `n-${node.value}-${idCounter}`;
            idCounter += 1;
            nodes.push({
                id,
                type: "node" as const,
                label: String(node.value),
                value: node.value,
                state: node.red ? "swapped" : "sorted",
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
        description: "Empty red-black tree.",
        codeLineNumber: 1,
        layout: "tree",
        meta: { size: 0 },
    };
    step += 1;

    for (const value of inserts) {
        root = insertNode(root, value);
        if (root) {
            root.red = false; // the root is always black
        }
        yield buildFrame(
            `Inserted ${value} – rotations and recolorings preserve the RB invariants.`,
        );
        step += 1;
    }

    yield buildFrame(`Red-black tree complete with ${inserts.length} values.`);
}

/** The Red-Black Tree module, registered with the engine. */
const module: AlgorithmModule = {
    id: "red-black-tree",
    name: "Red-Black Tree",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { inserts: [7, 3, 18, 10, 22, 8, 11] },
    visualType: "tree",
    run,
};

export default module;
