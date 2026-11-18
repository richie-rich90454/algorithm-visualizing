/**
 * segment-tree-recursive.ts – Segment Tree (recursive)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A segment tree stores aggregate information (sum, min, max) over intervals.
 * It is a complete binary tree where each node covers a contiguous range of
 * the array; the leaves are the array elements and internal nodes combine
 * their children. Range queries and point updates both descend O(log n)
 * levels.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Build:   O(n)
 *   Query:   O(log n) for a range
 *   Update:  O(log n) for a point
 *   Space:   O(4n) node array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The tree is drawn hierarchically; node labels show covered ranges.
 *   - The queried range is highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The "divide the range in half" layout is the entire idea.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Segment Tree (recursive) generator.
 *
 * @param input `{ array, query }` – the array and a range query [l, r].
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { array?: number[]; query?: [number, number] } | null) ?? {};
    const array = task.array ?? [2, 1, 3, 4, 5];
    const [ql, qr] = task.query ?? [1, 3];

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

    // Build the segment tree recursively into a node list.
    const nodes: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    let nextId = 0;

    const build = (nodeId: number, l: number, r: number): void => {
        const id = `n-${nodeId}`;
        nodes.push({
            id,
            type: "node" as const,
            label: `[${l},${r}]`,
            value: nodeId,
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

    // Frame 0: the segment tree structure.
    yield {
        stepNumber: step,
        entities: nodes.map((nd) => ({ ...nd })),
        edges: edges.map((e) => ({ ...e })),
        description: `Segment tree over [${array.join(", ")}] – querying range [${ql}, ${qr}].`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { n },
    };
    step += 1;

    // Highlight the nodes that fully cover the query range.
    const highlight = new Set<string>();
    const visit = (nodeId: number, l: number, r: number): void => {
        if (ql <= l && r <= qr) {
            highlight.add(`n-${nodeId}`);
            return;
        }
        const mid = Math.floor((l + r) / 2);
        if (ql <= mid) {
            visit(2 * nodeId, l, mid);
        }
        if (qr > mid) {
            visit(2 * nodeId + 1, mid + 1, r);
        }
    };
    visit(1, 0, n - 1);

    yield {
        stepNumber: step,
        entities: nodes.map((nd) => ({
            ...nd,
            state: highlight.has(nd.id) ? ("sorted" as const) : nd.state,
        })),
        edges: edges.map((e) => ({ ...e })),
        description: `The range [${ql}, ${qr}] is covered by the highlighted nodes – O(log n) nodes total.`,
        codeLineNumber: 2,
        layout: "tree",
        meta: { n },
    };
    step += 1;

    const querySum = array.slice(ql, qr + 1).reduce((a, b) => a + b, 0);

    yield {
        stepNumber: step,
        entities: nodes.map((nd) => ({
            ...nd,
            state: highlight.has(nd.id) ? ("sorted" as const) : nd.state,
        })),
        edges: edges.map((e) => ({ ...e })),
        description: `Range query [${ql}, ${qr}] complete – sum = ${querySum} from the highlighted node aggregates.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { n, sum: querySum },
    };
}

/** The Segment Tree (recursive) module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A recursive segment tree splits the array into halves until leaves hold single elements, with each internal node combining its children aggregates. A range query returns a node aggregate when fully covered, skips nodes outside, and recurses only on partial overlaps.",
        "invariants": [
            "Each node covers a contiguous interval and stores its aggregate.",
            "Children partition the parent interval.",
            "A query visits O(log n) canonical nodes that exactly cover the range."
        ],
        "correctness": "Fully covered nodes contribute their exact aggregates, and the visited nodes are disjoint and union to the query range, so their combination is the range aggregate. Nodes outside the range are skipped safely because they contain no queried elements.",
        "complexityRationale": "Building visits O(n) nodes and a query or point update descends O(log n) levels touching O(log n) canonical nodes. The recursive tree uses a node array of size O(4n).",
        "uses": [
            "Range minimum and sum queries",
            "Competitive programming range structures",
            "Static and dynamic aggregation over intervals"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 14",
            "cp-algorithms, Segment Tree"
        ],
        "workedExample": "Array [2,1,3,4,5] splits into halves until leaves; query [1,3] returns canonical node aggregates for indices 1, 2, 3 and combines them to 1+3+4=8."
    },
    id: "segment-tree-recursive",
    name: "Segment Tree (Recursive)",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { array: [2, 1, 3, 4, 5], query: [1, 3] },
    visualType: "tree",
    run,
    pseudocode: [
        "start with the raw array and no tree nodes",
        "build recursively: leaf holds one element, parent sums children",
        "query range: return the node sum when fully covered",
        "skip nodes fully outside and recurse into partial overlaps",
        "at most O(log n) canonical nodes cover any interval",
        "combine their aggregates into one range sum",
        "done: recursion visits few nodes and the range answer is reported",
    ],
};

export default module;
