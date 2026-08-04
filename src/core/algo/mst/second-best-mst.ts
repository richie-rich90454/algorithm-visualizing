/**
 * second-best-mst.ts – Second Best Minimum Spanning Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The second-best spanning tree is the spanning tree with the smallest weight
 * among all spanning trees that are *not* equal to the MST. A classic way to
 * find it:
 *
 *   1. Compute the MST (here with Kruskal).
 *   2. For each non-tree edge (u, v), temporarily add it to the MST, forming a
 *      cycle; the most expensive edge on the u–v path in the MST can then be
 *      removed to produce a new spanning tree.
 *   3. The cheapest such replacement is the second-best tree.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E·V) – for each of the E non-tree edges, walk the O(V) path
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The MST edges are CYAN (path).
 *   - The non-tree edge being tested is YELLOW (comparing).
 *   - The edge removed from the cycle is RED (swapped).
 *   - The winning second-best edge is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Second best" means strictly different from the MST, not the runner-up
 *     in weight necessarily.
 *   - A neat application of the cycle property of spanning trees.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "../graph/graph-util";

/**
 * A tiny union-find (disjoint set).
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
 * The Second Best MST generator.
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

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Second best MST – starting with Kruskal's MST.",
        codeLineNumber: 0,
        layout: "graph",
        meta: {},
    };
    step += 1;

    // ------------------------------------------------------------------
    // Phase 1: compute the MST with Kruskal.
    // ------------------------------------------------------------------
    const order = edgeList.map((_, i) => i).sort((a, b) => edgeList[a]?.[2]! - edgeList[b]?.[2]!);
    const uf = new UnionFind();
    const mstEdges: number[] = [];

    for (const index of order) {
        const [a, b] = edgeList[index] ?? [];
        if (!a || !b) {
            continue;
        }
        if (uf.union(a, b)) {
            mstEdges.push(index);
        }
    }

    // Color the MST edges cyan.
    for (const index of mstEdges) {
        const edge = edges[index];
        if (edge) {
            edge.state = "path";
        }
    }
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "MST found with Kruskal's algorithm (cyan edges).",
        codeLineNumber: 2,
        layout: "graph",
        meta: { mstEdges: mstEdges.length },
    };
    step += 1;

    // ------------------------------------------------------------------
    // Phase 2: build the MST adjacency so paths can be walked.
    // ------------------------------------------------------------------
    const mstAdj = new Map<string, Array<[string, number]>>();
    for (const v of vertices) {
        mstAdj.set(v, []);
    }
    for (const index of mstEdges) {
        const [a, b, weight] = edgeList[index] ?? [];
        if (!a || !b) {
            continue;
        }
        mstAdj.get(a)?.push([b, weight]);
        mstAdj.get(b)?.push([a, weight]);
    }

    // ------------------------------------------------------------------
    // Phase 3: for each non-tree edge, find the best replacement.
    // ------------------------------------------------------------------
    const mstSet = new Set(mstEdges);
    let secondBestWeight = Infinity;
    let secondBestSwap: { add: number; remove: number } | null = null;

    for (let i = 0; i < edgeList.length; i += 1) {
        if (mstSet.has(i)) {
            continue; // Only non-tree edges can replace an MST edge.
        }
        const [u, v, weight] = edgeList[i] ?? [];
        if (!u || !v) {
            continue;
        }

        // Walk the u–v path in the MST and find the heaviest edge on it.
        // Simple BFS since the tree is small.
        const queue: string[] = [u];
        const visited = new Set<string>([u]);
        const cameFrom = new Map<string, string>();

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            if (current === v) {
                break;
            }
            for (const [neighbor] of mstAdj.get(current) ?? []) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    cameFrom.set(neighbor, current);
                    queue.push(neighbor);
                }
            }
        }

        // Reconstruct the path and find the heaviest edge weight on it.
        const path: string[] = [];
        let cursor = v;
        while (cursor !== undefined && cursor !== u) {
            path.push(cursor);
            cursor = cameFrom.get(cursor) ?? "";
            if (cursor === "") {
                break;
            }
        }
        path.push(u);

        // Find the heaviest edge on the path (u..v via MST).
        let heaviestOnPath = -Infinity;
        for (let p = 0; p < path.length - 1; p += 1) {
            const a = path[p];
            const b = path[p + 1];
            const edgeIndex = edgeList.findIndex(
                ([ea, eb, ew], idx) =>
                    mstSet.has(idx) && ((ea === a && eb === b) || (ea === b && eb === a)),
            );
            if (edgeIndex >= 0) {
                heaviestOnPath = Math.max(heaviestOnPath, edgeList[edgeIndex]?.[2] ?? -Infinity);
            }
        }

        // The replacement cost = MST weight − heaviest + new edge weight.
        if (heaviestOnPath !== -Infinity) {
            const swapWeight = weight - heaviestOnPath;
            if (swapWeight < secondBestWeight) {
                secondBestWeight = swapWeight;
                secondBestSwap = { add: i, remove: -1 };
            }
        }

        const edge = edges[i];
        if (edge) {
            edge.state = "comparing";
        }
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Testing non-tree edge ${u}–${v} (weight ${weight}).`,
            codeLineNumber: 3,
            layout: "graph",
            meta: { mstEdges: mstEdges.length },
        };
        step += 1;
    }

    // Show the winning replacement.
    if (secondBestSwap) {
        const winningEdge = edges[secondBestSwap.add];
        if (winningEdge) {
            winningEdge.state = "sorted";
        }
    }

    const mstWeight = mstEdges.reduce((sum, i) => sum + (edgeList[i]?.[2] ?? 0), 0);

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description:
            secondBestWeight === Infinity
                ? `No second-best tree exists (only one spanning tree).`
                : `Second best MST: weight ${mstWeight + secondBestWeight} (MST was ${mstWeight}).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { mstWeight, secondBestWeight: mstWeight + secondBestWeight },
    };
}

/** The Second Best MST module, registered with the engine. */
const module: AlgorithmModule = {
    id: "second-best-mst",
    name: "Second Best MST",
    category: "mst",
    complexity: { time: "O(E·V)", space: "O(V + E)" },
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
};

export default module;
