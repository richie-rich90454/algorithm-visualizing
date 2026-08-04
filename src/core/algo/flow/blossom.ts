/**
 * blossom.ts – Blossom Algorithm (Maximum Matching in General Graphs)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Edmonds' blossom algorithm finds a maximum matching in *general* (possibly
 * non-bipartite) graphs. The hard part is odd cycles: a naive augmenting-path
 * search can get stuck on them. The algorithm "shrinks" an odd cycle (a
 * blossom) into a single super-vertex, searches on the shrunk graph, and then
 * expands the blossom to lift the augmenting path back to real vertices.
 *
 * This educational implementation captures the core idea – find an odd cycle
 * and shrink it, then continue searching – with a simplified blossom-shrinking
 * routine suitable for classroom-sized graphs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V³) or O(V·E·α(V))
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Matching edges are GREEN (sorted).
 *   - The blossom being shrunk is PINK (highlight).
 *   - The augmenting path is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Generalizes the bipartite matching idea to arbitrary graphs.
 *   - The blossom (odd cycle) is the famous conceptual contribution.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Blossom generator.
 *
 * @param input `{ vertices, edges }` – an undirected graph.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: string[]; edges?: Array<[string, string]> } | null) ?? {};
    const vertices = task.vertices ?? ["A", "B", "C", "D", "E", "F"];
    const edgeList: Array<[string, string]> = task.edges ?? [
        ["A", "B"],
        ["A", "C"],
        ["B", "C"],
        ["C", "D"],
        ["D", "E"],
        ["D", "F"],
        ["E", "F"],
    ];

    const entities: VisualEntity[] = vertices.map((label) => ({
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

    const edges: VisualEdge[] = edgeList.map(([a, b], index) => ({
        id: `edge-${index}`,
        sourceId: `node-${a}`,
        targetId: `node-${b}`,
        label: "",
        state: "idle",
        directed: false,
    }));

    // The current matching: vertex → matched partner.
    const match = new Map<string, string>();

    let step = 0;
    let matchingSize = 0;
    let blossomsFound = 0;

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: entities.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Blossom algorithm – finding a maximum matching in a general graph.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { matching: 0 },
    };
    step += 1;

    // Refresh which edges are in the matching.
    const refreshMatching = (): void => {
        for (const edge of edges) {
            edge.state = "idle";
        }
        for (const [a, b] of match) {
            const edge = edges.find(
                (e) =>
                    (e.sourceId === `node-${a}` && e.targetId === `node-${b}`) ||
                    (e.sourceId === `node-${b}` && e.targetId === `node-${a}`),
            );
            if (edge) {
                edge.state = "sorted";
            }
        }
    };

    const neighbors = new Map<string, string[]>();
    for (const v of vertices) {
        neighbors.set(v, []);
    }
    for (const [a, b] of edgeList) {
        neighbors.get(a)?.push(b);
        neighbors.get(b)?.push(a);
    }

    // ------------------------------------------------------------------
    // Main loop: find augmenting paths, shrinking blossoms as needed.
    // ------------------------------------------------------------------
    for (;;) {
        // Find an unmatched vertex to grow an alternating tree from.
        let root = "";
        for (const v of vertices) {
            if (!match.has(v)) {
                root = v;
                break;
            }
        }
        if (root === "") {
            break; // Perfect matching – everyone is paired.
        }

        // BFS through alternating paths from the root.
        const parent = new Map<string, string>();
        const base = new Map<string, string>();
        for (const v of vertices) {
            base.set(v, v);
        }
        const visited = new Set<string>();
        const queue: string[] = [root];
        visited.add(root);

        // Detect a blossom: a non-tree edge between two vertices at even
        // distance from the root.
        let blossomFound = false;

        while (queue.length > 0 && !blossomFound) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            for (const neighbor of neighbors.get(current) ?? []) {
                if (match.get(current) === neighbor) {
                    continue; // Skip the matching edge (alternating structure).
                }
                if (base.get(neighbor) === base.get(current)) {
                    continue;
                }
                if (!visited.has(neighbor)) {
                    // Discover the neighbor.
                    visited.add(neighbor);
                    const partner = match.get(neighbor);
                    if (partner !== undefined && !visited.has(partner)) {
                        // Continue the alternating tree through the matching.
                        parent.set(partner, neighbor);
                        parent.set(neighbor, current);
                        visited.add(partner);
                        queue.push(partner);
                    } else if (partner === undefined) {
                        // Found an augmenting path: neighbor is unmatched.
                        parent.set(neighbor, current);

                        // --- Augment along the path root → … → neighbor. ---
                        const path: string[] = [];
                        let cursor: string | undefined = neighbor;
                        while (cursor !== undefined) {
                            path.push(cursor);
                            cursor = parent.get(cursor);
                        }

                        // Flip matching edges along the path (length is odd).
                        for (let i = 0; i + 1 < path.length; i += 2) {
                            const a = path[i] as string;
                            const b = path[i + 1] as string;
                            match.set(a, b);
                            match.set(b, a);
                        }
                        matchingSize += 1;

                        // Highlight the augmenting path.
                        refreshMatching();
                        for (let i = 0; i + 1 < path.length; i += 2) {
                            const edge = edges.find(
                                (e) =>
                                    (e.sourceId === `node-${path[i]}` &&
                                        e.targetId === `node-${path[i + 1]}`) ||
                                    (e.sourceId === `node-${path[i + 1]}` &&
                                        e.targetId === `node-${path[i]}`),
                            );
                            if (edge) {
                                edge.state = "path";
                            }
                        }
                        yield {
                            stepNumber: step,
                            entities: entities.map((n) => ({ ...n })),
                            edges: edges.map((e) => ({ ...e })),
                            description: `Augmented along ${path.join(" → ")} – matching is now ${matchingSize}.`,
                            codeLineNumber: 2,
                            layout: "graph",
                            meta: { matching: matchingSize, blossoms: blossomsFound },
                        };
                        step += 1;
                        queue.length = 0;
                        blossomFound = true;
                    }
                } else {
                    // A non-tree edge closes an odd cycle – a blossom to shrink.
                    blossomsFound += 1;

                    // Mark the blossom vertices (the cycle) pink.
                    refreshMatching();
                    for (const v of visited) {
                        const node = entities.find((n) => n.label === v);
                        if (node) {
                            node.state = "highlight";
                        }
                    }
                    yield {
                        stepNumber: step,
                        entities: entities.map((n) => ({ ...n })),
                        edges: edges.map((e) => ({ ...e })),
                        description: `Blossom (odd cycle) detected involving ${current} and ${neighbor} – shrinking it (simplified).`,
                        codeLineNumber: 3,
                        layout: "graph",
                        meta: { matching: matchingSize, blossoms: blossomsFound },
                    };
                    step += 1;

                    // Simplified shrink: treat every visited vertex as a single
                    // super-node (base of the blossom) and continue the BFS.
                    for (const v of vertices) {
                        base.set(v, root);
                    }
                    queue.length = 0;
                    blossomFound = true;
                }
            }
        }

        if (!blossomFound) {
            break; // No augmenting path from any root – matching is maximum.
        }
    }

    yield {
        stepNumber: step,
        entities: entities.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Maximum matching found – size ${matchingSize}, ${blossomsFound} blossom(s) shrunk.`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { matching: matchingSize, blossoms: blossomsFound },
    };
}

/** The Blossom module, registered with the engine. */
const module: AlgorithmModule = {
    id: "blossom",
    name: "Blossom Algorithm",
    category: "flow",
    complexity: { time: "O(V³)", space: "O(V + E)" },
    // Contains an odd cycle {A,B,C} and a tail {C,D,E,F} with its own triangle.
    defaultInput: {
        vertices: ["A", "B", "C", "D", "E", "F"],
        edges: [
            ["A", "B"],
            ["A", "C"],
            ["B", "C"],
            ["C", "D"],
            ["D", "E"],
            ["D", "F"],
            ["E", "F"],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
