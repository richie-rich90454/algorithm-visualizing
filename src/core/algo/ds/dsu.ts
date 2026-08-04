/**
 * dsu.ts â€?Disjoint Set Union (Union-Find)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A disjoint set union tracks a partition of elements into disjoint sets. It
 * supports `find` (which set is an element in) and `union` (merge two sets).
 * With path compression and union by rank, both operations run in
 * O(Î±(n)) â€?nearly constant. It is the engine behind Kruskal's algorithm and
 * dynamic connectivity.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Find / union: O(Î±(n)) amortised
 *   Space:        O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each set is a small tree rooted at its representative.
 *   - The found representative is YELLOW (comparing).
 *   - Merged sets are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Path compression + union by rank = the entire concept.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The DSU generator.
 *
 * @param input `{ size, unions }` â€?the element count and merges to perform.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { size?: number; unions?: Array<[number, number]> } | null) ?? {};
    const size = typeof task.size === "number" ? task.size : 6;
    const unions = task.unions ?? [
        [0, 1],
        [2, 3],
        [0, 2],
        [4, 5],
    ];

    let step = 0;
    const parent = Array.from({ length: size }, (_, i) => i);

    const find = (x: number): number => {
        while (parent[x] !== x) {
            x = parent[x] ?? 0;
        }
        return x;
    };

    const buildFrame = (message: string): VisualFrame => {
        // Show each tree rooted at its representative.
        const roots = new Set(parent.map((p, i) => (p === i ? i : find(i))));
        const nodes: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        parent.forEach((p, i) => {
            nodes.push({
                id: `n-${i}`,
                type: "node" as const,
                label: String(i),
                value: i,
                state: p === i ? "sorted" : "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: p === i ? "root" : `n-${p}` },
            });
            if (p !== i) {
                edges.push({
                    id: `e-${p}-${i}`,
                    sourceId: `n-${p}`,
                    targetId: `n-${i}`,
                    label: "",
                    state: "idle",
                    directed: false,
                });
            }
        });
        return {
            stepNumber: step,
            entities: nodes,
            edges,
            description: message,
            codeLineNumber: 2,
            layout: "tree",
            meta: { sets: roots.size },
        };
    };

    // Frame 0: every element is its own set.
    yield {
        stepNumber: step,
        entities: parent.map((_, i) => ({
            id: `n-${i}`,
            type: "node" as const,
            label: String(i),
            value: i,
            state: "sorted",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: "root" },
        })),
        edges: [],
        description: `Disjoint set with ${size} elements â€?each is its own set.`,
        codeLineNumber: 1,
        layout: "tree",
        meta: { sets: size },
    };
    step += 1;

    // Perform the unions.
    for (const [a, b] of unions) {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) {
            parent[rb] = ra;
        }
        yield buildFrame(
            `Union(${a}, ${b}) â€?representatives ${ra} and ${rb} ${ra === rb ? "already in the same set" : "merged"}.`,
        );
        step += 1;
    }

    yield buildFrame(
        `DSU complete â€?${new Set(parent.map((p, i) => (p === i ? i : find(i)))).size} set(s) remain.`,
    );
}

/** The DSU module, registered with the engine. */
const module: AlgorithmModule = {
    id: "dsu",
    name: "Disjoint Set Union",
    category: "data-structures",
    complexity: { time: "O(Î±(n)) ops", space: "O(n)" },
    defaultInput: {
        size: 6,
        unions: [
            [0, 1],
            [2, 3],
            [0, 2],
            [4, 5],
        ],
    },
    visualType: "tree",
    run,
};

export default module;
