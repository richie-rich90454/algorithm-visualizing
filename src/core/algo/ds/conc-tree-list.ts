/**
 * conc-tree-list.ts - Conc-Tree List
 *
 * A conc-tree is a randomized binary tree that represents a sequence. Each
 * node carries a size and a fixed priority. The merge operation combines two
 * sequences in expected O(1) by following the higher-priority root, so a list
 * built by repeated concatenation keeps its elements in insertion order and
 * supports fast joins and splits.
 *
 * Time:  O(1) expected per concatenation, O(n) for an in-order walk
 * Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface CNode {
    id: string;
    value: number;
    level: number;
    weight: number;
    left: CNode | null;
    right: CNode | null;
}

/** Deterministic priority derived from the value, so replays are reproducible. */
function levelFor(value: number): number {
    let h = Math.imul(value ^ 0x9e3779b9, 0x85ebca6b);
    h ^= h >>> 13;
    return (h >>> 0) % 8;
}

function size(node: CNode | null): number {
    return node ? node.weight : 0;
}

/** Concatenate two conc-trees, preserving the in-order sequence a then b. */
function merge(a: CNode | null, b: CNode | null): CNode | null {
    if (!a) return b;
    if (!b) return a;
    if (a.level >= b.level) {
        a.right = merge(a.right, b);
        a.weight = 1 + size(a.left) + size(a.right);
        return a;
    }
    b.left = merge(a, b.left);
    b.weight = 1 + size(b.left) + size(b.right);
    return b;
}

function toArray(node: CNode | null, out: number[] = []): number[] {
    if (node) {
        toArray(node.left, out);
        out.push(node.value);
        toArray(node.right, out);
    }
    return out;
}

/** Flatten the current tree into nodes and parent edges for the tree layout. */
function snapshot(
    root: CNode | null,
    hot: string,
    done: boolean,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    const visit = (node: CNode | null, parentId: string): void => {
        if (!node) return;
        const state: EntityState = done ? "sorted" : node.id === hot ? "comparing" : "idle";
        entities.push({
            id: node.id,
            type: "node" as const,
            label: String(node.value),
            value: node.value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId, value: node.value, level: node.level, weight: node.weight },
        });
        if (parentId !== "root") {
            edges.push({
                id: `ce-${parentId}-${node.id}`,
                sourceId: parentId,
                targetId: node.id,
                label: "",
                state: "idle",
                directed: false,
            });
        }
        visit(node.left, node.id);
        visit(node.right, node.id);
    };
    visit(root, "root");
    if (entities.length === 0) {
        entities.push({
            id: "ct-empty",
            type: "cell" as const,
            label: "(empty list)",
            value: 0,
            state: "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: 0 },
        });
    }
    return { entities, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = Array.isArray(task.values) && task.values.length > 0 ? [...task.values] : [5, 1, 8, 3, 7, 2];
    let root: CNode | null = null;
    let step = 0;
    const first = snapshot(root, "", false);
    yield {
        stepNumber: step,
        entities: first.entities,
        edges: first.edges,
        description: "Start with an empty conc-tree list ready for concatenation.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { size: 0, merges: 0 },
    };
    step += 1;

    for (let i = 0; i < values.length; i += 1) {
        const value = values[i] ?? 0;
        const node: CNode = {
            id: `ct-${i}`,
            value,
            level: levelFor(value),
            weight: 1,
            left: null,
            right: null,
        };
        root = merge(root, node);
        const snap = snapshot(root, node.id, false);
        yield {
            stepNumber: step,
            entities: snap.entities,
            edges: snap.edges,
            description: `Concatenated value ${value} as a singleton; the list now holds ${i + 1} item(s).`,
            codeLineNumber: node.level >= (root?.level ?? 0) ? 3 : 5,
            layout: "tree",
            meta: { size: i + 1, merges: i + 1, lastLevel: node.level },
        };
        step += 1;
    }

    const final = snapshot(root, "", true);
    yield {
        stepNumber: step,
        entities: final.entities,
        edges: final.edges,
        description: `In-order walk yields the sequence [${toArray(root).join(", ")}] in insertion order.`,
        codeLineNumber: 8,
        layout: "tree",
        meta: {
            result: toArray(root),
            size: size(root),
            merges: values.length,
            edges: final.edges.length,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of a list as a binary tree whose in-order walk spells out the sequence. Every node has a random priority, and joining two lists means comparing the two root priorities and recursively attaching the lower-priority list into a spine of the higher one. Because priorities are random, the recursion is short on average, so concatenation is constant time in expectation.",
        invariants: [
            "The in-order walk of the tree always equals the concatenation of the sequences joined so far.",
            "Each node stores the number of nodes in its subtree as its weight.",
            "Along every root-to-leaf path, priorities are nonincreasing, so high-priority nodes sit near the top.",
        ],
        correctness:
            "Merge recurses only on the right spine of a or the left spine of b. If a has the higher priority, the result is a with merge(a.right, b) as its new right child; by induction that child spells out a's suffix followed by b, so the whole in-order sequence is a followed by b. The symmetric case is similar. Since each concatenation preserves order, a fold of concatenations preserves the original insertion order.",
        complexityRationale:
            "The recursion follows a spine whose expected length is logarithmic in the number of nodes because priorities are random, and each level does constant work, giving expected O(1) amortized merge; the final in-order walk visits every node once, O(n). One node per element gives O(n) space.",
        uses: [
            "Persistent and functional sequence libraries that need cheap concatenation",
            "Rope and text-editor piece tables that splice large fragments",
            "Parallel list processing where partial results are joined after a divide and conquer pass",
        ],
        references: [
            "Prokopec, Bronshtein, Weiss and Odersky, Concatenation and Randomization: Efficient Concatenable Data Structures, 2012",
            "Okasaki, Purely Functional Data Structures, Chapter 9",
        ],
        workedExample:
            "Inserting 5, 1, 8 creates singleton nodes with priorities from a hash. Merging 5 and 1 keeps whichever root has the larger priority on top and attaches the other into its spine. Merging in 8 repeats the choice. An in-order walk then reads 5, 1, 8 back in the original order regardless of the tree shape.",
    },
    id: "conc-tree-list",
    name: "Conc-Tree List",
    category: "data-structures",
    complexity: { time: "O(1) expected merge", space: "O(n)" },
    defaultInput: { values: [5, 1, 8, 3, 7, 2] },
    visualType: "tree",
    run,
    pseudocode: [
        "start with an empty conc-tree list",
        "for each incoming value create a singleton node with a fixed priority",
        "merge the new node with the current list",
        "if the current root priority is at least the new node priority",
        "recursively merge the new node into the current right spine",
        "otherwise recursively merge the current list into the new left spine",
        "recompute the weight of every root touched by the merge",
        "repeat until every value has been concatenated",
        "read the list with an in-order walk and report the sequence",
    ],
};

export default module;
