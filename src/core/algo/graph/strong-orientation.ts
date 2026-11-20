/**
 * strong-orientation.ts - Strong Orientation by Depth-First Search (Robbins)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Robbins' theorem says an undirected graph admits a strongly connected
 * orientation exactly when it is connected and has no bridges. The depth-first
 * construction orients each tree edge from parent to child and each back edge
 * from descendant to ancestor. When every edge lies on a cycle, every vertex
 * can reach every other vertex through the resulting directed graph.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E) for one depth-first search
 *   Space: O(V + E) for discovery times and the oriented edge list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Tree edges are oriented away from the root and shown CYAN (path).
 *   - Back edges point from descendant to ancestor and flash BLUE (active).
 *   - A bridge GREENS out as RED (error): it cannot be oriented strongly.
 */
import type { AlgorithmModule, VisualEdge, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

interface DirectedEdge {
    from: string;
    to: string;
    bridge: boolean;
}

function undirectedKey(a: string, b: string): string {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "D"],
        B: ["A", "C", "D"],
        C: ["B", "D"],
        D: ["A", "B", "C"],
    };

    const vertices: string[] = [];
    const seenVertex = new Set<string>();
    for (const v of Object.keys(adjacency)) {
        if (!seenVertex.has(v)) {
            seenVertex.add(v);
            vertices.push(v);
        }
        for (const nb of adjacency[v] ?? []) {
            if (!seenVertex.has(nb)) {
                seenVertex.add(nb);
                vertices.push(nb);
            }
        }
    }

    const nodes = makeGraphNodes(vertices.length > 0 ? vertices : ["A"]);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const edges: VisualEdge[] = [];
    const directed: DirectedEdge[] = [];

    let step = 0;
    const snap = (
        description: string,
        line: number,
        meta: Record<string, number | string | boolean> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber: line,
        layout: "graph",
        meta,
    });

    if (vertices.length === 0) {
        yield snap("Empty graph - nothing to orient.", 7, {
            bridges: 0,
            stronglyConnected: true,
            directed: "",
        });
        return;
    }

    yield snap(`Orienting ${vertices.length} vertices with a depth-first search.`, 0, {
        bridges: 0,
        stronglyConnected: false,
        directed: "",
    });
    step += 1;

    const tin = new Map<string, number>();
    const low = new Map<string, number>();
    const onStack = new Set<string>();
    const bridges: string[] = [];
    let timer = 0;
    let components = 0;

    function* dfs(u: string, parent: string | null): Generator<VisualFrame, void, unknown> {
        tin.set(u, ++timer);
        low.set(u, timer);
        onStack.add(u);
        for (const v of adjacency[u] ?? []) {
            if (v === parent) continue;
            if (!tin.has(v)) {
                edges.push({
                    id: `dir-${u}-${v}`,
                    sourceId: `node-${u}`,
                    targetId: `node-${v}`,
                    label: "tree",
                    state: "path",
                    directed: true,
                });
                directed.push({ from: u, to: v, bridge: false });
                const un = byId.get(`node-${u}`);
                if (un) un.state = "comparing";
                yield snap(`Tree edge ${u} -> ${v}: orient parent to child.`, 1, {
                    bridges: bridges.length,
                    stronglyConnected: false,
                    directed: "",
                });
                step += 1;
                yield* dfs(v, u);
                low.set(u, Math.min(low.get(u) as number, low.get(v) as number));
                if ((low.get(v) as number) > (tin.get(u) as number)) {
                    const key = undirectedKey(u, v);
                    bridges.push(key);
                    directed[directed.length - 1] = { from: u, to: v, bridge: true };
                    const edge = edges.find((e) => e.id === `dir-${u}-${v}`);
                    if (edge) edge.state = "error";
                    yield snap(`Edge ${u}-${v} is a bridge: a strong orientation is impossible.`, 4, {
                        bridges: bridges.length,
                        stronglyConnected: false,
                        directed: "",
                    });
                    step += 1;
                }
            } else if (onStack.has(v)) {
                edges.push({
                    id: `dir-${u}-${v}`,
                    sourceId: `node-${u}`,
                    targetId: `node-${v}`,
                    label: "back",
                    state: "active",
                    directed: true,
                });
                directed.push({ from: u, to: v, bridge: false });
                const un = byId.get(`node-${u}`);
                if (un) un.state = "comparing";
                low.set(u, Math.min(low.get(u) as number, tin.get(v) as number));
                yield snap(`Back edge ${u} -> ${v}: orient descendant to ancestor.`, 2, {
                    bridges: bridges.length,
                    stronglyConnected: false,
                    directed: "",
                });
                step += 1;
            }
        }
        onStack.delete(u);
        const done = byId.get(`node-${u}`);
        if (done) done.state = "visited";
    }

    for (const v of vertices) {
        if (!tin.has(v)) {
            components += 1;
            yield* dfs(v, null);
        }
    }

    for (const edge of edges) {
        if (edge.state !== "error") edge.state = "path";
    }
    for (const node of nodes) node.state = "visited";
    const stronglyConnected = bridges.length === 0 && components === 1;
    const directedText = directed.map((d) => `${d.from}>${d.to}`).join("|");
    yield snap(
        stronglyConnected
            ? `No bridges: the orientation is strongly connected (${directed.length} directed edges).`
            : `Not strongly connected: ${bridges.length} bridge(s) and ${components} component(s).`,
        7,
        {
            bridges: bridges.length,
            components,
            stronglyConnected,
            directed: directedText,
            bridgeList: bridges.join("|"),
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An undirected edge can only be made one-way. If it is a bridge, the two sides could no longer reach each other, so no orientation can be strongly connected. Otherwise a depth-first search gives a recipe: point tree edges downward and back edges upward, and every vertex can climb back up a cycle and then descend again.",
        invariants: [
            "Each undirected edge receives exactly one directed edge.",
            "Low-link values are the smallest discovery time reachable from a vertex using one back edge.",
            "An edge is a bridge exactly when low of its child exceeds the discovery time of its parent.",
        ],
        correctness:
            "Robbins' theorem gives the necessary and sufficient condition: a strongly connected orientation exists if and only if the graph is connected and bridgeless. The depth-first orientation orients tree edges parent to child and back edges descendant to ancestor, which supplies a directed cycle through every tree edge when there are no bridges, so all vertices are mutually reachable. The bridge test via low-link values is exact because a child subtree with no back edge to an ancestor can only reconnect through its parent edge.",
        complexityRationale:
            "A single depth-first search inspects each vertex and edge once, giving O(V + E) time; discovery times, low values, and the oriented edge list occupy O(V + E) space.",
        uses: [
            "Converting an undirected network into a strongly connected directed one",
            "Designing one-way street systems that keep every district reachable",
            "Detecting bridges as a prerequisite for robust network design",
        ],
        references: [
            "Robbins, A Theorem on Graphs, 1939",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, depth-first search and bridges",
        ],
        workedExample:
            "A square A-B-C-D with a chord B-D has no bridge. Depth-first search orients A->B, B->C, C->D as tree edges and D->A, D->B as back edges. From any vertex you can climb a back edge toward the root and then descend a tree edge to any target, so the orientation is strongly connected.",
    },
    id: "strong-orientation",
    name: "Strong Orientation (Robbins)",
    category: "graph",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: ["B", "D"],
            B: ["A", "C", "D"],
            C: ["B", "D"],
            D: ["A", "B", "C"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start a depth-first search from each unvisited vertex",
        "on a tree edge u to v orient u -> v and recurse",
        "on a back edge to an ancestor orient u -> ancestor",
        "low[v] is the smallest time reachable from v",
        "if low[v] > time[u] then edge u-v is a bridge",
        "a bridge prevents any strong orientation",
        "repeat until every vertex is visited",
        "done: report bridges and the directed edge set",
    ],
};

export default module;
