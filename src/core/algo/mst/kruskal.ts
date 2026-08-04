/**
 * kruskal.ts – Kruskal's Algorithm (Minimum Spanning Tree)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A minimum spanning tree (MST) is a subset of edges that connects every
 * vertex of an undirected, weighted graph with the smallest possible total
 * weight, forming a tree. Kruskal's algorithm is delightfully greedy:
 *
 *   1. Sort all edges by weight.
 *   2. Walk the sorted edges; add an edge to the tree if it does not create a
 *      cycle (checked with a disjoint-set / union-find structure).
 *
 * After processing all edges, the chosen ones form the MST.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log E) – dominated by the initial sort (union-find is ~O(1))
 *   Space: O(V) for the disjoint-set structure
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The edge being considered is YELLOW (comparing).
 *   - An edge accepted into the MST is GREEN (sorted).
 *   - An edge rejected (would create a cycle) flashes RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The classic example of a greedy algorithm with a proof of optimality.
 *   - Edge-centric: works especially well for sparse graphs.
 *   - Requires union-find for efficient cycle detection.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "../graph/graph-util";

/**
 * A tiny union-find (disjoint set) used for cycle detection.
 */
class UnionFind {
    private parent = new Map<string, string>();

    find(x: string): string {
        // Path compression: flatten the chain on the way up.
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
            return false; // already connected → union would create a cycle
        }
        this.parent.set(ra, rb);
        return true;
    }
}

/**
 * Build the node entities for the graph.
 *
 * @param vertices The vertex labels, in order.
 * @returns Node entities with placeholder positions.
 */
function makeNodes(vertices: string[]): VisualEntity[] {
    return vertices.map((label) => ({
        id: `node-${label}`,
        type: "node" as const,
        label,
        value: label,
        state: "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label },
    }));
}

/**
 * The Kruskal MST generator.
 *
 * @param input `{ edges, vertices }` – an undirected weighted edge list plus
 *        the vertex labels.
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

    const nodes = makeNodes(vertices);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Build the visual edge entities (undirected).
    const edges: VisualEdge[] = edgeList.map(([a, b, weight], index) => ({
        id: `edge-${index}`,
        sourceId: `node-${a}`,
        targetId: `node-${b}`,
        label: String(weight),
        state: "idle",
        directed: false,
    }));

    let step = 0;
    const accepted: number[] = [];

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Kruskal's algorithm – considering edges from lightest to heaviest.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { accepted: 0 },
    };
    step += 1;

    // Sort the edge indices by weight.
    const order = edgeList.map((_, i) => i).sort((a, b) => edgeList[a]?.[2]! - edgeList[b]?.[2]!);
    const uf = new UnionFind();

    for (const index of order) {
        const [a, b] = edgeList[index] ?? [];
        if (!a || !b) {
            continue;
        }
        const edge = edges[index];
        if (!edge) {
            continue;
        }

        // Mark the edge under consideration.
        edge.state = "comparing";
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Considering edge ${a}–${b} (weight ${edgeList[index]?.[2]}).`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { accepted: accepted.length },
        };
        step += 1;

        // Accept the edge if it does not create a cycle.
        if (uf.union(a, b)) {
            edge.state = "sorted";
            accepted.push(index);
        } else {
            edge.state = "swapped";
            yield {
                stepNumber: step,
                entities: nodes.map((n) => ({ ...n })),
                edges: edges.map((e) => ({ ...e })),
                description: `Rejected ${a}–${b} – it would create a cycle.`,
                codeLineNumber: 3,
                layout: "graph",
                meta: { accepted: accepted.length },
            };
            step += 1;
        }
    }

    // Total weight of the MST.
    const totalWeight = accepted.reduce((sum, i) => sum + (edgeList[i]?.[2] ?? 0), 0);

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Minimum spanning tree complete – ${accepted.length} edges, total weight ${totalWeight}.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { accepted: accepted.length, totalWeight },
    };
}

/** The Kruskal module, registered with the engine. */
const module: AlgorithmModule = {
    id: "kruskal",
    name: "Kruskal's MST",
    category: "mst",
    complexity: { time: "O(E log E)", space: "O(V)" },
    // An undirected weighted graph with a clear minimum tree.
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
};

export default module;
