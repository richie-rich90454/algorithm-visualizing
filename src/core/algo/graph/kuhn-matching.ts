/**
 * kuhn-matching.ts - Kuhn's Augmenting-Path Maximum Bipartite Matching
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Kuhn's algorithm finds a maximum matching in a bipartite graph with a simple
 * depth-first augmenting-path search. Starting from each unmatched left vertex,
 * it follows alternating unmatched and matched edges. If it reaches a free
 * right vertex, flipping the path increases the matching by one; otherwise the
 * vertex cannot be matched in the current search. By Berge's theorem, once no
 * augmenting path exists the matching is maximum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V * E) for the plain DFS version on V vertices and E edges
 *   Space: O(V + E) for the adjacency lists, matching, and visited marks
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Left vertices and right vertices are drawn as two groups of nodes.
 *   - Matched edges are green; the edge under inspection is blue.
 *   - Each frame names the left vertex, right vertex, and augment result.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type EventType = "start" | "explore" | "augment" | "reject" | "attempt";

interface KuhnEvent {
    type: EventType;
    left: string;
    right: string;
    edgeIndex: number;
    pairs: string[];
}

export interface KuhnResult {
    matchingSize: number;
    matchedPairs: Array<[string, string]>;
    events: KuhnEvent[];
}

/** Run Kuhn's DFS and record every edge inspection for replay. */
export function kuhnMatching(
    left: string[],
    right: string[],
    edgeList: Array<[string, string]>,
): KuhnResult {
    const adj = new Map<string, Array<{ right: string; edgeIndex: number }>>();
    for (const l of left) {
        adj.set(l, []);
    }
    edgeList.forEach(([l, r], edgeIndex) => {
        const list = adj.get(l) ?? [];
        list.push({ right: r, edgeIndex });
        adj.set(l, list);
    });

    const matchR = new Map<string, string>();
    const events: KuhnEvent[] = [];
    const snapshot = (): string[] =>
        [...matchR.entries()].map(([r, l]) => `${l}-${r}`).sort();

    const tryAugment = (u: string, visited: Set<string>): boolean => {
        if (visited.has(u)) {
            return false;
        }
        visited.add(u);
        for (const { right: r, edgeIndex } of adj.get(u) ?? []) {
            const owner = matchR.get(r);
            if (owner === undefined) {
                events.push({ type: "explore", left: u, right: r, edgeIndex, pairs: snapshot() });
                matchR.set(r, u);
                events.push({ type: "augment", left: u, right: r, edgeIndex, pairs: snapshot() });
                return true;
            }
            events.push({ type: "explore", left: u, right: r, edgeIndex, pairs: snapshot() });
            if (!visited.has(owner) && tryAugment(owner, visited)) {
                matchR.set(r, u);
                events.push({ type: "augment", left: u, right: r, edgeIndex, pairs: snapshot() });
                return true;
            }
            events.push({ type: "reject", left: u, right: r, edgeIndex, pairs: snapshot() });
        }
        return false;
    };

    for (const l of left) {
        events.push({ type: "attempt", left: l, right: "", edgeIndex: -1, pairs: snapshot() });
        tryAugment(l, new Set<string>());
    }

    return {
        matchingSize: matchR.size,
        matchedPairs: [...matchR.entries()].map(([r, l]) => [l, r]),
        events,
    };
}

/** The Kuhn matching generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { left?: string[]; right?: string[]; edges?: Array<[string, string]> } | null) ??
        {};
    const left = Array.isArray(task.left) && task.left.length > 0 ? task.left : ["A", "B", "C", "D"];
    const right = Array.isArray(task.right) && task.right.length > 0 ? task.right : ["1", "2", "3", "4"];
    const edgeList: Array<[string, string]> = Array.isArray(task.edges)
        ? task.edges
        : [
              ["A", "1"], ["A", "2"], ["B", "1"], ["B", "3"],
              ["C", "2"], ["C", "4"], ["D", "3"], ["D", "4"],
          ];

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
    const edges: VisualEdge[] = edgeList.map(([l, r], index) => ({
        id: `edge-${index}`,
        sourceId: `node-L-${l}`,
        targetId: `node-R-${r}`,
        label: "",
        state: "idle" as const,
        directed: false,
    }));

    const result = kuhnMatching(left, right, edgeList);
    const makeEdges = (event: KuhnEvent): VisualEdge[] => {
        const pairs = new Set(event.pairs);
        return edges.map((edge, index) => ({
            ...edge,
            state: index === event.edgeIndex
                ? ("active" as const)
                : pairs.has(
                      `${edge.sourceId.replace(/^node-L-/, "")}-${edge.targetId.replace(/^node-R-/, "")}`,
                  )
                  ? ("sorted" as const)
                  : ("idle" as const),
        }));
    };

    yield {
        stepNumber: 0,
        entities: entities.map((node) => ({ ...node })),
        edges: edges.map((edge) => ({ ...edge })),
        description: `Starting Kuhn's augmenting-path search on ${left.length} left and ${right.length} right vertices with ${edgeList.length} edge(s).`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { matching: 0, left: left.length, right: right.length, edges: edgeList.length, pairs: [] as string[] },
    };

    let step = 1;
    for (const event of result.events) {
        const size = event.pairs.length;
        let description: string;
        let codeLine: number;
        if (event.type === "attempt") {
            description = `Attempting to augment from left vertex ${event.left}, which is not yet part of a matching path.`;
            codeLine = 1;
        } else if (event.type === "explore") {
            description = `Exploring edge ${event.left} to ${event.right}; the right vertex is${event.pairs.some((p) => p.endsWith(`-${event.right}`)) ? " already matched, so follow its owner" : " free and can be matched"}.`;
            codeLine = 2;
        } else if (event.type === "augment") {
            description = `Augmenting along ${event.left} to ${event.right}; the matching now has ${size} edge(s).`;
            codeLine = 3;
        } else {
            description = `Rejecting ${event.left} to ${event.right} because its owner has no alternative augmenting path.`;
            codeLine = 4;
        }
        yield {
            stepNumber: step,
            entities: entities.map((node) => ({ ...node })),
            edges: makeEdges(event),
            description,
            codeLineNumber: codeLine,
            layout: "graph",
            meta: {
                matching: size,
                left: left.length,
                right: right.length,
                edges: edgeList.length,
                pairs: event.pairs,
                leftVertex: event.left,
                rightVertex: event.right,
                event: event.type,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: entities.map((node) => ({ ...node, state: "sorted" as const })),
        edges: edges.map((edge) => {
            const pairs = new Set(result.matchedPairs.map(([l, r]) => `${l}-${r}`));
            return {
                ...edge,
                state: pairs.has(
                    `${edge.sourceId.replace(/^node-L-/, "")}-${edge.targetId.replace(/^node-R-/, "")}`,
                )
                    ? ("sorted" as const)
                    : ("idle" as const),
            };
        }),
        description: `No augmenting path remains; maximum matching has size ${result.matchingSize} covering ${result.matchedPairs.length} right vertex(es).`,
        codeLineNumber: 5,
        layout: "graph",
        meta: {
            matching: result.matchingSize,
            left: left.length,
            right: right.length,
            edges: edgeList.length,
            pairs: result.matchedPairs.map(([l, r]) => `${l}-${r}`).sort(),
            done: true,
        },
    };
}

/** The Kuhn matching module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Try to match each left vertex in turn. If its preferred right vertex is free, take it. If that vertex is already matched, ask the current owner to find a different partner by following an alternating path through unmatched and matched edges. If the owner can move, the original left vertex takes the freed vertex and the matching grows by one.",
        invariants: [
            "Every matched edge has one left and one right endpoint, and no vertex is matched twice.",
            "An augmenting path starts and ends at unmatched vertices and alternates unmatched and matched edges.",
            "Flipping an augmenting path increases the matching size by exactly one.",
        ],
        correctness:
            "The DFS explores every alternating path from the current left vertex, so it finds an augmenting path whenever one exists from that vertex. Flipping the path keeps the matching valid because each interior vertex swaps between two incident edges, while the two endpoints gain one edge each, increasing the size by one. Repeating over all left vertices eventually leaves no augmenting path, and by Berge's theorem a matching with no augmenting path is maximum.",
        complexityRationale:
            "Each of the V left vertices can trigger a DFS that visits every vertex once and scans every incident edge, costing O(E); the total is O(V times E). Adjacency lists, the right-to-left matching map, and visited marks use O(V + E) space.",
        uses: [
            "Assigning workers to jobs or students to projects",
            "Finding disjoint pairs in bipartite recommendation graphs",
            "A simple baseline for matching problems before faster layered algorithms",
        ],
        references: [
            "Kuhn, Zur Theorie der Graphen und ihrer Anwendungen, 1955",
            "Kleinberg and Tardos, Algorithm Design, matching chapter",
        ],
        workedExample:
            "With left A,B,C,D and right 1,2,3,4 and edges A-1, A-2, B-1, B-3, C-2, C-4, D-3, D-4, vertex A takes 1. When B tries 1, the owner A moves to 2, so B takes 1. Then C takes 4 and D takes 3, producing a matching of size four.",
    },
    id: "kuhn-matching",
    name: "Kuhn Bipartite Matching",
    category: "graph",
    complexity: { time: "O(V * E)", space: "O(V + E)" },
    defaultInput: {
        left: ["A", "B", "C", "D"],
        right: ["1", "2", "3", "4"],
        edges: [
            ["A", "1"], ["A", "2"], ["B", "1"], ["B", "3"],
            ["C", "2"], ["C", "4"], ["D", "3"], ["D", "4"],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build adjacency lists and start with an empty matching",
        "for each left vertex start a fresh depth-first search with empty visited marks",
        "for each neighbor right vertex follow its matched left owner when present",
        "when a free right vertex is reached flip the path and grow the matching",
        "if the search fails leave the left vertex unmatched and continue",
        "stop after every left vertex has been attempted",
        "done: report the maximum matching size and its edges",
    ],
};

export default module;
