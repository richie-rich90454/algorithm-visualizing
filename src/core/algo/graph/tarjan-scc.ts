/**
 * tarjan-scc.ts – Tarjan's Algorithm (Strongly Connected Components)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Tarjan's algorithm finds strongly connected components in a *single* DFS,
 * using two bookkeeping numbers per vertex:
 *
 *   - `index[v]`   – the DFS discovery order of v.
 *   - `lowlink[v]` – the smallest discovery index reachable from v via the
 *                    DFS tree plus at most one back edge.
 *
 * A vertex is the root of an SCC exactly when `lowlink[v] === index[v]`, at
 * which point everything still on the DFS stack is popped into one component.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) – one DFS, no reverse graph needed
 *   Space: O(V)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes on the DFS stack are YELLOW (comparing).
 *   - Finished SCCs are colored per component (sorted / path / highlight).
 *   - The root vertex that pops a component is highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - More efficient than Kosaraju (one pass, no reverse graph).
 *   - The `lowlink` idea generalizes to bridges and articulation points.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

/**
 * The Tarjan SCC generator.
 *
 * @param input The graph as an adjacency list.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B"],
        B: ["C", "E"],
        C: ["A", "F"],
        D: ["C"],
        E: ["D"],
        F: ["F"],
    };

    const vertices = Object.keys(adjacency);
    const nodes = makeGraphNodes(vertices);
    const edges = makeGraphEdges(adjacency);

    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    let step = 0;
    let nextIndex = 0;
    const stack: string[] = [];
    const onStack = new Set<string>();
    const index = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const components: string[][] = [];

    // Frame 0: the untouched graph.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: "Tarjan's algorithm – single DFS to find all SCCs.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { components: components.length },
    };
    step += 1;

    const buildFrame = (message: string, line = 2): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: line,
        layout: "graph",
        meta: { components: components.length },
    });

    const componentColors = ["sorted", "path", "highlight"] as const;

    /**
     * Recursive Tarjan DFS.
     */
    function* dfs(v: string): Generator<VisualFrame, void, unknown> {
        // Assign discovery order and push onto the stack.
        index.set(v, nextIndex);
        lowlink.set(v, nextIndex);
        nextIndex += 1;
        stack.push(v);
        onStack.add(v);

        const node = nodeById.get(`node-${v}`);
        if (node) {
            node.state = "comparing";
        }
        yield buildFrame(`Visiting ${v} (index ${index.get(v)}).`, 1);
        step += 1;

        for (const neighbor of adjacency[v] ?? []) {
            if (index.get(neighbor) === undefined) {
                // Tree edge: recurse, then update lowlink from the child.
                yield buildFrame(`Descending into ${neighbor}.`, 1);
                step += 1;
                yield* dfs(neighbor);
                lowlink.set(v, Math.min(lowlink.get(v) ?? 0, lowlink.get(neighbor) ?? 0));
            } else if (onStack.has(neighbor)) {
                // Back edge to a vertex still on the stack: update lowlink.
                lowlink.set(v, Math.min(lowlink.get(v) ?? 0, index.get(neighbor) ?? 0));
                yield buildFrame(`Back edge from ${v} to ${neighbor}.`, 2);
                step += 1;
            }
        }

        // If v is a component root, pop the whole SCC off the stack.
        if (lowlink.get(v) === index.get(v)) {
            const component: string[] = [];
            let popped: string | undefined;
            do {
                popped = stack.pop();
                if (popped) {
                    onStack.delete(popped);
                    component.push(popped);
                }
            } while (popped !== v && popped !== undefined);

            components.push(component);
            const color = componentColors[(components.length - 1) % componentColors.length];
            for (const member of component) {
                const memberNode = nodeById.get(`node-${member}`);
                if (memberNode) {
                    memberNode.state = color;
                }
            }
            yield buildFrame(`Popped SCC #${components.length}: {${component.join(", ")}}.`, 3);
            step += 1;
        }
    }

    // Run from every unvisited vertex (the graph may be disconnected).
    for (const v of vertices) {
        if (index.get(v) === undefined) {
            yield* dfs(v);
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Tarjan complete – found ${components.length} strongly connected component(s).`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { components: components.length },
    };
}

/** The Tarjan SCC module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Tarjan finds strongly connected components in a single depth-first search. It keeps a discovery time and a lowlink per vertex plus a stack of active vertices. A vertex whose lowlink equals its discovery time is the root of an SCC, and everything above it on the stack is popped into one component.",
        "invariants": [
            "low[v] is the smallest discovery index reachable from v through the DFS tree and at most one back edge.",
            "The stack holds vertices not yet assigned to a component.",
            "Popping at a root yields a maximal mutually reachable set."
        ],
        "correctness": "When low[v] equals disc[v], no back edge from v's subtree reaches an ancestor, so the vertices above v on the stack cannot reach outside the group and form an SCC. Any vertex with a lower lowlink still connects upward, so popping is correctly delayed until its root finishes.",
        "complexityRationale": "One DFS with constant work per edge gives O(V + E) time; index, lowlink, and stack arrays use O(V) space.",
        "uses": [
            "Efficient strongly connected component decomposition",
            "Solving 2-SAT and other implication-graph problems",
            "Preprocessing directed graphs into DAGs"
        ],
        "references": [
            "Tarjan, Depth-First Search and Linear Graph Algorithms (1972)",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, strongly connected components"
        ],
        "workedExample": "In the graph with cycle A-B-C-A, tail D to C, chain E to D, and self-loop F, DFS from A finds the back edge C to A, lowering lowlinks for the cycle. When A finishes, low[A] equals disc[A] and the stack pops {A,B,C} as one SCC; later roots pop {D,E} and {F}."
    },
    id: "tarjan-scc",
    name: "Tarjan SCC",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V)" },
    // Same graph as Kosaraju for a direct single-pass comparison.
    defaultInput: {
        graph: {
            A: ["B"],
            B: ["C", "E"],
            C: ["A", "F"],
            D: ["C"],
            E: ["D"],
            F: ["F"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "set up index/lowlink clocks plus an empty DFS stack",
        "visit v: stamp index/lowlink and push v onto the stack",
        "back edge to a stacked vertex: lower lowlink[v]",
        "lowlink[v] equals index[v]: pop one SCC off the stack",
        "repeat from every unvisited vertex",
        "done: all SCCs such as {A,B,C}, {D,E}, and {F}",
    ],
};

export default module;
