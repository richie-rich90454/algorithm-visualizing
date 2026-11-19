/**
 * undirected-vertex-geography.ts - Undirected Vertex Geography
 *
 * A token starts at a vertex of an undirected graph. Players alternate moving
 * it across an edge to a vertex that has not been visited, and whoever cannot
 * move loses. Unlike the hard directed version, the undirected case has a
 * clean characterization: the first player wins exactly when the starting
 * vertex belongs to every maximum matching. We compute the two matching sizes
 * by exhaustive enumeration and replay an optimal line chosen by game-tree
 * search.
 *
 * Time:  O(2^m + 2^n) for m edges and n vertices in this demo; Space: O(2^n)
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Edge = [number, number];

function matchingSize(vertices: number[], edges: Edge[], banned: number): number {
    let best = 0;
    for (let mask = 0; mask < 2 ** edges.length; mask += 1) {
        const used = new Set<number>();
        let size = 0;
        let ok = true;
        for (let i = 0; i < edges.length; i += 1) {
            if ((mask & (1 << i)) === 0) continue;
            const [a, b] = edges[i]!;
            if (used.has(a) || used.has(b) || a === banned || b === banned) {
                ok = false;
                break;
            }
            used.add(a);
            used.add(b);
            size += 1;
        }
        if (ok && size > best) best = size;
    }
    return best;
}

function canWin(current: number, visited: Set<number>, adj: Map<number, number[]>): boolean {
    for (const next of adj.get(current) ?? []) {
        if (visited.has(next)) continue;
        const nextVisited = new Set(visited);
        nextVisited.add(next);
        if (!canWin(next, nextVisited, adj)) return true;
    }
    return false;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: number[]; edges?: Edge[]; start?: number } | null) ?? {};
    const vertices: number[] = task.vertices ?? [0, 1, 2, 3, 4, 5];
    const edges: Edge[] = task.edges ?? [
        [0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 5], [4, 5],
    ];
    const start = typeof task.start === "number" && vertices.includes(task.start) ? task.start : (vertices[0] ?? 0);

    const adj = new Map<number, number[]>();
    for (const v of vertices) adj.set(v, []);
    for (const [a, b] of edges) {
        adj.get(a)?.push(b);
        adj.get(b)?.push(a);
    }

    const maxAll = matchingSize(vertices, edges, -1);
    const maxWithoutStart = matchingSize(vertices, edges, start);
    const firstWins = maxAll > maxWithoutStart;

    let step = 0;
    const moves: number[] = [start];

    const frame = (message: string, line: number, current: number, visited: Set<number>): VisualFrame => {
        const entities: VisualEntity[] = vertices.map((v) => ({
            id: `v-${v}`,
            type: "node" as const,
            label: String(v),
            value: v,
            state: (v === current ? "active" : visited.has(v) ? "visited" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { vertex: v, visited: visited.has(v) },
        }));
        const graphEdges: VisualEdge[] = edges.map(([a, b], i) => ({
            id: `e-${i}`,
            sourceId: `v-${a}`,
            targetId: `v-${b}`,
            label: "",
            state: "idle" as EntityState,
            directed: false,
        }));
        return {
            stepNumber: step,
            entities,
            edges: graphEdges,
            description: message,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                winner: firstWins ? "first" : "second",
                moves: moves.slice(),
                maxMatching: maxAll,
                maxWithoutStart,
                start,
            },
        };
    };

    yield frame(`Undirected geography on ${vertices.length} vertices, start ${start}.`, 0, start, new Set([start]));
    step += 1;
    yield frame(
        `Maximum matching ${maxAll}; without start ${maxWithoutStart}; ${firstWins ? "first" : "second"} player wins.`,
        2,
        start,
        new Set([start]),
    );
    step += 1;

    let current = start;
    const visited = new Set<number>([start]);
    let turn = 0;
    while (true) {
        const options = (adj.get(current) ?? []).filter((v) => !visited.has(v));
        if (options.length === 0) break;
        let chosen = options[0]!;
        for (const candidate of options) {
            const nextVisited = new Set(visited);
            nextVisited.add(candidate);
            if (!canWin(candidate, nextVisited, adj)) {
                chosen = candidate;
                break;
            }
        }
        visited.add(chosen);
        moves.push(chosen);
        yield frame(
            `Move ${turn + 1}: player ${turn % 2 === 0 ? 1 : 2} moves ${current} to ${chosen}.`,
            5,
            chosen,
            visited,
        );
        step += 1;
        current = chosen;
        turn += 1;
    }

    yield frame(`Player ${turn % 2 === 0 ? 1 : 2} is stuck; ${firstWins ? "first" : "second"} player wins as predicted.`, 6, current, visited);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A token travels along unused edges and the player who cannot move loses. On an undirected graph the outcome depends only on matchings: pair up as many edges as possible with no shared endpoints. If the starting vertex is essential to every largest matching, the first player can always steal a matched edge and win; otherwise the second player follows the matching strategy and wins.",
        invariants: [
            "Visited vertices are never entered again during a play.",
            "A maximum matching uses disjoint edges and is unchanged by removing start only when start is not essential.",
            "The token always sits on a vertex incident to the move just made.",
        ],
        correctness:
            "Berge's theorem implies the second player wins from a vertex exactly when some maximum matching leaves that vertex unmatched. If removing the start does not shrink the maximum matching, such a matching exists, and the second player always replies along its matched edge. If the start is in every maximum matching, the first player moves along one of its matched edges and then adopts that reply strategy. Comparing the two matching sizes therefore decides the winner, and the replayed line follows winning replies chosen by exhaustive game-tree search.",
        complexityRationale:
            "This demonstration enumerates all edge subsets to find both matching sizes, O(2^m), and solves positions by memo-free game-tree search over visited sets, O(2^n). A production solver uses a blossom matching algorithm in O(n^3); the visualization keeps the exact but smaller search so the theorem is transparent.",
        uses: [
            "Solved positions in impartial combinatorial games",
            "Analyzing the classic Shannon switching game family",
            "Teaching the link between matchings and game strategy",
        ],
        references: [
            "Fraenkel, Scheinerman, and Ullman, Undirected Vertex Geography is in P, 1993",
            "Lovasz and Plummer, Matching Theory, 1986",
        ],
        workedExample:
            "On a path of three vertices starting at the middle, the single maximum matching covers the middle, and removing it leaves no edge, so the first player wins by moving to an end and stranding the opponent. On a four-cycle starting anywhere, a maximum matching of size two remains after removing the start, so the second player wins.",
    },
    id: "undirected-vertex-geography",
    name: "Undirected Vertex Geography",
    category: "game",
    complexity: { time: "O(2^m)", space: "O(2^n)" },
    defaultInput: {
        vertices: [0, 1, 2, 3, 4, 5],
        edges: [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 5], [4, 5]],
        start: 0,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the undirected adjacency lists of the graph",
        "find a maximum matching by enumerating edge sets",
        "find the maximum matching after removing start",
        "first player wins only when removing start shrinks it",
        "solve positions by game-tree search for a winning line",
        "replay the chosen moves across the graph",
        "done: report the winner and the played moves",
    ],
};

export default module;
