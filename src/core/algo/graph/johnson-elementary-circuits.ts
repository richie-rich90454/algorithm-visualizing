/**
 * johnson-elementary-circuits.ts – Johnson's Elementary Circuit Enumeration
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Johnson's algorithm lists every elementary (vertex-simple) directed circuit
 * of a graph exactly once. It fixes the smallest vertex s of a circuit and
 * searches only the subgraph induced by vertices at least s. A blocking rule
 * with per-vertex B lists avoids re-exploring dead ends, so each circuit is
 * reported once without enumerating exponentially many redundant paths.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O((V + E) · (C + 1)) - C circuits, each found with bounded work
 *   Space: O(V + E) for blocking, B lists, and the search stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices on the circuit currently being reported are GREEN (path).
 *   - The source of the current search is PINK (highlight).
 *   - The final frame lists every circuit found; edges return to idle.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

interface CircuitResult {
    circuits: number[][];
    frames: Array<{ source: string; cycle: string[]; description: string }>;
}

function enumerate(labels: string[], adjacency: Record<string, string[]>): CircuitResult {
    const n = labels.length;
    const index = new Map<string, number>(labels.map((label, i) => [label, i]));
    const adj: number[][] = labels.map((label) =>
        (adjacency[label] ?? [])
            .filter((v) => index.has(v))
            .map((v) => index.get(v) as number)
            .sort((a, b) => a - b),
    );
    const circuits: number[][] = [];
    const frames: CircuitResult["frames"] = [];

    for (let s = 0; s < n; s += 1) {
        const blocked = new Array<boolean>(n).fill(false);
        const bLists: Array<Set<number>> = Array.from({ length: n }, () => new Set<number>());
        const stack: number[] = [];

        const unblock = (u: number): void => {
            blocked[u] = false;
            while (bLists[u]!.size > 0) {
                const w = bLists[u]!.values().next().value as number;
                bLists[u]!.delete(w);
                if (blocked[w]) unblock(w);
            }
        };

        const circuit = (v: number): boolean => {
            let found = false;
            stack.push(v);
            blocked[v] = true;
            for (const w of adj[v] as number[]) {
                if (w < s) continue; // restrict to vertices >= s
                if (w === s) {
                    circuits.push([...stack]);
                    const cycle = [...stack, s].map((idx) => labels[idx] as string);
                    frames.push({
                        source: labels[s] as string,
                        cycle,
                        description: `From ${labels[s]}: found elementary circuit ${cycle.join(" -> ")}.`,
                    });
                    found = true;
                } else if (!blocked[w]) {
                    if (circuit(w)) found = true;
                }
            }
            if (found) {
                unblock(v);
            } else {
                for (const w of adj[v] as number[]) {
                    if (w >= s && !bLists[w]!.has(v)) bLists[w]!.add(v);
                }
            }
            stack.pop();
            return found;
        };

        circuit(s);
        // Any vertex still blocked from this search is released for the next s.
        for (let v = 0; v < n; v += 1) {
            if (blocked[v]) unblock(v);
        }
    }
    return { circuits, frames };
}

function makeEdges(adjacency: Record<string, string[]>): VisualEdge[] {
    const seen = new Set<string>();
    const edges: VisualEdge[] = [];
    for (const [source, neighbors] of Object.entries(adjacency)) {
        for (const target of neighbors) {
            const id = `${source}-${target}`;
            if (seen.has(id)) continue;
            seen.add(id);
            edges.push({
                id: `edge-${id}`,
                sourceId: `node-${source}`,
                targetId: `node-${target}`,
                label: "",
                state: "idle",
                directed: true,
            });
        }
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["C"],
        C: ["A"],
        D: ["A", "E"],
        E: ["D"],
    };
    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])].sort();
    const edges = makeEdges(adjacency);
    const result = enumerate(labels, adjacency);
    let step = 0;

    const frame = (
        description: string,
        codeLineNumber: number,
        states: Map<string, EntityState>,
        meta: Record<string, number | string | boolean | string[]>,
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeGraphNodes(labels).map((node) => ({
            ...node,
            state: states.get(node.label) ?? "unvisited",
        })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    yield frame(
        `Johnson's algorithm enumerates elementary circuits of a ${labels.length}-vertex digraph.`,
        0,
        new Map(),
        { vertices: labels.length, edges: edges.length, circuits: 0 },
    );
    step += 1;

    for (const item of result.frames) {
        const states = new Map<string, EntityState>();
        states.set(item.source, "highlight");
        for (const label of item.cycle) states.set(label, "path");
        yield frame(item.description, 3, states, {
            vertices: labels.length,
            edges: edges.length,
            circuits: result.circuits.length,
            circuit: item.cycle,
        });
        step += 1;
        if (step > 80) break;
    }

    const finalStates = new Map<string, EntityState>(
        labels.map((label) => [label, "sorted" as EntityState]),
    );
    yield frame(
        `Found ${result.circuits.length} elementary circuit(s) with each minimum vertex as source.`,
        5,
        finalStates,
        {
            vertices: labels.length,
            edges: edges.length,
            circuits: result.circuits.length,
            cycles: result.circuits.map((c) => [...c, c[0] as number].map((idx) => labels[idx]).join(" -> ")),
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A circuit is elementary when no vertex repeats. To list each one only once, Johnson fixes its smallest-numbered vertex as a source and ignores smaller vertices entirely. A depth-first search walks forward paths, and a blocking table remembers vertices that led nowhere so the same dead end is not explored again from different starts.",
        invariants: [
            "Every reported path starts and ends at the same source vertex.",
            "No reported circuit repeats a vertex, because blocked vertices are never revisited on the current path.",
            "Restricting search to vertices at least s makes each circuit appear under exactly one source.",
        ],
        correctness:
            "Any elementary circuit has a unique smallest vertex s, and the search from s explores all simple paths that return to s without touching smaller vertices, so it finds the circuit. Blocking only prunes vertices that cannot complete a circuit from the current source, and unblocking restores them later, so no valid circuit is lost. Each circuit is reported under its own minimum and nowhere else.",
        complexityRationale:
            "For each of V sources the search costs O(V + E) plus work proportional to the circuits reported, giving O((V + E)(C + 1)) time. Blocking flags, B lists, and the recursion stack use O(V + E) space.",
        uses: [
            "Enumerating cycles in chemical and circuit graphs",
            "Finding feedback arcs and deadlock cycles",
            "Cycle-basis and strongly connected subgraph analysis",
        ],
        references: [
            "Johnson, Finding All the Elementary Circuits of a Directed Graph, SIAM Journal on Computing, 1975",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter 22",
        ],
        workedExample:
            "For A->B, B->C, C->A plus D->E, E->D and D->A, the algorithm reports A -> B -> C -> A, A -> C -> A, and D -> E -> D. Each cycle is reported under its smallest vertex and never again.",
    },
    id: "johnson-elementary-circuits",
    name: "Johnson Elementary Circuits",
    category: "graph",
    complexity: { time: "O((V + E)(C + 1))", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: ["B", "C"],
            B: ["C"],
            C: ["A"],
            D: ["A", "E"],
            E: ["D"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "order vertices and fix a source s from smallest to largest",
        "ignore any vertex smaller than s for this search",
        "depth-first walk: mark the current vertex blocked and push it",
        "an edge back to s reports the stack as an elementary circuit",
        "recurse through unblocked neighbors at least s",
        "if a branch found a circuit, unblock its vertices via the B lists",
        "move to the next source after releasing all blocked vertices",
        "done: return every elementary circuit exactly once",
    ],
};

export default module;
