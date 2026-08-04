/**
 * tarjan-articulation-points.ts – Tarjan's Articulation Points
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An articulation point (cut-vertex) is a vertex whose removal increases the
 * number of connected components in an undirected graph. Tarjan's algorithm
 * finds all of them in one DFS using the same index/lowlink machinery as
 * bridge detection, with two rules:
 *
 *   - The root is an articulation point iff it has at least two DFS children.
 *   - Any other vertex v is an articulation point iff some DFS child w has
 *     `lowlink[w] >= index[v]` – meaning w's subtree cannot reach an ancestor
 *     of v without passing through v.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E)
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being explored is YELLOW (comparing).
 *   - An articulation point is highlighted RED (swapped).
 *   - Finished subtrees are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The vertex analog of a bridge.
 *   - Single points of failure in a network.
 *   - The `>=` (vs `>` for bridges) is the crucial difference to highlight.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

/**
 * The Tarjan Articulation Points generator.
 *
 * @param input The undirected graph as an adjacency list.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C", "D"],
        C: ["A", "B"],
        D: ["B", "E", "G"],
        E: ["D", "F"],
        F: ["E", "G"],
        G: ["D", "F"],
    };

    const vertices = Object.keys(adjacency);
    const nodes = makeGraphNodes(vertices);
    const edges = makeGraphEdges(adjacency);

    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    let step = 0;
    let nextIndex = 0;
    const index = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const articulation = new Set<string>();

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description:
            "Tarjan's articulation points – finding vertices whose removal disconnects the graph.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { articulationPoints: 0 },
    };
    step += 1;

    const buildFrame = (message: string): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
        layout: "graph",
        meta: { articulationPoints: articulation.size },
    });

    /**
     * Recursive DFS.
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

        let childCount = 0;

        for (const neighbor of adjacency[v] ?? []) {
            // Skip the edge back to the parent.
            if (neighbor === parent) {
                continue;
            }

            if (index.get(neighbor) === undefined) {
                // Tree edge: recurse, then update lowlink from the child.
                childCount += 1;
                yield* dfs(neighbor, v);
                lowlink.set(v, Math.min(lowlink.get(v) ?? 0, lowlink.get(neighbor) ?? 0));

                // Articulation test for non-root vertices.
                if (parent !== null && (lowlink.get(neighbor) ?? 0) >= (index.get(v) ?? 0)) {
                    articulation.add(v);
                    if (node) {
                        node.state = "swapped";
                    }
                    yield buildFrame(
                        `${v} is an articulation point (child ${neighbor} cannot reach above it).`,
                    );
                    step += 1;
                }
            } else {
                // Back edge to an ancestor: raise the lowlink.
                lowlink.set(v, Math.min(lowlink.get(v) ?? 0, index.get(neighbor) ?? 0));
            }
        }

        // Root rule: two or more DFS children make the root an articulation point.
        if (parent === null && childCount >= 2) {
            articulation.add(v);
            if (node) {
                node.state = "swapped";
            }
            yield buildFrame(`Root ${v} is an articulation point with ${childCount} DFS children.`);
            step += 1;
        }

        if (!articulation.has(v) && node) {
            node.state = "visited";
        }
        yield buildFrame(`Finished subtree of ${v}.`);
        step += 1;
    }

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
            articulation.size === 0
                ? "No articulation points – the graph is vertex-biconnected."
                : `Articulation points: {${[...articulation].join(", ")}}.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { articulationPoints: articulation.size },
    };
}

/** The Tarjan Articulation Points module, registered with the engine. */
const module: AlgorithmModule = {
    id: "tarjan-articulation-points",
    name: "Tarjan Articulation Points",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V)" },
    // Removing B disconnects {D,E,F,G} from {A,C}.
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "C", "D"],
            C: ["A", "B"],
            D: ["B", "E", "G"],
            E: ["D", "F"],
            F: ["E", "G"],
            G: ["D", "F"],
        },
    },
    visualType: "graph",
    run,
};

export default module;
