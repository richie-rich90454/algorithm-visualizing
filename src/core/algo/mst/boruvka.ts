/**
 * boruvka.ts – Borůvka's Algorithm (Minimum Spanning Tree)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Borůvka's algorithm builds the MST by growing *many* components at once. In
 * each round, every component independently picks its cheapest edge to a
 * vertex outside itself, and all those edges are added to the forest at once
 * (components merge). The number of components at least halves each round, so
 * only O(log V) rounds are needed. It is the oldest MST algorithm and is
 * naturally parallel.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log V) – O(log V) rounds, each scanning all E edges
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The edge being scanned in a round is YELLOW (comparing).
 *   - Edges chosen for the MST are GREEN (sorted).
 *   - Components are hinted by node color.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Parallel-friendly: each component's choice is independent.
 *   - The "merge many components at once" idea is unique among MST
 *     algorithms and worth contrasting with Kruskal/Prim.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "../graph/graph-util";

/**
 * A tiny union-find (disjoint set) used for component tracking.
 */
class UnionFind {
    private parent = new Map<string, string>();

    find(x: string): string {
        if (this.parent.get(x) === undefined) {
            this.parent.set(x, x);
        }
        const root = this.parent.get(x) as string;
        if (root !== x) {
            this.parent.set(x, this.find(root));
        }
        return this.parent.get(x) as string;
    }

    union(a: string, b: string): boolean {
        const ra = this.find(a);
        const rb = this.find(b);
        if (ra === rb) {
            return false;
        }
        this.parent.set(ra, rb);
        return true;
    }
}

/**
 * The Borůvka MST generator.
 *
 * @param input `{ edges, vertices }` – an undirected weighted edge list.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { edges?: Array<[string, string, number]>; vertices?: string[] } | null) ?? {};
    const vertices = task.vertices ?? ["A", "B", "C", "D", "E", "F"];
    const edgeList: Array<[string, string, number]> = task.edges ?? [
        ["A", "B", 4],
        ["A", "C", 2],
        ["B", "C", 1],
        ["B", "D", 5],
        ["C", "D", 8],
        ["C", "E", 10],
        ["D", "E", 2],
        ["D", "F", 6],
        ["E", "F", 3],
    ];

    const nodes = makeGraphNodes(vertices);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const edges: VisualEdge[] = edgeList.map(([a, b, weight], index) => ({
        id: `edge-${index}`,
        sourceId: `node-${a}`,
        targetId: `node-${b}`,
        label: String(weight),
        state: "idle",
        directed: false,
    }));

    let step = 0;
    let rounds = 0;
    const uf = new UnionFind();
    const chosen = new Set<number>();

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Borůvka's algorithm on ${vertices.length} vertices, ${edgeList.length} edges – every component picks its cheapest edge each round.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { rounds: 0, chosen: 0, accepted: 0, totalWeight: 0 },
    };
    step += 1;

    // Count distinct components by counting union-find roots.
    const componentCount = (): number => {
        const roots = new Set<string>();
        for (const v of vertices) {
            roots.add(uf.find(v));
        }
        return roots.size;
    };

    // Repeat until only one component (the MST) remains.
    while (componentCount() > 1) {
        rounds += 1;

        // Reset all edge states to idle before the new round.
        for (const edge of edges) {
            edge.state = "idle";
        }

        // Each component picks its cheapest outgoing edge.
        const cheapest = new Map<string, { index: number; weight: number }>();

        for (let i = 0; i < edgeList.length; i += 1) {
            const [a, b, weight] = edgeList[i] ?? [];
            if (!a || !b) {
                continue;
            }

            const edge = edges[i];
            if (edge) {
                edge.state = "comparing";
            }
            yield {
                stepNumber: step,
                entities: nodes.map((n) => ({ ...n })),
                edges: edges.map((e) => ({ ...e })),
                description: `Round ${rounds}: scanning edge ${a}–${b} (weight ${weight}).`,
                codeLineNumber: 2,
                layout: "graph",
                meta: {
                    rounds,
                    chosen: chosen.size,
                    accepted: chosen.size,
                    totalWeight: [...chosen].reduce((s, i) => s + (edgeList[i]?.[2] ?? 0), 0),
                },
            };
            step += 1;

            const ra = uf.find(a);
            const rb = uf.find(b);
            if (ra === rb) {
                // Same component – this edge cannot be a bridge to outside.
                continue;
            }

            // Record the cheapest edge for each of the two components.
            const existingA = cheapest.get(ra);
            if (!existingA || weight < existingA.weight) {
                cheapest.set(ra, { index: i, weight });
            }
            const existingB = cheapest.get(rb);
            if (!existingB || weight < existingB.weight) {
                cheapest.set(rb, { index: i, weight });
            }
        }

        // Merge components along every chosen edge.
        for (const { index } of cheapest.values()) {
            const [a, b] = edgeList[index] ?? [];
            if (!a || !b) {
                continue;
            }
            if (uf.union(a, b)) {
                chosen.add(index);
                const edge = edges[index];
                if (edge) {
                    edge.state = "sorted";
                }
            }
        }

        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Round ${rounds} complete – added ${[...cheapest.values()].map(({ index }) => `${edgeList[index]?.[0]}–${edgeList[index]?.[1]}(${edgeList[index]?.[2]})`).join(", ")}; ${chosen.size} edges chosen.`,
            codeLineNumber: 4,
            layout: "graph",
            meta: {
                rounds,
                chosen: chosen.size,
                accepted: chosen.size,
                totalWeight: [...chosen].reduce((s, i) => s + (edgeList[i]?.[2] ?? 0), 0),
            },
        };
        step += 1;
    }

    const totalWeight = [...chosen].reduce((sum, i) => sum + (edgeList[i]?.[2] ?? 0), 0);

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Minimum spanning tree complete – ${chosen.size} edges, total weight ${totalWeight} (${[...chosen].map((i) => `${edgeList[i]?.[0]}–${edgeList[i]?.[1]}(${edgeList[i]?.[2]})`).join(", ")}), in ${rounds} round(s).`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { rounds, chosen: chosen.size, accepted: chosen.size, totalWeight },
    };
}

/** The Borůvka module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Boruvka builds a minimum spanning tree by growing many components at once. In each round every component independently picks its cheapest outgoing edge to a different component, and all chosen edges are added together. Because every component merges with at least one other, the number of components at least halves, so only O(log V) rounds are needed.",
        "invariants": [
            "Chosen edges never create a cycle because they join distinct components.",
            "Every component's chosen edge is the cheapest edge leaving it in that round.",
            "The number of components at least halves after each round."
        ],
        "correctness": "For any component, the cheapest edge leaving it is safe: there exists a minimum spanning tree containing it by the cut property, since it is a lightest edge across the cut defined by that component. Adding all such safe edges preserves membership in some MST, and when one component remains the accumulated edges form a minimum spanning tree.",
        "complexityRationale": "Each of the O(log V) rounds scans all E edges once, giving O(E log V) time with union-find; component labels and chosen edges use O(V + E) space.",
        "uses": [
            "Minimum spanning tree construction with natural parallelism",
            "A first phase of the Karger-Klein-Tarjan randomized MST algorithm",
            "Distributed MST computation on partitioned graphs"
        ],
        "references": [
            "Boruvka, O jistem problemu minimalnim (1926)",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, minimum spanning trees"
        ],
        "workedExample": "On the sample graph, each singleton first picks its cheapest incident edge, such as A picking A-C of weight 2 and B picking B-C of weight 1. Adding all picks merges components; later rounds connect the survivors. The process ends with one spanning tree of minimum total weight."
    },
    id: "boruvka",
    name: "Borůvka's MST",
    category: "mst",
    complexity: { time: "O(E log V)", space: "O(V + E)" },
    // Same graph as the other MST algorithms for comparison.
    defaultInput: {
        edges: [
            ["A", "B", 4],
            ["A", "C", 2],
            ["B", "C", 1],
            ["B", "D", 5],
            ["C", "D", 8],
            ["C", "E", 10],
            ["D", "E", 2],
            ["D", "F", 6],
            ["E", "F", 3],
        ],
        vertices: ["A", "B", "C", "D", "E", "F"],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start with every vertex as its own component",
        "for each component find its cheapest outgoing edge",
        "scan every edge u–v connecting different components",
        "record the cheapest outgoing edge per component",
        "add all chosen edges at once and merge components",
        "done: chosen edges form the MST with minimum total weight",
    ],
};

export default module;
