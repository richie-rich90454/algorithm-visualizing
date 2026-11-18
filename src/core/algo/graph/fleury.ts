/**
 * fleury.ts - Fleury's Algorithm for an Eulerian Trail
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An Eulerian trail visits every edge of an undirected graph exactly once. If
 * the graph has two odd-degree vertices the trail must start at one of them;
 * if all degrees are even it is a closed circuit. Fleury's algorithm walks one
 * edge at a time and avoids crossing a bridge of the remaining graph unless no
 * other edge is available, because burning a bridge early would strand the
 * edges on one side. Bridges are found with a low-link depth-first search on
 * the edges that remain.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E * (V + E)) in this straightforward implementation, since a
 *          bridge search is repeated after each edge removal
 *   Space: O(V + E) for the graph, low-link arrays, and traversal state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are circles; edges are undirected connections.
 *   - The chosen edge is yellow while the current vertex is visited.
 *   - Removed edges are green and the final trail is reported in meta.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

interface UndirectedEdge {
    id: string;
    a: string;
    b: string;
}

/** Tarjan low-link bridge detection over the currently active edges. */
function findBridges(vertices: string[], edges: UndirectedEdge[], active: Set<string>): Set<string> {
    const adjacency = new Map<string, Array<{ to: string; id: string }>>();
    for (const vertex of vertices) {
        adjacency.set(vertex, []);
    }
    for (const edge of edges) {
        if (!active.has(edge.id)) {
            continue;
        }
        adjacency.get(edge.a)?.push({ to: edge.b, id: edge.id });
        adjacency.get(edge.b)?.push({ to: edge.a, id: edge.id });
    }
    const discovery = new Map<string, number>();
    const low = new Map<string, number>();
    const bridges = new Set<string>();
    let timer = 0;
    const visit = (vertex: string, parentEdge: string): void => {
        discovery.set(vertex, ++timer);
        low.set(vertex, timer);
        for (const neighbor of adjacency.get(vertex) ?? []) {
            if (!active.has(neighbor.id) || neighbor.id === parentEdge) {
                continue;
            }
            const seen = discovery.get(neighbor.to) ?? 0;
            if (seen === 0) {
                visit(neighbor.to, neighbor.id);
                low.set(vertex, Math.min(low.get(vertex) ?? 0, low.get(neighbor.to) ?? 0));
                if ((low.get(neighbor.to) ?? 0) > (discovery.get(vertex) ?? 0)) {
                    bridges.add(neighbor.id);
                }
            } else {
                low.set(vertex, Math.min(low.get(vertex) ?? 0, seen));
            }
        }
    };
    for (const vertex of vertices) {
        if ((discovery.get(vertex) ?? 0) === 0) {
            visit(vertex, "");
        }
    }
    return bridges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { edges?: Array<[string, string]> } | null) ?? {};
    const raw = Array.isArray(task.edges) ? task.edges : [["A", "B"], ["A", "C"], ["B", "C"], ["C", "D"]];
    const edges: UndirectedEdge[] = raw
        .filter((pair) => Array.isArray(pair) && typeof pair[0] === "string" && typeof pair[1] === "string")
        .map(([a, b]) => ({ id: `edge-${a}-${b}`, a, b }));
    const vertices = [...new Set(edges.flatMap((edge) => [edge.a, edge.b]))].sort();
    const degree = new Map<string, number>();
    for (const edge of edges) {
        degree.set(edge.a, (degree.get(edge.a) ?? 0) + 1);
        degree.set(edge.b, (degree.get(edge.b) ?? 0) + 1);
    }
    const odd = vertices.filter((vertex) => (degree.get(vertex) ?? 0) % 2 === 1);
    const start = odd[0] ?? vertices[0] ?? "";

    const nodes = makeGraphNodes(vertices);
    const visualEdges: VisualEdge[] = edges.map((edge) => ({
        id: edge.id,
        sourceId: `node-${edge.a}`,
        targetId: `node-${edge.b}`,
        label: "",
        state: "idle",
        directed: false,
    }));
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const edgeById = new Map(visualEdges.map((edge) => [edge.id, edge]));

    const active = new Set(edges.map((edge) => edge.id));
    const path: string[] = [];
    const used: string[] = [];
    const snap = (message: string, line: number, current: string): VisualFrame => ({
        stepNumber: 0,
        entities: nodes.map((node) => ({ ...node })),
        edges: visualEdges.map((edge) => ({ ...edge })),
        description: message,
        codeLineNumber: line,
        layout: "graph",
        meta: {
            path: [...path],
            usedEdges: [...used],
            vertexCount: vertices.length,
            edgeCount: edges.length,
            oddVertices: odd,
            start,
            current,
            remaining: active.size,
        },
    });

    if (vertices.length === 0 || edges.length === 0) {
        yield { ...snap("Empty graph - there is no trail to walk.", 0, ""), stepNumber: 0 };
        return;
    }

    let step = 0;
    const startNode = nodeById.get(`node-${start}`);
    if (startNode) {
        startNode.state = "comparing";
    }
    path.push(start);
    yield { ...snap(`Starting at ${start} (${odd.length === 2 ? "an odd-degree vertex" : "all degrees even, closed circuit"}).`, 1, start), stepNumber: step };
    step += 1;

    let current = start;
    while (active.size > 0) {
        const incident = edges.filter((edge) => active.has(edge.id) && (edge.a === current || edge.b === current));
        if (incident.length === 0) {
            break;
        }
        const bridges = incident.length > 1 ? findBridges(vertices, edges, active) : new Set<string>();
        const chosen = incident.find((edge) => !bridges.has(edge.id)) ?? incident[0];
        if (!chosen) {
            break;
        }
        const next = chosen.a === current ? chosen.b : chosen.a;

        active.delete(chosen.id);
        used.push(chosen.id);
        path.push(next);
        current = next;

        for (const node of nodes) {
            node.state = "unvisited";
        }
        const currentNode = nodeById.get(`node-${current}`);
        if (currentNode) {
            currentNode.state = "comparing";
        }
        for (const edge of visualEdges) {
            edge.state = active.has(edge.id) ? "idle" : "sorted";
        }
        const chosenVisual = edgeById.get(chosen.id);
        if (chosenVisual) {
            chosenVisual.state = "active";
        }
        const avoidedBridge = incident.length > 1 && bridges.has(chosen.id);
        const message = avoidedBridge
            ? `Only bridge ${chosen.a}-${chosen.b} remains from ${path[path.length - 2] ?? start}; crossing it to ${next}.`
            : `Took ${path[path.length - 2] ?? start}-${next}, avoiding a bridge of the remaining graph.`;
        yield { ...snap(message, avoidedBridge ? 4 : 3, current), stepNumber: step };
        step += 1;
    }

    const complete = used.length === edges.length;
    for (const node of nodes) {
        node.state = complete ? "sorted" : "unvisited";
    }
    for (const edge of visualEdges) {
        edge.state = complete ? "sorted" : "idle";
    }
    yield {
        ...snap(
            complete
                ? `Eulerian trail uses all ${edges.length} edge(s): ${path.join(" -> ")}.`
                : `Stopped after ${used.length} of ${edges.length} edge(s); the graph has no single trail covering every edge.`,
            6,
            current,
        ),
        stepNumber: step,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To draw a graph without lifting your pencil or retracing an edge, do not cross a bridge of the leftover graph: a bridge is the only link to a whole region, and taking it early strands those edges. Fleury's algorithm follows that rule one edge at a time, starting at an odd-degree vertex when one exists, and only crosses a bridge when it is the sole remaining option.",
        invariants: [
            "An edge is removed from the graph exactly when it is added to the trail.",
            "When an alternative exists, the chosen edge is not a bridge of the remaining graph.",
            "The trail always ends at the second odd vertex or back at the start when all degrees are even.",
        ],
        correctness:
            "If the current vertex still has non-bridge incident edges, taking one cannot disconnect the remaining graph, so the unused edges stay reachable and the walk can continue. A bridge is crossed only when it is the only incident edge, which is forced. Because every step consumes one edge and never isolates unused edges except when forced, the process either uses all E edges or discovers that the graph is not connected enough; an Euler trail exists exactly when at most two vertices have odd degree and all edges lie in one component.",
        complexityRationale:
            "Each of the E steps builds adjacency and runs a low-link search over the remaining edges, costing O(V plus E) per step, for O(E(V plus E)) total time; adjacency, low-link arrays, and the trail use O(V plus E) space.",
        uses: [
            "Route inspection and street-sweeping tour construction",
            "Generating trails in graph drawing and puzzle solving",
            "Teaching the role of bridges in Eulerian graphs",
        ],
        references: [
            "Fleury, Deux problemes de geometrie de situation, 1883",
            "Cormen, Leiserson, Rivest and Stein, Introduction to Algorithms, Eulerian paths",
        ],
        workedExample:
            "For the triangle A-B-C-A plus the spur C-D, vertices C and D have odd degree, so the trail starts at C. From C the edge C-A is not a bridge of the remaining graph, so it is safe to take; the walk continues around the triangle and finishes by crossing the forced bridge C-D, using all four edges once.",
    },
    id: "fleury",
    name: "Fleury Eulerian Trail",
    category: "graph",
    complexity: { time: "O(E * (V + E))", space: "O(V + E)" },
    defaultInput: { edges: [["A", "B"], ["A", "C"], ["B", "C"], ["C", "D"]] },
    visualType: "graph",
    run,
    pseudocode: [
        "count degrees and start at an odd-degree vertex when one exists",
        "build the set of still-unused edges",
        "list the unused edges incident to the current vertex",
        "find bridges of the remaining graph with low-link search",
        "choose a non-bridge edge, or the only edge when all are bridges",
        "remove that edge and move to its other endpoint",
        "repeat until no edges remain, then report the trail",
    ],
};

export default module;
