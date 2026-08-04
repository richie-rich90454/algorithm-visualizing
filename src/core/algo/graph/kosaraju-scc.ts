/**
 * kosaraju-scc.ts – Kosaraju's Algorithm (Strongly Connected Components)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A strongly connected component (SCC) is a maximal set of vertices where
 * every vertex can reach every other. Kosaraju's algorithm finds all SCCs in
 * two DFS passes over a directed graph:
 *
 *   1. Order vertices by DFS finish time (the "post-order" order).
 *   2. Reverse every edge and run DFS again, processing vertices in reverse
 *      finish-time order. Each DFS tree found in the reversed graph is exactly
 *      one SCC.
 *
 * The two-pass structure is the classic introduction to SCC decomposition.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) – two complete DFS traversals
 *   Space: O(V) for the visited set and finish-time stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Pass 1 nodes are visited in DFS order (active/visited colors).
 *   - Pass 2 nodes are colored per SCC (each component gets a distinct
 *     state: sorted / path / highlight).
 *   - Reversed edges are drawn in pass 2.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Correct but does two full traversals; Tarjan's finds SCCs in one.
 *   - The reverse-graph trick is the key conceptual leap to teach.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

/**
 * The Kosaraju SCC generator.
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

    // Reverse the graph: every edge flips direction.
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
        description: "Kosaraju's algorithm – pass 1 orders vertices by DFS finish time.",
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
        meta: {},
    });

    // ------------------------------------------------------------------
    // Pass 1: DFS to compute finish-time order (a "post-order" stack).
    // ------------------------------------------------------------------
    const visited1 = new Set<string>();
    const finishOrder: string[] = [];

    function* dfs1(v: string): Generator<VisualFrame, void, unknown> {
        visited1.add(v);
        const node = nodeById.get(`node-${v}`);
        if (node) {
            node.state = "comparing";
        }
        yield buildFrame(`Pass 1 – visiting ${v}.`);
        step += 1;

        for (const neighbor of adjacency[v] ?? []) {
            if (!visited1.has(neighbor)) {
                yield* dfs1(neighbor);
            }
        }

        // After all successors, record the finish time.
        finishOrder.push(v);
        if (node) {
            node.state = "visited";
        }
        yield buildFrame(`Pass 1 – ${v} finished; added to the ordering stack.`);
        step += 1;
    }

    for (const v of vertices) {
        if (!visited1.has(v)) {
            yield* dfs1(v);
        }
    }

    // ------------------------------------------------------------------
    // Pass 2: DFS on the reversed graph in reverse finish-time order.
    // ------------------------------------------------------------------
    const visited2 = new Set<string>();
    const components: string[][] = [];

    // Reset node colors for the second pass.
    for (const node of nodes) {
        node.state = "unvisited";
    }

    yield buildFrame("Pass 1 complete – starting pass 2 on the reversed graph.");
    step += 1;

    const componentColors = ["sorted", "path", "highlight"] as const;

    function* dfs2(v: string, component: string[]): Generator<VisualFrame, void, unknown> {
        visited2.add(v);
        component.push(v);
        const node = nodeById.get(`node-${v}`);
        if (node) {
            node.state = "comparing";
        }
        yield buildFrame(`Pass 2 – exploring ${v} on the reversed graph.`);
        step += 1;

        for (const neighbor of reverse[v] ?? []) {
            if (!visited2.has(neighbor)) {
                yield* dfs2(neighbor, component);
            }
        }
    }

    for (let i = finishOrder.length - 1; i >= 0; i -= 1) {
        const v = finishOrder[i];
        if (!v || visited2.has(v)) {
            continue;
        }

        const component: string[] = [];
        yield* dfs2(v, component);
        components.push(component);

        // Color this whole component with its own distinct state.
        const color = componentColors[(components.length - 1) % componentColors.length];
        for (const member of component) {
            const memberNode = nodeById.get(`node-${member}`);
            if (memberNode) {
                memberNode.state = color;
            }
        }
        yield buildFrame(`SCC #${components.length}: {${component.join(", ")}}.`);
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Kosaraju complete – found ${components.length} strongly connected component(s).`,
        codeLineNumber: 4,
        layout: "graph",
        meta: { components: components.length },
    };
}

/** The Kosaraju SCC module, registered with the engine. */
const module: AlgorithmModule = {
    id: "kosaraju-scc",
    name: "Kosaraju SCC",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V)" },
    // {A,B,C} and {D,E} are SCCs; F is its own component.
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
