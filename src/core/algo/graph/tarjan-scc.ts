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
        meta: {},
    };
    step += 1;

    const buildFrame = (message: string): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: message,
        codeLineNumber: 2,
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
        yield buildFrame(`Visiting ${v} (index ${index.get(v)}).`);
        step += 1;

        for (const neighbor of adjacency[v] ?? []) {
            if (index.get(neighbor) === undefined) {
                // Tree edge: recurse, then update lowlink from the child.
                yield buildFrame(`Descending into ${neighbor}.`);
                step += 1;
                yield* dfs(neighbor);
                lowlink.set(v, Math.min(lowlink.get(v) ?? 0, lowlink.get(neighbor) ?? 0));
            } else if (onStack.has(neighbor)) {
                // Back edge to a vertex still on the stack: update lowlink.
                lowlink.set(v, Math.min(lowlink.get(v) ?? 0, index.get(neighbor) ?? 0));
                yield buildFrame(`Back edge from ${v} to ${neighbor}.`);
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
            yield buildFrame(`Popped SCC #${components.length}: {${component.join(", ")}}.`);
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
        codeLineNumber: 4,
        layout: "graph",
        meta: { components: components.length },
    };
}

/** The Tarjan SCC module, registered with the engine. */
const module: AlgorithmModule = {
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
};

export default module;
