/**
 * tarjan-bridges.ts – Tarjan's Bridge Detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A bridge (cut-edge) in an undirected graph is an edge whose removal splits
 * the graph into more connected components. Tarjan's bridge algorithm uses a
 * single DFS and the classic `lowlink` idea: an edge (v → w) is a bridge iff
 * no path from w back to v or an ancestor of v exists through w's subtree,
 * i.e. `lowlink[w] > index[v]`.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) – one DFS, treating each edge once
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The edge being examined is YELLOW (comparing).
 *   - A discovered bridge is highlighted RED (swapped).
 *   - Finished DFS subtrees are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Bridges mark the fragile connections in a network (single points of
 *     failure).
 *   - The same `index`/`lowlink` machinery extends to articulation points.
 *   - Requires careful handling of the parent edge so it is not treated as a
 *     back edge.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

/**
 * The Tarjan Bridges generator.
 *
 * @param input The undirected graph as an adjacency list.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    // The graph is undirected, so each edge appears in both directions.
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C", "D"],
        C: ["A", "B"],
        D: ["B", "E"],
        E: ["D"],
    };

    const vertices = Object.keys(adjacency);
    const nodes = makeGraphNodes(vertices);
    const edges = makeGraphEdges(adjacency);

    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const edgeById = new Map(edges.map((e) => [e.id, e]));

    let step = 0;
    let nextIndex = 0;
    const index = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const bridges: Array<[string, string]> = [];

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description:
            "Tarjan's bridge detection – finding edges whose removal disconnects the graph.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { bridges: 0 },
    };
    step += 1;

    const buildFrame = (message: string): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
        layout: "graph",
        meta: { bridges: bridges.length },
    });

    /**
     * Recursive DFS that detects bridges.
     *
     * @param v The vertex being explored.
     * @param parent The vertex we came from, or null at the root.
     */
    function* dfs(v: string, parent: string | null): Generator<VisualFrame, void, unknown> {
        index.set(v, nextIndex);
        lowlink.set(v, nextIndex);
        nextIndex += 1;

        const node = nodeById.get(`node-${v}`);
        if (node) {
            node.state = "comparing";
        }
        yield buildFrame(`Visiting ${v} (index ${index.get(v)}).`);
        step += 1;

        for (const edge of edges) {
            edge.state = "idle";
        }
        for (const neighbour of adjacency[v] ?? []) {
            // Skip the edge back to the parent – it is not a back edge.
            if (neighbour === parent) {
                continue;
            }

            const edge = edgeById.get(`edge-${v}-${neighbour}`);

            if (index.get(neighbour) === undefined) {
                // Tree edge: recurse and pull the child's lowlink upward.
                yield buildFrame(`Descending into ${neighbour}.`);
                step += 1;
                yield* dfs(neighbour, v);
                lowlink.set(v, Math.min(lowlink.get(v) ?? 0, lowlink.get(neighbour) ?? 0));

                // Bridge test: no back path from the child's subtree.
                if ((lowlink.get(neighbour) ?? 0) > (index.get(v) ?? 0)) {
                    bridges.push([v, neighbour]);
                    if (edge) {
                        edge.state = "swapped";
                    }
                    yield buildFrame(`BRIDGE: edge ${v}–${neighbour} disconnects the graph.`);
                    step += 1;
                }
            } else {
                // Back edge to an ancestor: raise the lowlink.
                lowlink.set(v, Math.min(lowlink.get(v) ?? 0, index.get(neighbour) ?? 0));
                if (edge) {
                    edge.state = "active";
                }
                yield buildFrame(`Back edge from ${v} to ancestor ${neighbour}.`);
                step += 1;
            }
        }

        if (node) {
            node.state = "visited";
        }
        yield buildFrame(`Finished subtree of ${v}.`);
        step += 1;
    }

    // The graph may be disconnected – run DFS from each unvisited vertex.
    for (const v of vertices) {
        if (index.get(v) === undefined) {
            yield* dfs(v, null);
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description:
            bridges.length === 0
                ? "No bridges – the graph is edge-biconnected."
                : `Found ${bridges.length} bridge(s): ${bridges.map(([a, b]) => `${a}–${b}`).join(", ")}.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { bridges: bridges.length },
    };
}

/** The Tarjan Bridges module, registered with the engine. */
const module: AlgorithmModule = {
    id: "tarjan-bridges",
    name: "Tarjan Bridges",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V)" },
    // Edge D–E is the sole bridge in this undirected graph.
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "C", "D"],
            C: ["A", "B"],
            D: ["B", "E"],
            E: ["D"],
        },
    },
    visualType: "graph",
    run,
};

export default module;
