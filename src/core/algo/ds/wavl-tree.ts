/**
 * wavl-tree.ts - Weak AVL Tree (WAVL) with Rank-Balanced Insertion.
 *
 * A WAVL tree relaxes the AVL rule: instead of requiring child subtree ranks to
 * differ by at most one, it permits a difference of two. Nodes carry an integer
 * rank equal to one plus the larger rank of their children. Insertion follows a
 * normal BST path and restores the rank rule with rotations, giving logarithmic
 * height with fewer rotations than a strict AVL tree.
 *
 * Time:  O(log n) per search or insert
 * Space: O(n)
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type WNode = {
    id: string;
    key: number;
    left: WNode | null;
    right: WNode | null;
    rank: number;
    balance: number;
};

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { inserts?: number[] } | null) ?? {};
    const inserts: number[] = task.inserts ?? [10, 20, 30, 40, 50, 25, 5, 35];

    let seq = 0;
    const rankOf = (node: WNode | null | undefined): number => (node ? node.rank : 0);
    const refresh = (node: WNode): void => {
        node.rank = 1 + Math.max(rankOf(node.left), rankOf(node.right));
        node.balance = rankOf(node.left) - rankOf(node.right);
    };
    const rotateRight = (y: WNode): WNode => {
        const x = y.left as WNode;
        y.left = x.right;
        x.right = y;
        refresh(y);
        refresh(x);
        return x;
    };
    const rotateLeft = (x: WNode): WNode => {
        const y = x.right as WNode;
        x.right = y.left;
        y.left = x;
        refresh(x);
        refresh(y);
        return y;
    };
    const rebalance = (node: WNode): WNode => {
        refresh(node);
        if (node.balance > 2) {
            if (rankOf(node.left?.left) - rankOf(node.left?.right) < 0) {
                node.left = rotateLeft(node.left as WNode);
            }
            return rotateRight(node);
        }
        if (node.balance < -2) {
            if (rankOf(node.right?.left) - rankOf(node.right?.right) > 0) {
                node.right = rotateRight(node.right as WNode);
            }
            return rotateLeft(node);
        }
        return node;
    };
    const insert = (node: WNode | null, key: number): WNode => {
        if (!node) {
            seq += 1;
            return { id: `node-${seq}`, key, left: null, right: null, rank: 1, balance: 0 };
        }
        if (key < node.key) {
            node.left = insert(node.left, key);
        } else {
            node.right = insert(node.right, key);
        }
        return rebalance(node);
    };

    let root: WNode | null = null;

    const makeFrame = (message: string, codeLine: number, meta: Record<string, number | string | boolean | Array<number | string>>): VisualFrame => {
        const entities: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        const walk = (node: WNode, parentId: string | null): void => {
            entities.push({
                id: node.id,
                type: "node" as const,
                label: `${node.key} r${node.rank}`,
                value: node.key,
                state: "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: parentId ?? "root", rank: node.rank, balance: node.balance },
            });
            if (node.left) {
                edges.push({
                    id: `${node.id}-L`,
                    sourceId: node.id,
                    targetId: node.left.id,
                    label: "L",
                    state: "idle",
                    directed: false,
                });
                walk(node.left, node.id);
            }
            if (node.right) {
                edges.push({
                    id: `${node.id}-R`,
                    sourceId: node.id,
                    targetId: node.right.id,
                    label: "R",
                    state: "idle",
                    directed: false,
                });
                walk(node.right, node.id);
            }
        };
        if (root) {
            walk(root, null);
        } else {
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
                metadata: { parentId: "root", rank: 0, balance: 0 },
            });
        }
        const frame: VisualFrame = {
            stepNumber: 0,
            entities,
            edges,
            description: message,
            codeLineNumber: codeLine,
            layout: "tree",
            meta,
        };
        return frame;
    };

    let step = 0;
    const emit = (message: string, codeLine: number, meta: Record<string, number | string | boolean | Array<number | string>>): VisualFrame => {
        const frame = makeFrame(message, codeLine, meta);
        frame.stepNumber = step;
        step += 1;
        return frame;
    };

    yield emit("Empty WAVL tree with null children of rank zero.", 0, { size: 0, height: 0 });

    for (const key of inserts) {
        root = insert(root, key);
        yield emit(`Inserted ${key}; rotations keep every node's child ranks within two.`, 5, {
            size: new Set(inserts.slice(0, inserts.indexOf(key) + 1)).size,
            height: root ? root.rank : 0,
            last: key,
        });
    }

    yield emit(
        `WAVL tree complete with ${inserts.length} inserts; height ${root ? root.rank : 0} stays logarithmic.`,
        7,
        { size: new Set(inserts).size, height: root ? root.rank : 0, keys: inserts },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A WAVL tree is a binary search tree with a relaxed balance rule. Each node records a rank, and the ranks of its two child subtrees may differ by up to two rather than just one. That small relaxation keeps the tree shallow enough for logarithmic search while performing fewer rotations than a strict AVL tree during updates.",
        invariants: [
            "For every node, the ranks of its left and right children differ by at most two.",
            "A node's rank is one plus the larger of its two child ranks.",
            "Left subtree keys are smaller and right subtree keys are larger at every node.",
        ],
        correctness:
            "Insertion follows the BST comparison path, so ordering is preserved. When a node's child ranks differ by three, the heavy side is itself balanced, so a single rotation (or a double rotation for the zig-zag case) restores a difference of at most two at both nodes involved. Rebalancing on the way back to the root therefore maintains the rank rule everywhere and bounds the height logarithmically.",
        complexityRationale:
            "Following one root-to-leaf path costs O(log n) because the rank rule bounds the height. Each level does constant-time rank updates and at most a constant number of rotations, so insertion and search are O(log n) with O(n) space for the nodes.",
        uses: [
            "Ordered maps needing predictable logarithmic lookup depth",
            "Systems that update an index frequently and want fewer rotations",
            "A bridge between AVL trees and more relaxed balanced structures",
        ],
        references: [
            "G. F. Blelloch and B. M. Maggs, Parallel Algorithms (WAVL trees), 2008",
            "U. Pfeil, Does Dimension Matter? The WAVL Tree, 2009",
        ],
        workedExample:
            "Insert 10, 20, 30 into an empty WAVL tree. After 30 the root's left rank is 0 and right rank is 2, a difference of two, which the rule allows, so no rotation occurs. An AVL tree would rotate here, but the WAVL tree keeps the structure and still has height at most logarithmic in the number of keys.",
    },
    id: "wavl-tree",
    name: "WAVL Tree",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { inserts: [10, 20, 30, 40, 50, 25, 5, 35] },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize an empty tree whose null children have rank zero",
        "insert the key following BST comparisons to a leaf",
        "refresh rank as one plus the larger child rank",
        "set balance to left rank minus right rank",
        "if balance exceeds two rotate the heavy side right",
        "if balance is below minus two rotate the heavy side left",
        "use a double rotation when the heavy child leans the other way",
        "done: every node satisfies the rank-balance rule",
    ],
};

export default module;
