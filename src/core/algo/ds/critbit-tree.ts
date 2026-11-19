/**
 * critbit-tree.ts - Critical-Bit Trie over fixed-width binary keys.
 *
 * A critbit trie is a binary search trie whose internal nodes branch on the
 * most significant bit where the keys in their two subtrees first differ.
 * Unlike an ordinary binary trie it creates a node only when a real distinction
 * is needed, so its depth is bounded by the key width and nodes are shared on
 * common prefixes. Membership testing follows one bit at a time down to a leaf.
 *
 * Time:  O(w) search and insert for w-bit keys
 * Space: O(n) nodes for n distinct keys
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Leaf = { id: string; kind: "leaf"; key: number };
type Internal = { id: string; kind: "internal"; bit: number; left: Node; right: Node };
type Node = Leaf | Internal;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; width?: number } | null) ?? {};
    const keys: number[] = task.keys ?? [5, 2, 9, 7, 1, 12, 3];
    const width = typeof task.width === "number" ? Math.max(1, Math.min(16, task.width)) : 4;

    let seq = 0;
    const makeLeaf = (key: number): Leaf => ({ id: `leaf-${key}`, kind: "leaf", key });
    const makeInternal = (bit: number, left: Node, right: Node): Internal => {
        seq += 1;
        return { id: `node-${seq}`, kind: "internal", bit, left, right };
    };
    const bitAt = (key: number, bit: number): number => (key >>> (width - 1 - bit)) & 1;

    const firstDiff = (a: number, b: number): number => {
        for (let bit = 0; bit < width; bit += 1) {
            if (bitAt(a, bit) !== bitAt(b, bit)) {
                return bit;
            }
        }
        return -1;
    };

    let root: Node | null = null;

    const insert = (key: number): boolean => {
        if (root === null) {
            root = makeLeaf(key);
            return true;
        }
        let node = root;
        let parent: Internal | null = null;
        let cameFromLeft = true;
        while (node.kind === "internal") {
            const goLeft = bitAt(key, node.bit) === 0;
            parent = node;
            cameFromLeft = goLeft;
            node = goLeft ? node.left : node.right;
        }
        if (node.key === key) {
            return false;
        }
        const bit = firstDiff(key, node.key);
        const fresh = makeLeaf(key);
        let branch: Internal;
        if (bitAt(key, bit) === 0) {
            branch = makeInternal(bit, fresh, node);
        } else {
            branch = makeInternal(bit, node, fresh);
        }
        if (parent === null) {
            root = branch;
        } else if (cameFromLeft) {
            parent.left = branch;
        } else {
            parent.right = branch;
        }
        return true;
    };

    const search = (key: number): boolean => {
        let node = root;
        while (node && node.kind === "internal") {
            node = bitAt(key, node.bit) === 0 ? node.left : node.right;
        }
        return node !== null && node.kind === "leaf" && node.key === key;
    };

    const collect = (node: Node | null, out: number[]): void => {
        if (node === null) {
            return;
        }
        if (node.kind === "leaf") {
            out.push(node.key);
        } else {
            collect(node.left, out);
            collect(node.right, out);
        }
    };

    const buildFrame = (
        message: string,
        highlight: Set<string>,
        codeLine: number,
        meta: Record<string, number | string | boolean | Array<number | string>>,
    ): VisualFrame => {
        const entities: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        const walk = (node: Node, parentId: string | null): void => {
            entities.push({
                id: node.id,
                type: "node" as const,
                label: node.kind === "leaf" ? String(node.key) : `b${node.bit}`,
                value: node.kind === "leaf" ? node.key : node.bit,
                state: highlight.has(node.id) ? ("active" as const) : ("unvisited" as const),
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: parentId ?? "root" },
            });
            if (node.kind === "internal") {
                edges.push({
                    id: `${node.id}-0`,
                    sourceId: node.id,
                    targetId: node.left.id,
                    label: "0",
                    state: "idle",
                    directed: false,
                });
                edges.push({
                    id: `${node.id}-1`,
                    sourceId: node.id,
                    targetId: node.right.id,
                    label: "1",
                    state: "idle",
                    directed: false,
                });
                walk(node.left, node.id);
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
                metadata: { parentId: "root" },
            });
        }
        return {
            stepNumber: 0,
            entities,
            edges,
            description: message,
            codeLineNumber: codeLine,
            layout: "tree",
            meta,
        };
    };

    let step = 0;
    const frame = (
        message: string,
        highlight: Set<string>,
        codeLine: number,
        meta: Record<string, number | string | boolean | Array<number | string>>,
    ): VisualFrame => {
        const built = buildFrame(message, highlight, codeLine, meta);
        built.stepNumber = step;
        step += 1;
        return built;
    };

    yield frame(
        `Empty critical-bit trie over ${width}-bit keys, ready for ${keys.length} inserts.`,
        new Set(),
        0,
        { size: 0, width },
    );

    for (const key of keys) {
        const added = insert(key);
        yield frame(
            `Inserted ${key} (${added ? "new leaf created" : "already present, ignored"}).`,
            new Set([`leaf-${key}`]),
            added ? 4 : 2,
            { size: new Set(keys.slice(0, keys.indexOf(key) + 1)).size, width, last: key },
        );
    }

    const found = keys.map((key) => search(key));
    const sorted: number[] = [];
    collect(root, sorted);
    yield frame(
        `Trie complete with ${sorted.length} distinct keys; inorder order is ${sorted.join(", ")}.`,
        new Set(),
        6,
        { size: sorted.length, width, keys: sorted, found: found.map((value) => (value ? 1 : 0)) },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A critical-bit trie stores binary keys in a tree where each internal node asks a single question: what is the key's bit at the position where the two subtrees first disagree? By creating a branch only at a genuinely differing bit, it skips long common prefixes and keeps the tree shallow and compact.",
        invariants: [
            "At an internal node labeled bit b, every key in the left subtree has bit b equal to 0 and every key in the right subtree has bit b equal to 1.",
            "Critical-bit positions strictly increase along any root-to-leaf path.",
            "Each distinct key appears in exactly one leaf, and an inorder walk visits leaves in ascending numeric order.",
        ],
        correctness:
            "Insertion descends by the bits already stored at internal nodes until it reaches the leaf whose key shares every critical bit with the new key. If the keys differ, the first differing bit is strictly after all ancestor bits, so a new internal node placed there preserves the prefix ordering; the two keys are split into their correct 0 and 1 subtrees. Membership search follows the same bit tests and therefore reaches precisely the leaf holding the key when it exists.",
        complexityRationale:
            "Each operation walks at most one node per bit position, and there are w bits, so search and insertion are O(w). Each distinct key needs one leaf and at most one new internal node, giving O(n) space for n keys.",
        uses: [
            "Fast IP routing tables keyed by network prefixes",
            "In-memory sets of fixed-width integer identifiers",
            "Compact indexing of bit-packed keys in embedded systems",
        ],
        references: [
            "P. F. Crittenden, A Novel Data Structure for Searching, 1982",
            "D. E. Knuth, The Art of Computer Programming, Vol. 3, Section 6.3",
        ],
        workedExample:
            "With 4-bit keys 5 (0101) and 6 (0110), the first differing bit is position 2, so the root branches on bit 2: key 5 goes left and key 6 goes right. Adding 4 (0100) descends left (bit 2 is 0) to the leaf 5; the first difference from 5 is bit 3, so a new node on bit 3 splits 4 to the left and 5 to the right.",
    },
    id: "critbit-tree",
    name: "Critical-Bit Trie",
    category: "data-structures",
    complexity: { time: "O(w) per operation", space: "O(n)" },
    defaultInput: { keys: [5, 2, 9, 7, 1, 12, 3], width: 4 },
    visualType: "tree",
    run,
    pseudocode: [
        "set root to null and choose the key width w",
        "for each key to insert",
        "descend internal nodes using the key bit at each critical position",
        "stop at the leaf reached by those bit tests",
        "if leaf key equals the key then ignore the duplicate",
        "otherwise find the first bit where the keys differ",
        "create a node on that bit and attach old and new leaves by their bit",
        "link the new node where the descent left the tree",
        "done: search any key by following bits to its leaf and comparing",
    ],
};

export default module;
