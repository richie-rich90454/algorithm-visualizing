/**
 * maximum-cardinality-search.ts - Maximum Cardinality Search
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Maximum cardinality search (MCS) numbers the vertices of an undirected
 * graph from 1 to n. At each step it picks the unnumbered vertex that has the
 * largest number of already-numbered neighbors, breaking ties by name. The
 * resulting ordering is a perfect elimination ordering exactly when the graph
 * is chordal, so MCS is a classic linear-time chordality test.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) with bucket queues, O(V^2) in this simple version
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being numbered is PURPLE (pivot).
 *   - Already numbered vertices are GREEN (sorted).
 *   - Live counts appear in each node's label.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type Adj = Record<string, string[]>;

function normalize(input: unknown): Adj {
    const raw = (input as { graph?: Adj } | null) ?? {};
    const source: Adj = Array.isArray(input)
        ? {}
        : raw.graph && typeof raw.graph === "object"
          ? raw.graph
          : { A: ["B", "C"], B: ["D"], C: ["B", "D"], D: [] };
    const adj: Adj = {};
    for (const v of Object.keys(source)) {
        adj[v] = [];
    }
    for (const [u, neighbors] of Object.entries(source)) {
        for (const v of neighbors) {
            if (adj[u] === undefined) {
                adj[u] = [];
            }
            if (adj[v] === undefined) {
                adj[v] = [];
            }
            if (!(adj[u] as string[]).includes(v)) {
                (adj[u] as string[]).push(v);
            }
            if (!(adj[v] as string[]).includes(u)) {
                (adj[v] as string[]).push(u);
            }
        }
    }
    return adj;
}

function makeEdges(adj: Adj): VisualEdge[] {
    const edges: VisualEdge[] = [];
    const seen = new Set<string>();
    for (const [u, neighbors] of Object.entries(adj)) {
        for (const v of neighbors) {
            const key = [u, v].sort().join("|");
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            edges.push({
                id: `edge-${u}-${v}`,
                sourceId: `node-${u}`,
                targetId: `node-${v}`,
                label: "",
                state: "idle",
                directed: false,
            });
        }
    }
    return edges;
}

function isClique(adj: Adj, nodes: string[]): boolean {
    for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
            if (!(adj[nodes[i] as string] ?? []).includes(nodes[j] as string)) {
                return false;
            }
        }
    }
    return true;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const adj = normalize(input);
    const vertices = Object.keys(adj).sort();
    const edges = makeEdges(adj);
    const numbered = new Set<string>();
    const order: string[] = [];
    let step = 0;

    function nodesWith(states: Map<string, "pivot" | "sorted">): VisualEntity[] {
        return makeGraphNodes(vertices).map((node) => {
            const label = String(node.label);
            const count = (adj[label] ?? []).filter((n) => numbered.has(n)).length;
            const state = states.get(label);
            return {
                ...node,
                label: `${label}:${count}`,
                value: count,
                state: state ?? "unvisited",
                metadata: { label, count, order: order.indexOf(label) },
            };
        });
    }

    yield {
        stepNumber: step,
        entities: nodesWith(new Map()),
        edges,
        description: "Maximum cardinality search numbers vertices by their count of numbered neighbors.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { n: vertices.length, numbered: 0, chordal: "pending" },
    };
    step += 1;

    while (order.length < vertices.length) {
        let best: string | undefined;
        let bestCount = -1;
        for (const v of vertices) {
            if (numbered.has(v)) {
                continue;
            }
            const count = (adj[v] ?? []).filter((n) => numbered.has(n)).length;
            if (count > bestCount) {
                bestCount = count;
                best = v;
            }
        }
        if (best === undefined) {
            break;
        }
        numbered.add(best);
        order.push(best);

        const states = new Map<string, "pivot" | "sorted">();
        for (const v of order) {
            states.set(v, "sorted");
        }
        states.set(best, "pivot");
        yield {
            stepNumber: step,
            entities: nodesWith(states),
            edges,
            description: `Numbered ${best} next with ${bestCount} numbered neighbor(s); position ${order.length}.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { n: vertices.length, numbered: order.length, selected: best, count: bestCount },
        };
        step += 1;
    }

    // A maximum-cardinality ordering is a perfect elimination ordering iff the
    // higher-numbered neighbors of every vertex form a clique (chordal graph).
    let chordal = true;
    for (const v of vertices) {
        const higher = (adj[v] ?? []).filter((n) => order.indexOf(n) > order.indexOf(v));
        if (!isClique(adj, higher)) {
            chordal = false;
            break;
        }
    }

    const finalStates = new Map<string, "pivot" | "sorted">();
    for (const v of order) {
        finalStates.set(v, "sorted");
    }
    yield {
        stepNumber: step,
        entities: nodesWith(finalStates),
        edges,
        description: `Ordering [${order.join(", ")}]; graph is ${chordal ? "chordal" : "not chordal"}.`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { n: vertices.length, numbered: vertices.length, chordal, order },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Number the vertices one by one, always choosing the unnumbered vertex that touches the most already-numbered vertices. It is a greedy way to peel a graph from the inside out. The order it produces is special: for a chordal graph every vertex's later neighbors form a clique, which is exactly the perfect elimination ordering used by sparse linear algebra.",
        invariants: [
            "Once numbered, a vertex's count never changes and it is never reconsidered.",
            "The chosen vertex always has the maximum count among unnumbered vertices at that step.",
            "Ties are broken deterministically by vertex name.",
        ],
        correctness:
            "MCS produces a perfect elimination ordering if and only if the graph is chordal. Checking that the higher-numbered neighbors of each vertex form a clique therefore decides chordality: if any such set is not a clique, it contains an induced cycle of length four or more and the graph is not chordal.",
        complexityRationale:
            "A direct implementation recomputes each vertex's count by scanning its adjacency list on every step, giving O(V^2 + E) time in this simple form; bucket-based MCS improves this to O(V + E). The ordering, counts and adjacency use O(V + E) space.",
        uses: [
            "Chordality testing and perfect elimination ordering",
            "Fill-reducing ordering for sparse Cholesky factorization",
            "Recognition of clique trees and triangulated graphs",
        ],
        references: [
            "Tarjan and Yannakakis, Simple Linear-Time Algorithms to Test Chordality, 1984",
            "Golumbic, Algorithmic Graph Theory and Perfect Graphs, Chapter 4",
        ],
        workedExample:
            "For a path A-B-C, A and C initially have count zero and B has zero; with name tie-breaking A is numbered first, then B (count one), then C. For a triangle all choices yield a clique of later neighbors, so the graph is chordal; a four-cycle is reported as not chordal.",
    },
    id: "maximum-cardinality-search",
    name: "Maximum Cardinality Search",
    category: "graph",
    complexity: { time: "O(V^2 + E)", space: "O(V + E)" },
    defaultInput: { graph: { A: ["B", "C"], B: ["D"], C: ["B", "D"], D: [] } },
    visualType: "graph",
    run,
    pseudocode: [
        "mark no vertices as numbered",
        "while some vertex is unnumbered",
        "pick the unnumbered vertex with the most numbered neighbors",
        "assign it the next number and mark it numbered",
        "record its count and continue",
        "check whether higher-numbered neighbors of each vertex form a clique",
        "done: report the ordering and the chordality verdict",
    ],
};

export default module;
