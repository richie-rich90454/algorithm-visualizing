/**
 * counting-cliques.ts - Enumerate and Count Every Clique
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A clique is a set of vertices that are pairwise adjacent. This module walks
 * the clique enumeration tree with a candidate set that only ever grows in
 * increasing vertex index, so every clique is generated exactly once. It
 * records how many cliques exist at each size, which subsumes vertices (size
 * one), edges (size two), triangles, and larger complete subgraphs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(2^V) clique candidates in the worst case, O(V^2) work per candidate
 *   Space: O(V) recursion depth plus the per-size counters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are circles and edges are undirected connections.
 *   - The clique currently being counted is highlighted.
 *   - The running counts by size are reported in meta.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

interface UndirectedEdge {
    a: string;
    b: string;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { adjacency?: Record<string, string[]> } | null) ?? {};
    const adjacency = task.adjacency ?? {
        A: ["B", "C", "D"],
        B: ["A", "C"],
        C: ["A", "B", "D"],
        D: ["A", "C"],
    };
    const vertices = Object.keys(adjacency).sort();
    const neighbor = new Map<string, Set<string>>();
    for (const v of vertices) {
        neighbor.set(v, new Set((adjacency[v] ?? []).filter((u) => Object.prototype.hasOwnProperty.call(adjacency, String(u))).map(String)));
    }
    const edges: UndirectedEdge[] = [];
    const seen = new Set<string>();
    for (const a of vertices) {
        for (const b of neighbor.get(a) ?? []) {
            const key = [a, b].sort().join("|");
            if (a === b || seen.has(key)) {
                continue;
            }
            seen.add(key);
            edges.push({ a, b });
        }
    }

    const nodes = makeGraphNodes(vertices);
    const counts: Record<string, number> = {};
    const found: string[][] = [];
    let total = 0;
    let maximumSize = 0;

    const snap = (
        message: string,
        line: number,
        current: string[],
    ): VisualFrame => {
        const active = new Set(current);
        for (const node of nodes) {
            node.state = active.has(String(node.value)) ? "active" : "unvisited";
        }
        const visualEdges: VisualEdge[] = edges.map((edge) => ({
            id: `edge-${[edge.a, edge.b].sort().join("-")}`,
            sourceId: `node-${edge.a}`,
            targetId: `node-${edge.b}`,
            label: "",
            state: active.has(edge.a) && active.has(edge.b) ? "comparing" : "idle",
            directed: false,
        }));
        return {
            stepNumber: 0,
            entities: nodes.map((node) => ({ ...node })),
            edges: visualEdges,
            description: message,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                vertexCount: vertices.length,
                edgeCount: edges.length,
                totalCliques: total,
                maximumSize,
                countsBySize: Object.entries(counts)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([size, count]) => `${size}:${count}`),
                currentClique: [...current],
            },
        };
    };

    yield {
        ...snap(`Enumerating every clique in a graph of ${vertices.length} vertices.`, 1, []),
        stepNumber: 0,
    };
    let step = 1;

    /** Extend a clique with candidates of strictly larger index. */
    const expand = (current: string[], candidates: string[]): void => {
        if (current.length > 0) {
            total += 1;
            counts[String(current.length)] = (counts[String(current.length)] ?? 0) + 1;
            maximumSize = Math.max(maximumSize, current.length);
            if (found.length < 80 && current.length >= 2) {
                found.push([...current]);
            }
        }
        for (const candidate of candidates) {
            const later = candidates.filter((v) => v > candidate && (neighbor.get(candidate) ?? new Set()).has(v));
            expand([...current, candidate], later);
        }
    };
    expand([], vertices);

    for (const clique of found) {
        yield {
            ...snap(`Counted clique {${clique.join(", ")}} of size ${clique.length}.`, 4, clique),
            stepNumber: step,
        };
        step += 1;
    }

    const summary = Object.entries(counts)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([size, count]) => `${count} of size ${size}`)
        .join(", ");
    yield {
        ...snap(
            `Found ${total} clique(s) total: ${summary}; largest has ${maximumSize} vertex(es).`,
            6,
            [],
        ),
        stepNumber: step,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Every clique can be built one vertex at a time. If we only ever append a vertex whose position in a fixed ordering is larger than the vertices already chosen, each clique is assembled in exactly one way: by increasing position. Walking that tree counts all cliques without producing duplicates.",
        invariants: [
            "The current set is a clique after every extension.",
            "Candidates are always larger in the ordering than the last chosen vertex.",
            "Each counted clique appears once in the per-size totals.",
        ],
        correctness:
            "For any clique, sort its vertices by the fixed order. The recursion first chooses the smallest, then only candidates larger than it that are adjacent to it, and so on, so it reconstructs exactly that sorted sequence. No other branch can produce the same set because every extension is strictly increasing. Hence each clique is counted once and the totals are exact.",
        complexityRationale:
            "A graph on v vertices has at most 2^v vertex subsets, and testing each candidate against the neighbor set costs O(v), so the enumeration is exponential but bounded by the number of cliques times O(v^2). The recursion stack and counters use O(v) space.",
        uses: [
            "Counting complete substructures in social and biological networks",
            "Computing clique numbers and triangle statistics in graph analytics",
            "A building block for clique covers and dense-subgraph detection",
        ],
        references: [
            "Bron and Kerbosch, Algorithm 457: Finding All Cliques of an Undirected Graph, 1973",
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, chapter on backtracking",
        ],
        workedExample:
            "For the path A-B-C, the cliques are the single vertices A, B, C and the edges A-B and B-C. There are five cliques in all: three of size one and two of size two, and none larger because A and C are not adjacent.",
    },
    id: "counting-cliques",
    name: "Counting All Cliques",
    category: "graph",
    complexity: { time: "O(2^V * V)", space: "O(V)" },
    defaultInput: {
        adjacency: {
            A: ["B", "C", "D"],
            B: ["A", "C"],
            C: ["A", "B", "D"],
            D: ["A", "C"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "sort the vertices into a fixed order",
        "build the adjacency set of each vertex",
        "define a recursive extension with a candidate set",
        "count the current clique and increment its size bucket",
        "for each candidate, keep only later adjacent vertices",
        "recurse with the candidate appended to the clique",
        "repeat until the candidate set is empty",
        "report the total count and counts by size",
    ],
};

export default module;
