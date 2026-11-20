/**
 * threaded-binary-tree.ts – Inorder-threaded binary tree.
 *
 * Every null child link is replaced by a thread to the inorder
 * predecessor (left) or successor (right), so traversal needs no stack.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Edge = {
    id: string;
    sourceId: string;
    targetId: string;
    label: string;
    state: EntityState;
    directed: boolean;
};

function node(id: string, parent: string | null, state: EntityState = "idle"): VisualEntity {
    return {
        id: `node-${id}`,
        type: "node" as const,
        label: id,
        value: id,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: parent === null ? "root" : `node-${parent}` },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const t = (input as { values?: unknown } | null) ?? {};
    const values = Array.isArray(t.values)
        ? (t.values as unknown[]).map(String)
        : ["4", "2", "6", "1", "3", "5", "7"];

    let step = 0;
    const treeEdges: Edge[] = [];
    const parent = new Map<string, string | null>();
    values.forEach((v, i) => {
        const p = i === 0 ? null : (values[(i - 1) >> 1] as string);
        parent.set(v, p);
        if (p !== null) {
            treeEdges.push({
                id: `edge-node-${p}-node-${v}`,
                sourceId: `node-${p}`,
                targetId: `node-${v}`,
                state: "idle",
                label: "",
                directed: false,
            });
        }
    });
    const left = new Map<string, string | null>();
    const right = new Map<string, string | null>();
    values.forEach((v, i) => {
        left.set(v, values[2 * i + 1] !== undefined ? (values[2 * i + 1] as string) : null);
        right.set(v, values[2 * i + 2] !== undefined ? (values[2 * i + 2] as string) : null);
    });

    const inorder: string[] = [];
    const walk = (i: number): void => {
        if (i >= values.length) return;
        walk(2 * i + 1);
        inorder.push(values[i] as string);
        walk(2 * i + 2);
    };
    walk(0);

    const threads: { from: string; to: string | null; side: string }[] = [];
    inorder.forEach((v, i) => {
        if (left.get(v) === null)
            threads.push({ from: v, to: i > 0 ? (inorder[i - 1] as string) : null, side: "left" });
        if (right.get(v) === null)
            threads.push({
                from: v,
                to: i < inorder.length - 1 ? (inorder[i + 1] as string) : null,
                side: "right",
            });
    });

    const emit = (
        states: Record<string, EntityState>,
        threadCount: number,
        description: string,
        codeLineNumber: number,
        meta: VisualFrame["meta"] = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: values.map((v) => node(v, parent.get(v) ?? null, states[v] ?? "idle")),
        edges: [
            ...treeEdges,
            ...threads.slice(0, threadCount).flatMap((th, k) =>
                th.to === null
                    ? []
                    : [
                          {
                              id: `thread-${k}`,
                              sourceId: `node-${th.from}`,
                              targetId: `node-${th.to}`,
                              label: "",
                              state: "path" as EntityState,
                              directed: false,
                          },
                      ],
            ),
        ],
        description,
        codeLineNumber,
        layout: "tree" as const,
        meta,
    });

    if (values.length === 0) {
        yield emit({}, 0, "Empty tree – no threads to create.", 0, { threads: 0, inorder: [] });
        return;
    }

    yield emit(
        {},
        0,
        `Complete tree on ${values.join(", ")} – ${threads.length} null links will become threads.`,
        0,
    );
    step += 1;
    yield emit(
        Object.fromEntries(inorder.map((v) => [v, "visited" as EntityState])),
        threads.length,
        `Inorder order is ${inorder.join(" → ")}; threads follow this order.`,
        1,
        { inorder },
    );
    step += 1;

    const order = [...threads].sort((a, b) => values.indexOf(a.from) - values.indexOf(b.from));
    const batch = Math.max(1, Math.ceil(order.length / 9));
    for (let end = batch; end < order.length; end += batch) {
        const states: Record<string, EntityState> = {};
        for (const th of order.slice(0, end)) states[th.from] = "visited";
        states[(order[end - 1] as { from: string }).from] = "comparing";
        const th = order[end - 1] as { from: string; to: string | null; side: string };
        yield emit(
            states,
            end,
            th.to === null
                ? `${th.from}'s null ${th.side} link threads to the header (no ${th.side === "left" ? "predecessor" : "successor"}).`
                : `${th.from}'s null ${th.side} link threads to ${th.to}.`,
            2,
        );
        step += 1;
    }
    const states: Record<string, EntityState> = {};
    for (const v of values) states[v] = "sorted";
    yield emit(
        states,
        threads.length,
        `Threaded – all ${threads.length} null links replaced; inorder walk needs no stack.`,
        4,
        { threads: threads.length, inorder },
    );
}

const module: AlgorithmModule = {
    education: {
        "intuition": "A threaded binary tree replaces null child pointers with useful links called threads: a null left pointer points to the inorder predecessor and a null right pointer to the successor. This lets an inorder traversal proceed without a stack or recursion, using flag bits to distinguish threads from real children.",
        "invariants": [
            "A thread exists only where the corresponding child pointer was null.",
            "Left threads point to predecessors and right threads to successors.",
            "Flag bits correctly distinguish real children from threads during traversal."
        ],
        "correctness": "In inorder order the predecessor of a node with no left child is the last node visited before it, and the successor of a node with no right child is the next node to visit. Replacing those null pointers gives a direct link along the traversal path, so following right pointers and threads visits nodes in the same sequence as recursive inorder. Keeping flag bits avoids treating a thread as a subtree, so termination at the end of the sequence is correct.",
        "complexityRationale": "Each node is visited once and each thread followed once, so traversal takes O(n) time. The threads reuse existing null pointers, adding only flag bits, so space is O(1) beyond the tree itself.",
        "uses": [
            "Stack-free inorder traversal of binary trees",
            "Memory-constrained tree iterators",
            "Teaching explicit threading of data structures"
        ],
        "references": [
            "Knuth, The Art of Computer Programming, Vol. 1, Section 2.3.1",
            "Aho, Hopcroft, and Ullman, Data Structures and Algorithms, Chapter 2"
        ],
        "workedExample": "For tree A with left child B, right child C, and B having left child D, the inorder sequence is D, B, A, C. Threads are set from D to B, from B to A, and from C back to the end marker, letting the walk proceed using right pointers only."
    },

    id: "threaded-binary-tree",
    name: "Threaded Binary Tree",
    category: "tree",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { values: ["4", "2", "6", "1", "3", "5", "7"] },
    visualType: "tree",
    run,
    pseudocode: [
        "build complete binary tree from level order values",
        "compute inorder order of all tree nodes",
        "replace each null left link with predecessor thread",
        "replace each null right link with successor thread",
        "return threaded tree with stack-free walk as answer",
    ],
};

export default module;
