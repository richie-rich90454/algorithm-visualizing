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
    id: "louds-trie",
    name: "LOUDS Trie",
    category: "data-structures",
    complexity: { time: "O(1) nav", space: "2n + 1 bits" },
    defaultInput: { children: [[2, 1], [0], [1], [0]], query: 2 },
    visualType: "grid",
    run,
};

export default module;
