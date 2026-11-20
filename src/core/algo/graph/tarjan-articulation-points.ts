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

    const buildFrame = (message: string, line = 2): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: line,
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
        yield buildFrame(`Visiting ${v} (index ${index.get(v)}).`, 1);
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
                        3,
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
            yield buildFrame(
                `Root ${v} is an articulation point with ${childCount} DFS children.`,
                3,
            );
            step += 1;
        }

        if (!articulation.has(v) && node) {
            node.state = "visited";
        }
        yield buildFrame(`Finished subtree of ${v}.`, 4);
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
        codeLineNumber: 5,
        layout: "graph",
        meta: { articulationPoints: articulation.size },
    };
}

/** The Tarjan Articulation Points module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "An articulation point is a vertex whose removal increases the number of connected components. Tarjan's one-pass DFS uses discovery times and lowlink values. A non-root vertex is critical when a child cannot reach above it, and the root is critical when it has more than one DFS child.",
        "invariants": [
            "low[v] is the oldest vertex reachable from v's subtree through a back edge.",
            "A root with at least two DFS children splits the graph when removed.",
            "A non-root v is an articulation point exactly when some child has low at least disc[v]."
        ],
        "correctness": "If a child's lowlink is at least the parent's discovery time, the child's subtree has no back edge above the parent, so removing the parent detaches it. The root case differs because separate child subtrees have no back edges between them, so two children already imply disconnection. These conditions are necessary and sufficient, so the reported set is exact.",
        "complexityRationale": "One DFS examines each edge once, O(V + E) time, with O(V) space for discovery, lowlink, and parent bookkeeping.",
        "uses": [
            "Finding critical vertices in communication and transport networks",
            "Reliability analysis and network hardening",
            "A companion to biconnected component decomposition"
        ],
        "references": [
            "Tarjan, Depth-First Search and Linear Graph Algorithms (1972)",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, depth-first search"
        ],
        "workedExample": "In the graph with a central cluster around B and D, DFS shows that removing B separates the A-C side from the rest, and removing D separates the E-F-G side. Both have a child whose lowlink reaches only to themselves, so B and D are articulation points."
    },
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
    pseudocode: [
        "set up discovery index and lowlink for every vertex",
        "visit v: stamp index and lowlink, then explore neighbors",
        "recurse on tree edges and pull each child's lowlink upward",
        "lowlink[child] ≥ index[v] (or a multi-child root): v is critical",
        "finish each subtree and repeat from every unvisited vertex",
        "done: all articulation points such as B and D",
    ],
};

export default module;
