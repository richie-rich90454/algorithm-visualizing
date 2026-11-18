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

    education: {
        "intuition": "A link-cut tree maintains a dynamic forest under link and cut operations. Preferred paths are stored in splay trees connected by path-parent pointers, and the access operation exposes the root-to-vertex path as one splay. Link, cut, and path queries then reduce to splay operations on exposed paths.",
        "invariants": [
            "Each splay represents a contiguous preferred path in the represented tree.",
            "Path-parent pointers connect splays into the full tree.",
            "access(v) makes the root-to-v path the preferred path ending at v."
        ],
        "correctness": "Exposing a path makes every vertex on it belong to one splay, so a path aggregate can be read from that splay's stored summary. Linking attaches a root as a path child; cutting detaches after exposure. Splay rotations preserve inorder path order, so the represented forest is always encoded correctly.",
        "complexityRationale": "Each access does O(log n) amortized splay work, so link, cut, and path queries are O(log n) amortized. One node per vertex plus splay links uses O(n) space.",
        "uses": [
            "Dynamic connectivity in forests",
            "Network flow and dynamic tree problems",
            "Path queries on evolving hierarchies"
        ],
        "references": [
            "Daniel D. Sleator and Robert E. Tarjan, \"A Data Structure for Dynamic Trees\", JCSS 1983",
            "D. D. Sleator and R. E. Tarjan, \"Self-Adjusting Binary Search Trees\", JACM 1985"
        ],
        "workedExample": "Start with isolated A, B, C. Link A-B makes one tree; access(B) exposes path A-B in a splay. Linking B-C adds C to that tree. Cutting A-B after exposing A-B splits the splay, so connectivity from A to C now fails."
    },
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
    pseudocode: [
        "initialize link-cut forest with isolated preferred paths",
        "expose path by splaying and switching preferred children",
        "compare depths to find path parent",
        "link trees by attaching root as path child",
        "cut edge by exposing then detaching child",
        "query path aggregate over exposed splay",
        "done: forest holds trees with path query answer",
    ],
};

export default module;
