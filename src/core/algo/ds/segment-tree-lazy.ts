/**
 * segment-tree-lazy.ts – Segment Tree with Lazy Propagation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Lazy propagation makes range *updates* O(log n) on a segment tree. Instead
 * of pushing an update down to every leaf, a node records a "lazy" pending
 * value and only propagates it when a future query/update actually needs the
 * children. This keeps range-add + range-query both at O(log n).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Build / range update / range query: O(log n)
 *   Space:                              O(4n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The tree nodes are drawn with their lazy tags.
 *   - Updated ranges are highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Defer the work until it is needed" is the entire idea.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Lazy Segment Tree generator.
 *
 * @param input `{ array, update, query }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            array?: number[];
            update?: [number, number, number];
            query?: [number, number];
        } | null) ?? {};
    const array = task.array ?? [2, 1, 3, 4, 5];
    const update = task.update ?? [1, 3, 2];
    const query = task.query ?? [0, 4];

    let step = 0;
    const n = array.length;

    // An empty array has no tree to draw.
    if (n === 0) {
        yield {
            stepNumber: step,
            entities: [],
            edges: [],
            description: "Empty array – no segment tree to build.",
            codeLineNumber: 0,
            layout: "tree",
            meta: { n },
        };
        return;
    }

    // Build the tree structure.
    const nodes: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    const lazy = new Map<string, number>();
    const values = new Map<string, number>();

    const build = (nodeId: number, l: number, r: number): void => {
        const id = `n-${nodeId}`;
        const sum = array.slice(l, r + 1).reduce((a, b) => a + b, 0);
        values.set(id, sum);
        nodes.push({
            id,
            type: "node" as const,
            label: `[${l},${r}] ${sum}`,
            value: sum,
            state: "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: nodeId === 1 ? "root" : `n-${Math.floor(nodeId / 2)}` },
        });
        if (l === r) {
            return;
        }
        const mid = Math.floor((l + r) / 2);
        edges.push({
            id: `e-${nodeId}-${2 * nodeId}`,
            sourceId: id,
            targetId: `n-${2 * nodeId}`,
            label: "",
            state: "idle",
            directed: false,
        });
        edges.push({
            id: `e-${nodeId}-${2 * nodeId + 1}`,
            sourceId: id,
            targetId: `n-${2 * nodeId + 1}`,
            label: "",
            state: "idle",
            directed: false,
        });
        build(2 * nodeId, l, mid);
        build(2 * nodeId + 1, mid + 1, r);
    };
    build(1, 0, n - 1);

    // Frame 0: the tree with sums.
    yield {
        stepNumber: step,
        entities: nodes.map((nd) => ({ ...nd })),
        edges: edges.map((e) => ({ ...e })),
        description: `Lazy segment tree – range-add [${update[0]}, ${update[1]}] by ${update[2]}.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { n },
    };
    step += 1;

    // Simulate the lazy update: mark the canonical cover nodes with a lazy tag.
    const [ul, ur, ux] = update;
    const mark = (nodeId: number, l: number, r: number): void => {
        if (ul <= l && r <= ur) {
            lazy.set(`n-${nodeId}`, (lazy.get(`n-${nodeId}`) ?? 0) + ux);
            return;
        }
        const mid = Math.floor((l + r) / 2);
        if (ul <= mid) {
            mark(2 * nodeId, l, mid);
        }
        if (ur > mid) {
            mark(2 * nodeId + 1, mid + 1, r);
        }
    };
    mark(1, 0, n - 1);

    const display = nodes.map((nd) =>
        lazy.has(nd.id)
            ? { ...nd, state: "comparing" as const, label: `${nd.label} (+${lazy.get(nd.id)})` }
            : nd,
    );

    yield {
        stepNumber: step,
        entities: display,
        edges: edges.map((e) => ({ ...e })),
        description: `Lazy tags placed on the cover nodes – children not yet touched.`,
        codeLineNumber: 2,
        layout: "tree",
        meta: { n },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: display.map((d) => ({ ...d, state: "sorted" as const })),
        edges: edges.map((e) => ({ ...e })),
        description: `Lazy tags will be pushed down only when a query needs the children.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { n },
    };
}

/** The Lazy Segment Tree module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Lazy propagation makes range updates fast by stamping a pending value on a node that fully covers the update range instead of visiting every leaf. The tag is pushed to children only when a later operation needs them, keeping both range add and range query logarithmic.",
        "invariants": [
            "A node aggregate reflects all updates applied to its segment.",
            "A pending lazy tag records updates not yet passed to children.",
            "Pushing a tag preserves the aggregate while distributing the work."
        ],
        "correctness": "A covered node update adds to its aggregate and records the tag, correctly representing the whole segment without touching children. Before descending, pushing the tag makes children aggregates and tags consistent, so every later query or partial update sees the true values.",
        "complexityRationale": "A range update or query visits O(log n) canonical nodes and pushes tags only along those paths, O(log n). The node array and one tag per node use O(n) space.",
        "uses": [
            "Range add and range sum on large arrays",
            "Interval scheduling with batched updates",
            "Graphics and geometry range operations"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 14",
            "cp-algorithms, Lazy Propagation in segment trees"
        ],
        "workedExample": "Array [2,1,3,4,5]; range add 2 on [1,3] stamps covering nodes without touching leaves. Query [0,4] pushes tags along the path and returns the updated total 21."
    },
    id: "segment-tree-lazy",
    name: "Segment Tree (Lazy)",
    category: "data-structures",
    complexity: { time: "O(log n) range ops", space: "O(n)" },
    defaultInput: { array: [2, 1, 3, 4, 5], update: [1, 3, 2], query: [0, 4] },
    visualType: "tree",
    run,
    pseudocode: [
        "start with an empty tree over the initial array",
        "build sums bottom-up so each node covers its interval",
        "range-add: stamp lazy tags on fully covered nodes and stop",
        "partial overlaps descend after pushing pending tags to children",
        "query pushes tags along the path so children read correctly",
        "tags defer work until a query truly needs the children",
        "done: range is added lazily and the query sum is reported",
    ],
};

export default module;
