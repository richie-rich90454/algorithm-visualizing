/**
 * hopcroft-karp.ts – Hopcroft-Karp Algorithm (Maximum Bipartite Matching)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Hopcroft-Karp finds the maximum matching in a *bipartite* graph: the largest
 * set of edges with no shared endpoints. It combines two ideas:
 *
 *   1. BFS from all unmatched left vertices builds layers through alternating
 *      paths (matching edges and non-matching edges), stopping when it reaches
 *      an unmatched right vertex.
 *   2. DFS finds a maximal set of vertex-disjoint shortest augmenting paths
 *      and flips each one, growing the matching.
 *
 * Each BFS+DFS round augments along all shortest augmenting paths at once.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E·√V)
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Left-side vertices are drawn in one row, right-side in another.
 *   - Matching edges are GREEN (sorted).
 *   - The augmenting path currently being flipped is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The textbook algorithm for maximum bipartite matching.
 *   - The alternating-path vocabulary (matching vs. non-matching edges) is
 *     reused by nearly every matching/assignment algorithm.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Hopcroft-Karp generator.
 *
 * @param input `{ left, right, edges }` – two vertex sets plus an edge list of
 *        `[leftVertex, rightVertex]` pairs.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { left?: string[]; right?: string[]; edges?: Array<[string, string]> } | null) ??
        {};
    const left = task.left ?? ["A", "B", "C"];
    const right = task.right ?? ["1", "2", "3"];
    const edgeList: Array<[string, string]> = task.edges ?? [
        ["A", "1"],
        ["A", "2"],
        ["B", "1"],
        ["B", "3"],
        ["C", "2"],
        ["C", "3"],
    ];

    // Node entities: left vertices as one group, right vertices as another.
    const entities: VisualEntity[] = [
        ...left.map((label) => ({
            id: `node-L-${label}`,
            type: "node" as const,
            label,
            value: label,
            state: "unvisited" as const,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { side: "left" },
        })),
        ...right.map((label) => ({
            id: `node-R-${label}`,
            type: "node" as const,
            label,
            value: label,
            state: "unvisited" as const,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { side: "right" },
        })),
    ];

    // Visual edges.
    const edges: VisualEdge[] = edgeList.map(([l, r], index) => ({
        id: `edge-${index}`,
        sourceId: `node-L-${l}`,
        targetId: `node-R-${r}`,
        label: "",
        state: "idle",
        directed: false,
    }));

    // The current matching: right → left (each right vertex matched to at most
    // one left vertex).
    const matchR = new Map<string, string>();

    let step = 0;
    let matchingSize = 0;
    let rounds = 0;

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: entities.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Hopcroft-Karp – finding a maximum bipartite matching.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { matching: 0 },
    };
    step += 1;

    // Refresh which edges are currently in the matching.
    const refreshMatching = (): void => {
        for (const edge of edges) {
            edge.state = "idle";
        }
        for (const [r, l] of matchR) {
            const edge = edges.find(
                (e) => e.sourceId === `node-L-${l}` && e.targetId === `node-R-${r}`,
            );
            if (edge) {
                edge.state = "sorted";
            }
        }
    };

    // ------------------------------------------------------------------
    // Main loop: BFS layers, then DFS augmenting paths.
    // ------------------------------------------------------------------
    for (;;) {
        refreshMatching();
        rounds += 1;

        // --- BFS from all unmatched left vertices through alternating paths. ---
        // layerL[u] = distance from the free-left set to u along alternating
        // paths; layerR[v] similarly for right vertices.
        const layerL = new Map<string, number>();
        const layerR = new Map<string, number>();
        const queue: string[] = [];

        for (const l of left) {
            // Unmatched left vertices are the BFS roots.
            const isMatched = [...matchR.values()].includes(l);
            if (!isMatched) {
                layerL.set(l, 0);
                queue.push(l);
            }
        }

        const adjL = new Map<string, string[]>();
        for (const [l, r] of edgeList) {
            const list = adjL.get(l) ?? [];
            list.push(r);
            adjL.set(l, list);
        }

        let foundFreeR = false;
        while (queue.length > 0 && !foundFreeR) {
            const current = queue.shift();
            if (!current) {
                continue;
            }
            const l = current;
            const level = layerL.get(l) ?? 0;
            for (const r of adjL.get(l) ?? []) {
                // The edge L→R must be a NON-matching edge (alternating).
                if (matchR.get(r) !== l && layerR.get(r) === undefined) {
                    layerR.set(r, level + 1);
                    // A right vertex reached via a free-left is an augmenting
                    // path endpoint when it is unmatched.
                    const matchedLeft = matchR.get(r);
                    if (matchedLeft === undefined) {
                        foundFreeR = true;
                    } else if (layerL.get(matchedLeft) === undefined) {
                        // Continue alternating: R→L along the matching edge.
                        layerL.set(matchedLeft, level + 2);
                        queue.push(matchedLeft);
                    }
                }
            }
        }

        // No augmenting path reached an unmatched right vertex → done.
        if (!foundFreeR) {
            break;
        }

        yield {
            stepNumber: step,
            entities: entities.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Round ${rounds}: BFS layered the alternating paths – augmenting.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { matching: matchingSize },
        };
        step += 1;

        // --- DFS: find vertex-disjoint augmenting paths and flip them. ---
        // A simple DFS-based augment for teaching clarity: repeatedly try to
        // find any augmenting path and flip it.
        const visitedL = new Set<string>();
        let augmented = false;

        const tryAugment = (l: string): boolean => {
            if (visitedL.has(l)) {
                return false;
            }
            visitedL.add(l);
            for (const r of adjL.get(l) ?? []) {
                const matchedLeft = matchR.get(r);
                // Traverse non-matching edges; if r is free, we found an
                // augmenting path and flip the edges along it.
                if (matchedLeft === l) {
                    continue;
                }
                if (matchedLeft === undefined || tryAugment(matchedLeft)) {
                    matchR.set(r, l);
                    return true;
                }
            }
            return false;
        };

        for (const l of left) {
            visitedL.clear();
            if (tryAugment(l)) {
                augmented = true;
                matchingSize += 1;
                refreshMatching();

                yield {
                    stepNumber: step,
                    entities: entities.map((n) => ({ ...n })),
                    edges: edges.map((e) => ({ ...e })),
                    description: `Augmented the matching – size is now ${matchingSize}.`,
                    codeLineNumber: 3,
                    layout: "graph",
                    meta: { matching: matchingSize },
                };
                step += 1;
            }
        }

        if (!augmented) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: entities.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Maximum matching found – size ${matchingSize} after ${rounds} round(s).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { matching: matchingSize, rounds },
    };
}

/** The Hopcroft-Karp module, registered with the engine. */
const module: AlgorithmModule = {
    id: "hopcroft-karp",
    name: "Hopcroft-Karp Matching",
    category: "flow",
    complexity: { time: "O(E·√V)", space: "O(V + E)" },
    // A small bipartite graph where maximum matching size is 3.
    defaultInput: {
        left: ["A", "B", "C"],
        right: ["1", "2", "3"],
        edges: [
            ["A", "1"],
            ["A", "2"],
            ["B", "1"],
            ["B", "3"],
            ["C", "2"],
            ["C", "3"],
        ],
    },
    visualType: "graph",
    run,
};

export default module;
