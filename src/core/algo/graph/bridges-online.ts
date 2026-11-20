/**
 * bridges-online.ts – Online Bridge Finding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Online bridge finding answers "which edges are bridges?" after every edge
 * insertion instead of only once on a finished graph. Edges arrive one at a
 * time; inserting an edge inside an existing cycle creates no new bridge,
 * while an edge that joins two previously disconnected pieces becomes a
 * bridge. After each insertion the current edge set is re-examined and the
 * live bridge set is reported.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E * (V + E)) over a full insertion sequence
 *   Space: O(V + E) for the current graph
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes present in the graph are BLUE.
 *   - The most recently inserted edge is YELLOW.
 *   - Confirmed bridges are RED.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Answers are always with respect to the edges inserted so far.
 *   - An edge is a bridge exactly when removing it increases the component
 *     count of the current graph.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Edge {
    id: string;
    u: string;
    v: string;
}

const other = (edge: Edge, node: string): string => (edge.u === node ? edge.v : edge.u);

function findBridges(nodes: string[], edges: Edge[]): Set<string> {
    const incident = new Map<string, string[]>();
    for (const node of nodes) {
        incident.set(node, []);
    }
    for (const edge of edges) {
        incident.get(edge.u)?.push(edge.id);
        incident.get(edge.v)?.push(edge.id);
    }
    const byId = new Map(edges.map((edge) => [edge.id, edge]));
    const tin = new Map<string, number>();
    const low = new Map<string, number>();
    const bridges = new Set<string>();
    let timer = 0;

    const visit = (node: string, parentEdge: string): void => {
        tin.set(node, timer);
        low.set(node, timer);
        timer += 1;
        for (const edgeId of incident.get(node) ?? []) {
            if (edgeId === parentEdge) {
                continue;
            }
            const edge = byId.get(edgeId);
            if (!edge) {
                continue;
            }
            const neighbor = other(edge, node);
            if (tin.has(neighbor)) {
                low.set(node, Math.min(low.get(node) as number, tin.get(neighbor) as number));
            } else {
                visit(neighbor, edgeId);
                low.set(node, Math.min(low.get(node) as number, low.get(neighbor) as number));
                if ((low.get(neighbor) as number) > (tin.get(node) as number)) {
                    bridges.add(edgeId);
                }
            }
        }
    };

    for (const node of nodes) {
        if (!tin.has(node)) {
            visit(node, "");
        }
    }
    return bridges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: Array<string | number>; edges?: Array<[string | number, string | number]> } | null) ?? {};
    const vertices = (task.vertices ?? [0, 1, 2, 3, 4, 5]).map((v) => String(v));
    const incoming: Array<[string, string]> = (task.edges ?? [
        [0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5], [5, 3],
    ]).map(([a, b]) => [String(a), String(b)]);

    let step = 0;
    const current: Edge[] = [];

    const frame = (description: string, newestId: string, bridges: Set<string>, codeLineNumber: number): VisualFrame => {
        const entities: VisualEntity[] = vertices.map((label) => ({
            id: `node-${label}`,
            type: "node" as const,
            label,
            value: label,
            state: "active" as const,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label },
        }));
        const edges: VisualEdge[] = current.map((edge) => ({
            id: edge.id,
            sourceId: `node-${edge.u}`,
            targetId: `node-${edge.v}`,
            label: "",
            state: bridges.has(edge.id) ? "path" : edge.id === newestId ? "comparing" : "idle",
            directed: false,
        }));
        return {
            stepNumber: step++,
            entities,
            edges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: { edgesAdded: current.length, bridgeCount: bridges.size },
        };
    };

    yield frame("Online bridge finding starts with an empty edge set.", "", new Set(), 0);

    for (const [a, b] of incoming) {
        const id = `edge-${a}-${b}`;
        current.push({ id, u: a, v: b });
        const bridges = findBridges(vertices, current);
        const isBridge = bridges.has(id);
        yield frame(
            `Inserted ${a}-${b}; it ${isBridge ? "is" : "is not"} a bridge. ${bridges.size} bridge(s) now.`,
            id,
            bridges,
            3,
        );
    }

    const finalBridges = findBridges(vertices, current);
    yield frame(
        `After ${current.length} insertions, ${finalBridges.size} bridge(s) remain.`,
        "",
        finalBridges,
        5,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A bridge is an edge whose removal would disconnect the graph. The online version watches the graph grow: every new edge might create a cycle, which destroys bridges on that cycle, or connect two separate pieces, which creates a bridge. After each arrival we recompute the bridge set and compare it with the previous answer.",
        invariants: [
            "The current edge set always contains exactly the edges inserted so far.",
            "An edge is in the reported bridge set only if removing it from the current graph raises the component count.",
            "Inserting an edge inside one connected component can never increase the number of bridges.",
        ],
        correctness:
            "The DFS low-link test marks a tree edge as a bridge precisely when its child subtree has no back edge to the parent or an ancestor, which is exactly the condition that removal disconnects that subtree. Re-running the test after every insertion therefore gives the correct bridge set at every point in the sequence.",
        complexityRationale:
            "Each of the E insertions triggers a DFS over the current graph costing O(V + E), so a full sequence costs O(E (V + E)). The current adjacency and DFS arrays occupy O(V + E) space.",
        uses: [
            "Network reliability monitoring as links are added",
            "Incremental connectivity and critical-link tracking",
            "Teaching dynamic graph invariants",
        ],
        references: [
            "Tarjan, A Fast Algorithm for Finding Bridges in a Graph, 1974",
            "cp-algorithms.com, Finding Bridges and Finding Bridges Online",
        ],
        workedExample:
            "Inserting 0-1, 1-2 and 2-0 forms a triangle with no bridges. Adding the link 2-3 joins a new vertex, so 2-3 becomes a bridge. Later adding 3-4, 4-5 and 5-3 forms a second triangle; the only remaining bridge is still 2-3.",
    },
    id: "bridges-online",
    name: "Online Bridge Finding",
    category: "graph",
    complexity: { time: "O(E (V + E))", space: "O(V + E)" },
    defaultInput: {
        vertices: [0, 1, 2, 3, 4, 5],
        edges: [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5], [5, 3]],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start with all vertices and no edges",
        "for each incoming edge in arrival order",
        "insert the edge into the current graph",
        "run a low-link DFS over the current edge set",
        "mark a tree edge as a bridge when its child cannot reach an ancestor",
        "report the bridge set after this insertion",
        "done: the final graph's bridge set is displayed",
    ],
};

export default module;
