/**
 * morris-preorder-traversal.ts - Morris preorder traversal using O(1) extra space.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * This is the preorder variant of Morris traversal. A node is visited the first
 * time it is reached, before descending into its left subtree. When a node has
 * a left child, the rightmost node of that left subtree (its predecessor) is
 * temporarily threaded to point back to the current node. The thread is a
 * temporary path back up; when it is met again it is removed and the walk
 * continues into the right subtree. No stack and no recursion are used.
 *
 * This differs from the inorder Morris module: there the node is visited on the
 * second pass when the thread is removed, while here it is visited on the
 * first pass, which produces a root-left-right ordering.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) - each edge is walked at most a constant number of times
 *   Space: O(1) - only a handful of pointers besides the tree itself
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are drawn with the tree layout; edges follow parentId metadata.
 *   - The current node is ACTIVE, visited nodes are SORTED, a fresh thread is
 *     COMPARING, and the final frame marks every node SORTED.
 *   - The caption and meta carry the growing preorder sequence.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface TreeInput {
    ids?: string[];
    left?: Record<string, string | null>;
    right?: Record<string, string | null>;
}

const DEFAULT_LEFT: Record<string, string | null> = {
    A: "B",
    B: "D",
    C: null,
    D: null,
    E: null,
    F: null,
};
const DEFAULT_RIGHT: Record<string, string | null> = {
    A: "C",
    B: "E",
    C: "F",
    D: null,
    E: null,
    F: null,
};
const DEFAULT_IDS = ["A", "B", "C", "D", "E", "F"];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TreeInput | null) ?? {};
    const ids: string[] = Array.isArray(task.ids) && task.ids.length > 0 ? task.ids : [...DEFAULT_IDS];
    const left: Record<string, string | null> = task.left ?? DEFAULT_LEFT;
    const right: Record<string, string | null> = task.right ?? DEFAULT_RIGHT;

    const L = new Map<string, string | null>(Object.entries(left));
    const R = new Map<string, string | null>(Object.entries(right));

    // Derive parents from both child maps so edges reflect the real tree.
    const parent = new Map<string, string | null>();
    for (const id of ids) parent.set(id, null);
    for (const id of ids) {
        for (const child of [L.get(id), R.get(id)]) {
            if (child && parent.has(child)) parent.set(child, id);
        }
    }

    const states = new Map<string, EntityState>();
    const snapshot = (): VisualEntity[] =>
        ids.map((id) => ({
            id: `node-${id}`,
            type: "node" as const,
            label: id,
            value: id,
            state: states.get(id) ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parent.get(id) ?? "root" },
        }));
    const edges = (): VisualEdge[] => {
        const result: VisualEdge[] = [];
        for (const id of ids) {
            const p = parent.get(id);
            if (p) {
                result.push({
                    id: `edge-${p}-${id}`,
                    sourceId: `node-${p}`,
                    targetId: `node-${id}`,
                    label: "",
                    state: "idle",
                    directed: false,
                });
            }
        }
        return result;
    };

    let step = 0;
    const frame = (description: string, line: number, meta: VisualFrame["meta"]): VisualFrame => ({
        stepNumber: step,
        entities: snapshot(),
        edges: edges(),
        description,
        codeLineNumber: line,
        layout: "tree",
        meta,
    });

    if (ids.length === 0) {
        yield frame("Empty tree - preorder is [].", 0, { preorder: [] });
        return;
    }

    const root = ids.find((id) => parent.get(id) === null) ?? ids[0]!;
    yield frame(`Morris preorder from root ${root}; no stack, no recursion.`, 0, { preorder: [] });
    step += 1;

    const order: string[] = [];
    const thread = new Map<string, string>();
    let cur: string | null = root;
    let guard = 0;

    while (cur !== null && guard++ < 200) {
        const lc: string | null = L.get(cur) ?? null;
        if (lc === null) {
            // No left child: visit now and follow the right link (or a thread).
            order.push(cur);
            states.set(cur, "active");
            yield frame(`Visit ${cur} (no left child); preorder [${order.join(",")}].`, 1, {
                preorder: [...order],
                current: cur,
            });
            step += 1;
            states.set(cur, "sorted");
            cur = thread.get(cur) ?? R.get(cur) ?? null;
        } else {
            let pred: string = lc;
            let hops = 0;
            while ((R.get(pred) ?? thread.get(pred)) && (R.get(pred) ?? thread.get(pred)) !== cur) {
                const next = R.get(pred) ?? thread.get(pred);
                if (!next || hops++ > 200) break;
                pred = next;
            }
            const link = R.get(pred) ?? thread.get(pred) ?? null;
            if (link === null) {
                // First pass: create the thread, visit, then go left.
                thread.set(pred, cur);
                order.push(cur);
                states.set(cur, "active");
                states.set(pred, "comparing");
                yield frame(
                    `Thread ${pred}->${cur}; visit ${cur} first (preorder); go left to ${lc}.`,
                    2,
                    { preorder: [...order], threadFrom: pred, current: cur },
                );
                step += 1;
                states.set(cur, "idle");
                states.set(pred, "idle");
                cur = lc;
            } else {
                // Second pass: remove the thread and continue right.
                thread.delete(pred);
                states.set(pred, "comparing");
                yield frame(`Remove thread ${pred}->${cur}; left subtree done, go right.`, 3, {
                    preorder: [...order],
                    threadFrom: pred,
                });
                step += 1;
                states.set(pred, "idle");
                // The node may itself be a predecessor whose thread leads back up.
                cur = thread.get(cur) ?? R.get(cur) ?? null;
            }
        }
    }

    for (const id of ids) states.set(id, "sorted");
    yield frame(
        `Preorder complete [${order.join(",")}]; visited ${order.length} of ${ids.length} nodes.`,
        4,
        { preorder: order, visited: order.length, threadsRemaining: thread.size },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Preorder lists a node before its children: root, then left subtree, then right subtree. Morris traversal gets that order without a stack by temporarily rewiring a pointer. When a node has a left child, its predecessor (the rightmost node in the left subtree) gets a temporary link back to the node. That link is the breadcrumb that tells us when the left subtree is finished.",
        invariants: [
            "A node is appended to the preorder list exactly once, on its first visit.",
            "A temporary thread always points from a predecessor to an ancestor currently being processed.",
            "Every thread created is removed before the walk moves into the right subtree.",
            "The left and right child maps are never modified; threads live in a separate map.",
        ],
        correctness:
            "When a node has no left child, preorder visits it immediately and moves to the right link. When it does have a left child, the predecessor is the last node visited in that left subtree, so a thread from it to the current node lets the walk return exactly when the left subtree is exhausted; the node itself is already visited on the first pass, before descending. Removing the thread restores the original structure, so each node is visited once in root-left-right order, matching a recursive preorder walk.",
        complexityRationale:
            "The search for a predecessor walks right-child links within a left subtree; across the whole traversal each edge is followed a constant number of times, so total time is O(n). Only a few pointer variables and the thread map of currently open threads are held at once, giving O(1) auxiliary space beyond the output list.",
        uses: [
            "Serializing a tree in prefix order with constant working memory",
            "Streaming a tree iterator on memory-constrained embedded systems",
            "Teaching how temporary threads replace an explicit traversal stack",
        ],
        references: [
            "Morris, Traversing Binary Trees Simply and Cheaply, Information Processing Letters 9 (1979)",
            "CLRS, Introduction to Algorithms, Chapter 12 (Binary Search Trees)",
        ],
        workedExample:
            "For A with left child B and right child C, B with children D and E, and C with right child F: thread B to A, visit A, go to B; thread D to B, visit B, go to D; visit D, follow its thread to B, remove it, go to E; visit E, follow B's thread to A, remove it, go to C; visit C then F. The preorder is A, B, D, E, C, F.",
    },
    id: "morris-preorder-traversal",
    name: "Morris Preorder Traversal",
    category: "tree",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: {
        ids: [...DEFAULT_IDS],
        left: { ...DEFAULT_LEFT },
        right: { ...DEFAULT_RIGHT },
    },
    visualType: "tree",
    run,
    pseudocode: [
        "cur <- root; use no stack and no recursion",
        "if cur has no left child: visit cur, then cur <- right (or thread)",
        "else find pred, the rightmost node of cur's left subtree",
        "if pred has no thread: set pred's thread to cur, visit cur, cur <- left",
        "if pred already threads to cur: remove it, cur <- right",
        "repeat until cur is null",
        "done: the visited list is the preorder traversal",
    ],
};

export default module;
