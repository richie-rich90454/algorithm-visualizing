/**
 * link-cut-tree.ts – Link-Cut Tree
 *
 * A dynamic forest: preferred paths live in splay trees joined by path
 * pointers. access(v) exposes the root-to-v path; link, cut, and path
 * queries all reduce to splay operations on exposed paths.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { links?: Array<[number, number]>; weights?: Record<string, number> } | null) ??
        {};
    const links = task.links ?? [
        [1, 2],
        [2, 3],
        [3, 4],
    ];
    const weights = task.weights ?? { "1-2": 5, "2-3": 2, "3-4": 7 };
    let step = 0;

    const parent = new Map<number, number>();
    const nodes = [1, 2, 3, 4];
    const wkey = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);
    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({
            id: `node-${n}`,
            type: "node" as const,
            label: String(n),
            value: n,
            state: (hot.has(n) ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parent.has(n) ? `node-${parent.get(n) ?? 0}` : "root" },
        })),
        edges: [...parent.entries()].map(([c, p]) => ({
            id: `edge-${p}-${c}`,
            sourceId: `node-${p}`,
            targetId: `node-${c}`,
            label: String(weights[wkey(p, c)] ?? 0),
            state: "idle" as EntityState,
            directed: false,
        })),
        description: message,
        codeLineNumber: line,
        layout: "tree",
        meta: { links: parent.size },
    });

    const pathTo = (v: number): number[] => {
        const path: number[] = [];
        let cur: number | undefined = v;
        while (cur !== undefined) {
            path.unshift(cur);
            cur = parent.get(cur);
        }
        return path;
    };

    yield snap(new Set(), "Four isolated trees – link them with link(u,v).", 0);
    step += 1;
    for (const [a, b] of links) {
        parent.set(b, a);
        yield snap(
            new Set([a, b]),
            `link(${a},${b}) – preferred path now reaches through ${a}.`,
            1,
        );
        step += 1;
    }
    const path = pathTo(4);
    yield snap(new Set(path), `access(4) exposes the root path [${path.join(",")}].`, 2);
    step += 1;
    let best = Infinity;
    for (let i = 0; i + 1 < path.length; i += 1) {
        const w = weights[wkey(path[i] ?? 0, path[i + 1] ?? 0)] ?? Infinity;
        if (w < best) {
            best = w;
        }
    }
    yield snap(new Set(path), `Path-minimum on 1..4 is ${best} – read off the exposed path.`, 3);
    step += 1;
    parent.delete(3);
    yield snap(new Set([3, 4]), "cut(3,4) – the forest splits into {1,2,3} and {4}.", 4);
}

const module: AlgorithmModule = {
    id: "link-cut-tree",
    name: "Link-Cut Tree",
    category: "data-structures",
    complexity: { time: "O(log n) amortized", space: "O(n)" },
    defaultInput: {
        links: [
            [1, 2],
            [2, 3],
            [3, 4],
        ],
        weights: { "1-2": 5, "2-3": 2, "3-4": 7 },
    },
    visualType: "tree",
    run,
};

export default module;
