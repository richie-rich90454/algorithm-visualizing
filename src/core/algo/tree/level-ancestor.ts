/**
 * level-ancestor.ts - Level Ancestor Queries by Binary Lifting
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A level ancestor query asks for the ancestor of a node at a given depth.
 * Binary lifting precomputes the 2^k-th ancestor of every node, so a query
 * lifts the start node by the difference between its depth and the target
 * depth using the binary representation of that difference. Each set bit
 * consumes one precomputed jump.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) preprocessing, O(log n) per query
 *   Space: O(n log n) for the lifting table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show their index and current depth.
 *   - The node reached after each binary jump is highlighted.
 *   - Tree edges on the lifted path turn blue.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Query {
    node: number;
    depth: number;
}

function makeNodes(
    parents: number[],
    depths: number[],
    highlight: number,
    path: Set<number>,
): VisualEntity[] {
    return parents.map((parent, index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label: `${index}(d${depths[index] ?? 0})`,
        value: index,
        state: (index === highlight ? "comparing" : path.has(index) ? "active" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, parentId: parent < 0 ? "root" : String(parent), depth: depths[index] ?? 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { parents?: number[]; queries?: Array<[number, number]> } | null) ?? {};
    const parents = (task.parents ?? [-1, 0, 0, 1, 1, 2, 2])
        .map((p) => (typeof p === "number" && Number.isFinite(p) ? Math.floor(p) : -1))
        .slice();
    const queries = (task.queries ?? [[4, 1], [5, 0], [3, 1]])
        .map((pair) => ({ node: Math.floor(pair?.[0] ?? 0), depth: Math.floor(pair?.[1] ?? 0) }))
        .filter((query) => query.node >= 0 && query.node < parents.length);
    let step = 0;

    const edges: VisualEdge[] = parents.map((parent, child) => ({
        id: `edge-${parent}-${child}`,
        sourceId: `node-${parent}`,
        targetId: `node-${child}`,
        label: "",
        state: "idle" as EntityState,
        directed: true,
    })).filter((edge) => edge.sourceId !== "node--1");

    const depths = new Array<number>(parents.length).fill(0);
    const children: number[][] = parents.map(() => []);
    let root = -1;
    for (let i = 0; i < parents.length; i += 1) {
        const parent = parents[i] ?? -1;
        if (parent < 0 || parent >= parents.length) root = i;
        else children[parent]?.push(i);
    }
    const visited = new Set<number>();
    const queue = root >= 0 ? [root] : [];
    if (root >= 0) visited.add(root);
    for (let head = 0; head < queue.length; head += 1) {
        const node = queue[head] ?? 0;
        for (const child of children[node] ?? []) {
            depths[child] = (depths[node] ?? 0) + 1;
            visited.add(child);
            queue.push(child);
        }
    }
    for (let i = 0; i < parents.length; i += 1) {
        if (!visited.has(i)) {
            depths[i] = 0;
            root = i;
        }
    }

    const emit = (description: string, line: number, highlight: number, path: Set<number>, answers: number[], meta: Record<string, number | string | boolean | number[]>): VisualFrame => {
        const visualEdges = edges.map((edge) => {
            const child = Number(edge.targetId.replace("node-", ""));
            return { ...edge, state: (path.has(child) ? "active" : "idle") as EntityState };
        });
        return {
            stepNumber: step,
            entities: makeNodes(parents, depths, highlight, path),
            edges: visualEdges,
            description,
            codeLineNumber: line,
            layout: "tree",
            meta: { nodes: parents.length, answers: [...answers], depths: [...depths], ...meta },
        };
    };

    if (parents.length === 0) {
        yield emit("Empty tree - there are no ancestors to query.", 0, -1, new Set(), [], { queries: 0 });
        return;
    }

    const log = Math.max(1, Math.ceil(Math.log2(parents.length + 1)) + 1);
    const up: number[][] = [];
    for (let k = 0; k < log; k += 1) {
        up.push(new Array<number>(parents.length).fill(-1));
    }
    for (let i = 0; i < parents.length; i += 1) up[0]![i] = parents[i] ?? -1;
    for (let k = 1; k < log; k += 1) {
        for (let i = 0; i < parents.length; i += 1) {
            const middle = up[k - 1]![i] ?? -1;
            up[k]![i] = middle >= 0 ? (up[k - 1]![middle] ?? -1) : -1;
        }
    }

    yield emit(`Built a ${log}-level lifting table for ${parents.length} nodes.`, 1, root, new Set(), [], { queries: queries.length });
    step += 1;

    const answers: number[] = [];
    for (let q = 0; q < queries.length; q += 1) {
        const query = queries[q];
        if (!query) continue;
        let current = query.node;
        const jump = Math.max(0, (depths[current] ?? 0) - query.depth);
        const path = new Set<number>([current]);
        yield emit(
            `Query ${q}: node ${current} at depth ${depths[current]}; lift ${jump} level(s) to depth ${query.depth}.`,
            2,
            current,
            path,
            answers,
            { queries: queries.length, query: q, jump },
        );
        step += 1;
        for (let k = 0; k < log; k += 1) {
            if ((jump & (1 << k)) === 0) continue;
            const next = up[k]![current] ?? -1;
            if (next < 0) break;
            current = next;
            path.add(current);
            yield emit(
                `Bit ${k} of ${jump} is set: jump 2^${k} ancestor to node ${current} at depth ${depths[current]}.`,
                3,
                current,
                path,
                answers,
                { queries: queries.length, query: q, bit: k },
            );
            step += 1;
        }
        answers.push(current);
    }

    yield emit(
        `Done: level ancestors are ${answers.join(", ") || "none"}.`,
        6,
        -1,
        new Set(),
        answers,
        { queries: queries.length },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Walking parent pointers one step at a time is too slow for tall trees. Binary lifting stores the 2^k-th ancestor of every node, so the number of levels to climb can be written in binary and each set bit is handled by one table lookup. The answer is the node left after all jumps.",
        invariants: [
            "up[k][v] is the ancestor of v that is exactly 2^k edges above it, or -1 if none exists.",
            "depths[parent] is always one less than depths[child] for every tree edge.",
            "Applying the jumps in increasing bit order leaves the node at the requested depth.",
        ],
        correctness:
            "The base table holds immediate parents by definition, and up[k] is built from two up[k-1] jumps, which by induction lands exactly 2^k levels higher. Any nonnegative climb has a unique binary decomposition, so the sequence of jumps moves the node up exactly depth(u) minus the target depth, landing on the ancestor at that depth.",
        complexityRationale:
            "Preprocessing fills n cells for each of O(log n) levels in O(n log n) time and space; each query performs at most log n table reads, giving O(log n) per query.",
        uses: [
            "Answering ancestor constraints in tree parsers and compilers",
            "Accelerating lowest-common-ancestor computations",
            "Range queries on rooted file systems and XML documents",
        ],
        references: [
            "Bender and Farach-Colton, The LCA Problem Revisited (2000)",
            "cp-algorithms.com, Binary Lifting and Lowest Common Ancestor",
        ],
        workedExample:
            "In the tree with parents [-1,0,0,1,1,2,2], node 5 has depth 2 and parent chain 2 then 0. Asking for the ancestor at depth 0 needs a jump of two levels; reading up[1][5] returns 0 immediately instead of walking two pointers.",
    },
    id: "level-ancestor",
    name: "Level Ancestor (Binary Lifting)",
    category: "tree",
    complexity: { time: "O(n log n + q log n)", space: "O(n log n)" },
    defaultInput: { parents: [-1, 0, 0, 1, 1, 2, 2], queries: [[4, 1], [5, 0], [3, 1]] },
    visualType: "tree",
    run,
    pseudocode: [
        "compute the depth of every node from the root",
        "store each node's immediate parent as up[0]",
        "build up[k] from two up[k-1] jumps",
        "for each query, compute the levels to climb",
        "for each set bit of that difference, take the stored jump",
        "the node after all jumps is the level ancestor",
        "done: report one answer per query",
    ],
};

export default module;
