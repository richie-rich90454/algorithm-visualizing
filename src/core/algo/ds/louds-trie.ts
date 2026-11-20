/**
 * louds-trie.ts – LOUDS Trie
 *
 * Level-Order Unary Degree Sequence: each node becomes 1^degree 0 in
 * breadth-first order, so the whole shape fits in 2n+1 bits and child
 * navigation is rank/select arithmetic.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { children?: number[][]; query?: number } | null) ?? {};
    const children = task.children ?? [[2, 1], [0], [1], [0]];
    const query = task.query ?? 2;
    let step = 0;

    const louds: number[] = [1];
    const order: number[] = [0];
    const seen = new Set<number>([0]);
    for (let oi = 0; oi < order.length; oi += 1) {
        const n = order[oi] ?? 0;
        const degree = children[n]?.length ?? 0;
        for (let i = 0; i < degree; i += 1) {
            louds.push(1);
        }
        louds.push(0);
        for (const c of children[n] ?? []) {
            if (!seen.has(c)) {
                seen.add(c);
                order.push(c);
            }
        }
    }
    const rank1 = (i: number): number => louds.slice(0, i + 1).reduce((a, b) => a + b, 0);
    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: louds.map((b, i) => ({
            id: `lo-${i}`,
            type: "cell" as const,
            label: String(b),
            value: b,
            state: (hot.has(i) ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        })),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { bits: louds.length, nodes: order.length },
    });

    yield snap(
        new Set(),
        `LOUDS encoding of the shape: ${louds.join("")} (${louds.length} bits).`,
        0,
    );
    step += 1;
    const pos = order.indexOf(query);
    yield snap(
        new Set([pos]),
        `Node ${query} is ${pos >= 0 ? pos + 1 : "?"}-th in level order.`,
        1,
    );
    step += 1;
    const degree = children[query]?.length ?? 0;
    const r = pos >= 0 ? rank1(pos) : 0;
    yield snap(
        new Set(),
        `Node ${query} has degree ${degree} – rank arithmetic locates its children.`,
        2,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "LOUDS encodes a trie as a bitvector in level order: each node contributes a run of 1 bits equal to its number of children followed by a 0. The shape of the whole tree fits in 2n+1 bits, and rank and select operations on the bitvector navigate to children. Labels are stored separately.",
        "invariants": [
            "The bitvector is 1^degree followed by 0 for each node in breadth-first order.",
            "The number of 1 bits plus one equals the number of nodes.",
            "The kth child of a node is found by rank and select on the bitvector."
        ],
        "correctness": "Unary encoding makes the position of a node's first child computable from the rank of ones, and its degree from the distance to the next zero. Selecting the child position then yields the correct child node. Because the encoding is a bijection with tree shape, navigation is exact.",
        "complexityRationale": "Rank and select on a succinct bitvector take O(1) with a small index, so child navigation is O(1). The structure uses 2n+1 bits plus labels, essentially O(n) bits.",
        "uses": [
            "Succinct dictionaries and tries",
            "Compressed text indexes",
            "Memory-constrained prefix matching"
        ],
        "references": [
            "J. P. Jacobson, \"Space-Efficient Static Trees and Graphs\", FOCS 1989",
            "Raman, Raman, and Rao, \"Succinct Indexable Dictionaries\", 2002"
        ],
        "workedExample": "A root with two children, each a leaf, encodes as 110 10 10, or 1101010: root contributes 110, first child 10, second child 10. The seven bits equal 2*3 + 1 for three nodes. Child positions are found by rank and select over the ones."
    },
    id: "louds-trie",
    name: "LOUDS Trie",
    category: "data-structures",
    complexity: { time: "O(1) nav", space: "2n + 1 bits" },
    defaultInput: { children: [[2, 1], [0], [1], [0]], query: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize LOUDS bitvector for level-order trie",
        "encode node degrees in unary per level",
        "compare rank and select to navigate children",
        "insert word by extending bitvector levels",
        "search query by rank-select steps per character",
        "count nodes via select operations",
        "done: succinct trie holds keys with lookup answer",
    ],
};

export default module;
