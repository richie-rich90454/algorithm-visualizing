/**
 * union-find-deletions.ts – Union-Find with Deletions
 *
 * Deletions break plain DSU, so elements are versioned: deleting x
 * retires its node and creates a fresh singleton that future unions
 * adopt, while path compression keeps finds fast.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { n?: number; ops?: Array<["union" | "delete", number?, number?]> } | null) ?? {};
    const n = task.n ?? 3;
    const ops = task.ops ?? [
        ["union", 0, 1],
        ["delete", 0],
        ["union", 0, 2],
    ];
    let step = 0;

    const parent: number[] = [];
    const current: number[] = [];
    for (let i = 0; i < n; i += 1) {
        parent.push(i);
        current.push(i);
    }
    const find = (x: number): number => {
        let r = x;
        while ((parent[r] ?? r) !== r) {
            parent[r] = parent[parent[r] ?? r] ?? r;
            r = parent[r] ?? r;
        }
        return r;
    };
    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: current.map((node, elem) => ({
            id: `ud-${elem}`,
            type: "cell" as const,
            label: `${elem}@${node}`,
            value: node,
            state: (hot.has(elem) ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: elem },
        })),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { elements: n, nodes: parent.length },
    });

    yield snap(new Set(), `Versioned union-find over ${n} elements – CELL shows element@node.`, 0);
    step += 1;
    for (const [op, a, b] of ops) {
        if (op === "union" && a !== undefined && b !== undefined) {
            const ra = find(current[a] ?? a);
            const rb = find(current[b] ?? b);
            if (ra !== rb) {
                parent[rb] = ra;
            }
            yield snap(
                new Set([a, b]),
                ra === rb
                    ? `union(${a},${b}) – already together.`
                    : `union(${a},${b}) – node ${rb} joins ${ra}.`,
                1,
            );
        } else if (op === "delete" && a !== undefined) {
            const fresh = parent.length;
            parent.push(fresh);
            current[a] = fresh;
            yield snap(
                new Set([a]),
                `delete(${a}) – old node retired, fresh singleton ${fresh} issued.`,
                2,
            );
        }
        step += 1;
    }
    const comps = new Set(current.map((node) => find(node))).size;
    yield snap(new Set(), `${comps} component(s) across live versions.`, 3);
}

const module: AlgorithmModule = {
    id: "union-find-deletions",
    name: "Union-Find Deletions",
    category: "data-structures",
    complexity: { time: "O(alpha n) amortized", space: "O(n + deletes)" },
    defaultInput: {
        n: 3,
        ops: [
            ["union", 0, 1],
            ["delete", 0],
            ["union", 0, 2],
        ],
    },
    visualType: "grid",
    run,
};

export default module;
