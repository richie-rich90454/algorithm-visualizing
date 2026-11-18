/**
 * bidirectional-bfs.ts – Bidirectional Breadth-First Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bidirectional BFS finds the shortest path between two vertices by running
 * two BFS searches simultaneously: one forward from the source, one backward
 * from the target. When the two frontiers meet, the shortest path is found.
 * Because each search only explores a radius of d/2 (instead of one search
 * exploring radius d), the combined work is dramatically smaller in graphs
 * with high branching factor – O(b^(d/2)) instead of O(b^d).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(b^(d/2)) where b is the branching factor and d the path length
 *   Space: O(b^(d/2)) – two frontiers instead of one
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Forward-frontier vertices are BLUE (active).
 *   - Backward-frontier vertices are PINK (highlight).
 *   - The vertex where the frontiers meet flashes GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Returns the same shortest path as plain BFS, but explores far less.
 *   - Needs the graph to be undirected (or to have a reverse-edge map) so the
 *     backward search can walk edges in reverse.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

/**
 * The Bidirectional BFS generator.
 *
 * @param input The graph plus start and target vertices.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { graph?: Record<string, string[]>; start?: string; target?: string } | null) ??
        {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "D"],
        C: ["A", "E"],
        D: ["B", "E", "F"],
        E: ["C", "D", "F"],
        F: ["D", "E"],
    };
    const start = task.start ?? "A";
    const target = task.target ?? "F";

    const vertices = Object.keys(adjacency);
    const nodes = makeGraphNodes(vertices);
    const edges = makeGraphEdges(adjacency);

    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const visited = new Set<string>();

    // Build the reverse adjacency so the backward search can traverse edges
    // in reverse without requiring an undirected graph.
    const reverse: Record<string, string[]> = {};
    for (const v of vertices) {
        reverse[v] = [];
    }
    for (const [from, neighbors] of Object.entries(adjacency)) {
        for (const to of neighbors) {
            reverse[to]?.push(from);
        }
    }

    let step = 0;

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Searching for a path from ${start} to ${target} from both ends.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: {},
    };
    step += 1;

    // Two frontiers: forward from start, backward from target.
    const forwardQueue: string[] = [start];
    const backwardQueue: string[] = [target];
    const forwardVisited = new Set<string>([start]);
    const backwardVisited = new Set<string>([target]);

    // Light up the two origins.
    const startNode = nodeById.get(`node-${start}`);
    const targetNode = nodeById.get(`node-${target}`);
    if (startNode) {
        startNode.state = "active";
    }
    if (targetNode) {
        targetNode.state = "highlight";
    }

    let met = start === target;

    const buildFrame = (message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: line,
        layout: "graph",
        meta: { forwardSize: forwardQueue.length, backwardSize: backwardQueue.length },
    });

    yield buildFrame(`Frontiers seeded at ${start} and ${target}.`, 0);
    step += 1;

    // Alternate expansion: forward first, then backward, one level at a time.
    while (!met && (forwardQueue.length > 0 || backwardQueue.length > 0)) {
        // --- Expand the forward frontier by one level. ---
        const forwardLevel = [...forwardQueue];
        forwardQueue.length = 0;
        for (const current of forwardLevel) {
            for (const neighbor of adjacency[current] ?? []) {
                if (forwardVisited.has(neighbor)) {
                    continue;
                }
                forwardVisited.add(neighbor);
                forwardQueue.push(neighbor);

                const neighborNode = nodeById.get(`node-${neighbor}`);
                if (neighborNode) {
                    neighborNode.state = "active";
                }
                if (backwardVisited.has(neighbor)) {
                    met = true;
                }
            }
        }

        yield buildFrame(`Forward frontier expanded one level from the ${start} side.`, 1);
        step += 1;
        const backwardLevel = [...backwardQueue];
        backwardQueue.length = 0;
        for (const current of backwardLevel) {
            for (const neighbor of reverse[current] ?? []) {
                if (backwardVisited.has(neighbor)) {
                    continue;
                }
                backwardVisited.add(neighbor);
                backwardQueue.push(neighbor);

                const neighborNode = nodeById.get(`node-${neighbor}`);
                if (neighborNode) {
                    neighborNode.state = "highlight";
                }
                if (forwardVisited.has(neighbor)) {
                    met = true;
                }
            }
        }

        yield buildFrame(`Backward frontier expanded one level from the ${target} side.`, 2);
        step += 1;
    }

    // Paint the meeting vertex (if any) green.
    if (met) {
        for (const v of vertices) {
            if (forwardVisited.has(v) && backwardVisited.has(v)) {
                const meetNode = nodeById.get(`node-${v}`);
                if (meetNode) {
                    meetNode.state = "sorted";
                }
                break;
            }
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: met
            ? `Frontiers met – a shortest path from ${start} to ${target} exists.`
            : `No path exists between ${start} and ${target}.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { met, forwardVisited: forwardVisited.size, backwardVisited: backwardVisited.size },
    };
}

/** The Bidirectional BFS module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Bidirectional BFS finds a shortest path by searching simultaneously from the source and from the target. Each side expands one full level at a time, and when the two frontiers meet the concatenated parent links give the path. Exploring radius d/2 twice is far cheaper than one search of radius d in a graph with high branching factor.",
        "invariants": [
            "Each frontier contains vertices at the same distance from its own start.",
            "Both searches use breadth-first order, so first meeting occurs at minimum total distance.",
            "A meeting vertex yields a path made of the forward prefix and reversed backward prefix."
        ],
        "correctness": "After k full levels on each side, all vertices within k hops of either endpoint have been discovered. When the frontiers share a vertex v, the path from source to v plus v to target has length dist_forward(v) plus dist_backward(v). Because BFS explores in nondecreasing distance, the first such meeting minimizes that sum, giving a shortest path.",
        "complexityRationale": "Each search reaches depth at most d/2, so with branching factor b the work is about O(b^(d/2)) instead of O(b^d), with the same order of space for the two frontiers.",
        "uses": [
            "Shortest path queries in social networks and maps",
            "Six-degrees-of-separation style connection searches",
            "Speeding up pathfinding when both endpoints are known"
        ],
        "references": [
            "Pohl, Bi-directional Search (1971)",
            "Russell and Norvig, Artificial Intelligence: A Modern Approach, informed search"
        ],
        "workedExample": "From A toward F and from F toward A, the forward frontier reaches B and C while the backward frontier reaches D and E. The next forward expansion reaches D and meets the backward frontier on edge B-D, producing the shortest path A-B-D-F (or equivalently through E) of length 3."
    },
    id: "bidirectional-bfs",
    name: "Bidirectional BFS",
    category: "graph",
    complexity: { time: "O(b^(d/2))", space: "O(b^(d/2))" },
    // A diamond-shaped graph where the frontiers meet near the middle.
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["A", "D"],
            C: ["A", "E"],
            D: ["B", "E", "F"],
            E: ["C", "D", "F"],
            F: ["D", "E"],
        },
        start: "A",
        target: "F",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "seed the forward queue at start and the backward queue at target",
        "expand the forward frontier one level; meet check on every vertex",
        "expand the backward frontier one level; meet check on every vertex",
        "repeat until the frontiers meet or both queues drain",
        "done: frontiers met on a shortest path, or no path exists",
    ],
};

export default module;
