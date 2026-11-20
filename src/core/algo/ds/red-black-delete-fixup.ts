/**
 * red-black-delete-fixup.ts - Red-Black Tree Deletion Fixup
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Deleting a black node from a red-black tree can remove one black from every
 * path through that node, breaking the equal-black-height invariant. This
 * module performs the standard CLRS deletion: splice out the node, then walk a
 * doubly-black node up toward the root, using sibling recoloring and rotations
 * to push the extra black away. It is the deletion counterpart of the
 * insert-only red-black-tree module.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) per deletion plus O(log n) fixup
 *   Space: O(n) for the tree plus O(log n) recursion/stack depth
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show their value and color (R or B).
 *   - The node being removed is YELLOW (comparing).
 *   - Nodes recolored or rotated during fixup are CYAN (active).
 *   - The final tree is GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Color = "R" | "B";

interface Node {
    value: number;
    color: Color;
    left: Node;
    right: Node;
    parent: Node;
}

/** Shared sentinel standing in for every null child (always black). */
function makeNil(): Node {
    const nil: Node = { value: 0, color: "B", left: null as unknown as Node, right: null as unknown as Node, parent: null as unknown as Node };
    nil.left = nil;
    nil.right = nil;
    nil.parent = nil;
    return nil;
}

function leftRotate(rootRef: { root: Node }, x: Node, NIL: Node): void {
    const y = x.right;
    x.right = y.left;
    if (y.left !== NIL) {
        y.left.parent = x;
    }
    y.parent = x.parent;
    if (x.parent === NIL) {
        rootRef.root = y;
    } else if (x === x.parent.left) {
        x.parent.left = y;
    } else {
        x.parent.right = y;
    }
    y.left = x;
    x.parent = y;
}

function rightRotate(rootRef: { root: Node }, x: Node, NIL: Node): void {
    const y = x.left;
    x.left = y.right;
    if (y.right !== NIL) {
        y.right.parent = x;
    }
    y.parent = x.parent;
    if (x.parent === NIL) {
        rootRef.root = y;
    } else if (x === x.parent.right) {
        x.parent.right = y;
    } else {
        x.parent.left = y;
    }
    y.right = x;
    x.parent = y;
}

function insertFixup(rootRef: { root: Node }, z: Node, NIL: Node): void {
    while (z.parent.color === "R") {
        if (z.parent === z.parent.parent.left) {
            const uncle = z.parent.parent.right;
            if (uncle.color === "R") {
                z.parent.color = "B";
                uncle.color = "B";
                z.parent.parent.color = "R";
                z = z.parent.parent;
            } else {
                if (z === z.parent.right) {
                    z = z.parent;
                    leftRotate(rootRef, z, NIL);
                }
                z.parent.color = "B";
                z.parent.parent.color = "R";
                rightRotate(rootRef, z.parent.parent, NIL);
            }
        } else {
            const uncle = z.parent.parent.left;
            if (uncle.color === "R") {
                z.parent.color = "B";
                uncle.color = "B";
                z.parent.parent.color = "R";
                z = z.parent.parent;
            } else {
                if (z === z.parent.left) {
                    z = z.parent;
                    rightRotate(rootRef, z, NIL);
                }
                z.parent.color = "B";
                z.parent.parent.color = "R";
                leftRotate(rootRef, z.parent.parent, NIL);
            }
        }
    }
    rootRef.root.color = "B";
}

function insert(rootRef: { root: Node }, value: number, NIL: Node): void {
    const z: Node = { value, color: "R", left: NIL, right: NIL, parent: NIL };
    let parent = NIL;
    let cursor = rootRef.root;
    while (cursor !== NIL) {
        parent = cursor;
        cursor = value < cursor.value ? cursor.left : cursor.right;
    }
    z.parent = parent;
    if (parent === NIL) {
        rootRef.root = z;
    } else if (value < parent.value) {
        parent.left = z;
    } else {
        parent.right = z;
    }
    insertFixup(rootRef, z, NIL);
}

function transplant(rootRef: { root: Node }, u: Node, v: Node, NIL: Node): void {
    if (u.parent === NIL) {
        rootRef.root = v;
    } else if (u === u.parent.left) {
        u.parent.left = v;
    } else {
        u.parent.right = v;
    }
    v.parent = u.parent;
}

function minimum(node: Node, NIL: Node): Node {
    let cursor = node;
    while (cursor.left !== NIL) {
        cursor = cursor.left;
    }
    return cursor;
}

function deleteFixup(rootRef: { root: Node }, x: Node, NIL: Node): void {
    while (x !== rootRef.root && x.color === "B") {
        if (x === x.parent.left) {
            let sibling = x.parent.right;
            if (sibling.color === "R") {
                sibling.color = "B";
                x.parent.color = "R";
                leftRotate(rootRef, x.parent, NIL);
                sibling = x.parent.right;
            }
            if (sibling.left.color === "B" && sibling.right.color === "B") {
                sibling.color = "R";
                x = x.parent;
            } else {
                if (sibling.right.color === "B") {
                    sibling.left.color = "B";
                    sibling.color = "R";
                    rightRotate(rootRef, sibling, NIL);
                    sibling = x.parent.right;
                }
                sibling.color = x.parent.color;
                x.parent.color = "B";
                sibling.right.color = "B";
                leftRotate(rootRef, x.parent, NIL);
                x = rootRef.root;
            }
        } else {
            let sibling = x.parent.left;
            if (sibling.color === "R") {
                sibling.color = "B";
                x.parent.color = "R";
                rightRotate(rootRef, x.parent, NIL);
                sibling = x.parent.left;
            }
            if (sibling.right.color === "B" && sibling.left.color === "B") {
                sibling.color = "R";
                x = x.parent;
            } else {
                if (sibling.left.color === "B") {
                    sibling.right.color = "B";
                    sibling.color = "R";
                    leftRotate(rootRef, sibling, NIL);
                    sibling = x.parent.left;
                }
                sibling.color = x.parent.color;
                x.parent.color = "B";
                sibling.left.color = "B";
                rightRotate(rootRef, x.parent, NIL);
                x = rootRef.root;
            }
        }
    }
    x.color = "B";
}

function remove(rootRef: { root: Node }, value: number, NIL: Node): boolean {
    let z = NIL;
    let cursor = rootRef.root;
    while (cursor !== NIL) {
        if (cursor.value === value) {
            z = cursor;
            break;
        }
        cursor = value < cursor.value ? cursor.left : cursor.right;
    }
    if (z === NIL) {
        return false;
    }

    let y = z;
    let yOriginalColor = y.color;
    let x: Node;
    if (z.left === NIL) {
        x = z.right;
        transplant(rootRef, z, z.right, NIL);
    } else if (z.right === NIL) {
        x = z.left;
        transplant(rootRef, z, z.left, NIL);
    } else {
        y = minimum(z.right, NIL);
        yOriginalColor = y.color;
        x = y.right;
        if (y.parent === z) {
            x.parent = y;
        } else {
            transplant(rootRef, y, y.right, NIL);
            y.right = z.right;
            y.right.parent = y;
        }
        transplant(rootRef, z, y, NIL);
        y.left = z.left;
        y.left.parent = y;
        y.color = z.color;
    }
    if (yOriginalColor === "B") {
        deleteFixup(rootRef, x, NIL);
    }
    return true;
}

/** Check every red-black invariant and collect the inorder keys. */
function verify(root: Node, NIL: Node): { ok: boolean; inorder: number[]; height: number } {
    const inorder: number[] = [];
    let ok = true;
    const blackHeight = (node: Node, min: number, max: number): number => {
        if (node === NIL) {
            return 1;
        }
        const leftH = blackHeight(node.left, min, node.value);
        inorder.push(node.value);
        const rightH = blackHeight(node.right, node.value, max);
        if (leftH !== rightH) {
            ok = false;
        }
        if (node.value <= min || node.value >= max) {
            ok = false;
        }
        if (node.color === "R" && node.left.color === "R" && node.left !== NIL) {
            ok = false;
        }
        if (node.color === "R" && node.right.color === "R" && node.right !== NIL) {
            ok = false;
        }
        return leftH + (node.color === "B" ? 1 : 0);
    };
    if (root !== NIL) {
        if (root.color !== "B") {
            ok = false;
        }
        blackHeight(root, -Infinity, Infinity);
    }
    return { ok, inorder: inorder.sort((a, b) => a - b), height: inorder.length };
}

/** Build tree-layout entities from the current red-black tree. */
function render(root: Node, NIL: Node, states: Map<number, EntityState>): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    if (root === NIL) {
        entities.push({
            id: "empty",
            type: "node" as const,
            label: "-",
            value: 0,
            state: "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: "root" },
        });
        return { entities, edges };
    }
    const walk = (node: Node): void => {
        const id = `node-${node.value}`;
        entities.push({
            id,
            type: "node" as const,
            label: `${node.value}${node.color}`,
            value: node.value,
            state: states.get(node.value) ?? "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: node.parent === NIL ? "root" : `node-${node.parent.value}`, value: node.value, color: node.color },
        });
        for (const child of [node.left, node.right]) {
            if (child !== NIL) {
                edges.push({
                    id: `edge-${node.value}-${child.value}`,
                    sourceId: id,
                    targetId: `node-${child.value}`,
                    label: "",
                    state: "idle",
                    directed: false,
                });
                walk(child);
            }
        }
    };
    walk(root);
    return { entities, edges };
}

/** The Red-Black Delete Fixup generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; deletions?: number[] } | null) ?? {};
    const values = [...new Set(task.values ?? [7, 3, 18, 10, 22, 8, 11, 26, 2, 6])];
    const deletions = task.deletions ?? [18, 10, 7, 6];

    const NIL = makeNil();
    const ref = { root: NIL };
    let step = 0;
    const active = new Map<number, EntityState>();

    const frame = (message: string, line: number, states: Map<number, EntityState>): VisualFrame => {
        const { entities, edges } = render(ref.root, NIL, states);
        const check = verify(ref.root, NIL);
        return {
            stepNumber: step,
            entities,
            edges,
            description: message,
            codeLineNumber: line,
            layout: "tree",
            meta: { size: check.inorder.length, valid: check.ok, inorder: check.inorder },
        };
    };

    yield {
        stepNumber: step,
        entities: render(ref.root, NIL, active).entities,
        edges: [],
        description: "Empty red-black tree - insert keys before deleting them.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { size: 0, valid: true, inorder: [] },
    };
    step += 1;

    for (const value of values) {
        insert(ref, value, NIL);
    }
    active.clear();
    const built = frame(`Inserted ${values.length} keys; every path has equal black height.`, 0, active);
    built.stepNumber = step;
    yield built;
    step += 1;

    for (const target of deletions) {
        active.clear();
        active.set(target, "comparing");
        const before = frame(`Deleting ${target}; removing a black node may need fixup.`, 1, active);
        before.stepNumber = step;
        yield before;
        step += 1;

        remove(ref, target, NIL);
        active.clear();
        for (const value of verify(ref.root, NIL).inorder) {
            active.set(value, "active");
        }
        const check = verify(ref.root, NIL);
        const after = frame(`After deleting ${target}: ${check.inorder.length} keys, valid ${check.ok}.`, 5, active);
        after.stepNumber = step;
        yield after;
        step += 1;
    }

    active.clear();
    for (const value of verify(ref.root, NIL).inorder) {
        active.set(value, "sorted");
    }
    const final = frame("Done - the red-black tree still satisfies every invariant.", 7, active);
    final.stepNumber = step;
    yield final;
}

/** The Red-Black Delete Fixup module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A red-black tree guarantees that every root-to-leaf path has the same number of black nodes. Deleting a black key takes one black off the paths through it, so the fixup treats the replacement node as carrying an extra black. It examines that node's sibling and, depending on the sibling's color and children, either recolors nodes to move the extra black upward or performs rotations to eliminate it, stopping when the node reaches the root or becomes red.",
        invariants: [
            "The root is always black and every null leaf (sentinel) is black.",
            "A red node never has a red child.",
            "Every path from a node down to a sentinel contains the same number of black nodes.",
        ],
        correctness:
            "Splicing out a node preserves inorder order. If a black node was removed, every path through the replacement loses one black. The fixup cases are exhaustive: a red sibling can be rotated into place; a black sibling with two black children can be recolored to push the extra black up one level; a black sibling with a red near child and black far child is rotated to the second case; a black sibling with a red far child is recolored and rotated to resolve the deficit in one step. Each case either moves the problem up the tree or eliminates it, and coloring the final node black restores the invariant.",
        complexityRationale:
            "The tree height is O(log n). The deletion descends one path and the fixup moves at most that far back toward the root, each level doing constant-time recoloring and rotations. Search and insertion use the same bound; storing one color bit and three pointers per node is O(n) space.",
        uses: [
            "Ordered maps with guaranteed O(log n) worst-case updates",
            "Kernel schedulers and in-memory indexes (for example Java TreeMap)",
            "A teaching model for deletion fixup cases",
        ],
        references: [
            "CLRS, Introduction to Algorithms, Chapter 13 (RB-DELETE and RB-DELETE-FIXUP)",
            "Guibas and Sedgewick, A Dichromatic Framework for Balanced Trees, 1978",
        ],
        workedExample:
            "Deleting a black leaf leaves its parent's one side one black shorter. If the sibling is black with black children, recoloring the sibling red and moving up transfers the deficit. If the sibling has a red far child, recoloring and one rotation restores equal black heights immediately, after which the root is forced black.",
    },
    id: "red-black-delete-fixup",
    name: "Red-Black Tree Delete Fixup",
    category: "data-structures",
    complexity: { time: "O(log n) per deletion", space: "O(n)" },
    defaultInput: { values: [7, 3, 18, 10, 22, 8, 11, 26, 2, 6], deletions: [18, 10, 7, 6] },
    visualType: "tree",
    run,
    pseudocode: [
        "build the red-black tree with insert fixup",
        "for each key to delete search from the root",
        "splice out the node and remember its original color",
        "if two children replace it with the inorder successor",
        "if a black node was removed call delete fixup",
        "recolor or rotate around the sibling to move the extra black",
        "stop when the node is red or reaches the root",
        "done: colors and black heights satisfy every invariant",
    ],
};

export default module;
