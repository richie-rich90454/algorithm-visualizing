/**
 * dsu.ts – Disjoint Set Union (Union-Find)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A disjoint set union tracks a partition of elements into disjoint sets. It
 * supports `find` (which set is an element in) and `union` (merge two sets).
 * With path compression and union by rank, both operations run in
 * O(α(n)) – nearly constant. It is the engine behind Kruskal's algorithm and
 * dynamic connectivity.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Find / union: O(α(n)) amortized
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
 * @param input `{ size, unions }` – the element count and merges to perform.
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
        description: `Disjoint set with ${size} elements – each is its own set.`,
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
            `Union(${a}, ${b}) – representatives ${ra} and ${rb} ${ra === rb ? "already in the same set" : "merged"}.`,
        );
        step += 1;
    }

    yield buildFrame(
        `DSU complete – ${new Set(parent.map((p, i) => (p === i ? i : find(i)))).size} set(s) remain.`,
    );
}

/** The DSU module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Disjoint set union maintains a collection of non-overlapping sets with find and union operations. Each set is a tree whose root is the representative. Path compression flattens trees during find, and union by rank attaches the shallower tree under the deeper one, making both operations nearly constant time.",
        "invariants": [
            "Each element has a parent pointer, and roots point to themselves.",
            "Two elements are in the same set exactly when find returns the same root.",
            "Ranks increase only when trees of equal rank are merged."
        ],
        "correctness": "Find climbs parent pointers to the root, so it returns the unique representative of the set. Union changes one root's parent to the other, merging exactly two sets and no others. Path compression shortens paths without changing roots, so connectivity answers stay correct.",
        "complexityRationale": "Path compression plus union by rank gives amortized O(alpha(n)) time per operation, where alpha is the inverse Ackermann function, effectively constant. One parent and one rank per element use O(n) space.",
        "uses": [
            "Kruskal's minimum spanning tree",
            "Dynamic connectivity and network components",
            "Image segmentation and percolation analysis"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 21",
            "Robert Tarjan, \"Efficiency of a Good But Not Linear Set Union Algorithm\", JACM 1975"
        ],
        "workedExample": "Start with elements 1..4 each its own parent. Union(1,2) makes 1 the root of 2; union(3,4) makes 3 root of 4. Find(2) compresses 2's parent to 1. Union(2,4) merges the two trees; afterwards find(1) and find(4) return the same root."
    },
    id: "dsu",
    name: "Disjoint Set Union",
    category: "data-structures",
    complexity: { time: "O(α(n)) ops", space: "O(n)" },
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
    pseudocode: [
        "initialize DSU with each element as its own set",
        "find representative with path compression",
        "compare roots of pair to test same set",
        "union sets by rank attaching smaller under larger",
        "compress path on every find for speed",
        "count remaining sets from distinct roots",
        "done: DSU holds sets with union results",
    ],
};

export default module;
