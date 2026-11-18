/**
 * pregel.ts - Pregel: Vertex-Centric Bulk Synchronous Parallel Graph Processing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Pregel processes a graph in synchronized supersteps. In each superstep an
 * active vertex runs the same user program: it inspects messages received in
 * the previous superstep, updates its own value, sends messages along outgoing
 * edges, and then votes to halt. A vertex wakes up again if it receives a new
 * message. The computation stops when every vertex is halted and no messages
 * are in flight. This module runs the canonical single-source shortest-path
 * program: relax each edge with the sender's distance plus the edge weight.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(S * (V + E)) for S supersteps, V vertices, and E edges
 *   Space: O(V + E) for values, messages, and the graph
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are nodes; a node's value is its current tentative distance.
 *   - A vertex active in the current superstep is highlighted; halted ones
 *     are sorted-colored.
 *   - Edges carry the relaxation messages sent during the superstep.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface EdgeSpec { source: string; target: string; weight: number }
interface PregelInput {
    vertices?: string[];
    edges?: EdgeSpec[];
    source?: string;
    maxSupersteps?: number;
}

const INF = Number.POSITIVE_INFINITY;

/** Build vertex nodes for one frame. */
function makeVertices(
    vertices: string[],
    dist: Map<string, number>,
    active: Set<string>,
    phase: "idle" | "active" | "done",
): VisualEntity[] {
    return vertices.map((id, index) => {
        const d = dist.get(id) ?? INF;
        let state: EntityState = "idle";
        if (phase === "active") {
            state = active.has(id) ? "comparing" : "sorted";
        } else if (phase === "done") {
            state = "sorted";
        }
        return {
            id: `v-${id}`,
            type: "node" as const,
            label: `${id}:${Number.isFinite(d) ? d : "inf"}`,
            value: Number.isFinite(d) ? d : -1,
            state,
            x: Math.cos((2 * Math.PI * index) / vertices.length),
            y: Math.sin((2 * Math.PI * index) / vertices.length),
            width: 0,
            height: 0,
            metadata: { index, kind: "vertex", distance: Number.isFinite(d) ? d : -1 },
        };
    });
}

/** The Pregel single-source shortest-path generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PregelInput | null) ?? {};
    const vertices: string[] = Array.isArray(task.vertices)
        ? task.vertices.map(String)
        : ["A", "B", "C", "D", "E"];
    const edges: EdgeSpec[] = Array.isArray(task.edges)
        ? task.edges.map((e) => ({ source: String(e.source), target: String(e.target), weight: Number(e.weight) }))
        : [
              { source: "A", target: "B", weight: 4 },
              { source: "A", target: "C", weight: 2 },
              { source: "C", target: "B", weight: 1 },
              { source: "B", target: "D", weight: 5 },
              { source: "C", target: "D", weight: 8 },
              { source: "D", target: "E", weight: 2 },
          ];
    const source = String(task.source ?? vertices[0] ?? "A");
    const maxSupersteps = Math.max(1, Math.floor(Number(task.maxSupersteps ?? 10)) || 10);

    const dist = new Map<string, number>();
    for (const v of vertices) {
        dist.set(v, INF);
    }
    dist.set(source, 0);
    let active = new Set<string>([source]);
    let messages = new Map<string, number>();

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeVertices(vertices, dist, active, "idle"),
        edges: [],
        description: `Pregel initialized: source ${source} has distance 0; all other ${vertices.length - 1} vertices are at infinity.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { superstep: 0, distances: JSON.stringify(Object.fromEntries(dist)), active: [...active], messageCount: 0 },
    };
    step += 1;

    let superstep = 0;
    while (superstep < maxSupersteps && (active.size > 0 || messages.size > 0)) {
        superstep += 1;
        const running = new Set(active);
        for (const [target, incoming] of messages) {
            if (incoming < (dist.get(target) ?? INF)) {
                dist.set(target, incoming);
                running.add(target);
            }
        }

        const nextMessages = new Map<string, number>();
        const sentEdges: VisualEdge[] = [];
        for (const v of running) {
            const d = dist.get(v) ?? INF;
            for (const edge of edges) {
                if (edge.source !== v) {
                    continue;
                }
                const candidate = d + edge.weight;
                if (candidate < (dist.get(edge.target) ?? INF)) {
                    nextMessages.set(edge.target, Math.min(nextMessages.get(edge.target) ?? INF, candidate));
                    sentEdges.push({
                        id: `msg-${superstep}-${edge.source}-${edge.target}`,
                        sourceId: `v-${edge.source}`,
                        targetId: `v-${edge.target}`,
                        label: String(candidate),
                        state: "active",
                        directed: true,
                    });
                }
            }
        }

        yield {
            stepNumber: step,
            entities: makeVertices(vertices, dist, running, "active"),
            edges: sentEdges,
            description: `Superstep ${superstep}: ${running.size} vertex(es) ran the program on ${messages.size} message(s) and sent ${sentEdges.length} relaxation message(s).`,
            codeLineNumber: 2,
            layout: "point",
            meta: {
                superstep,
                distances: JSON.stringify(Object.fromEntries([...dist].map(([k, v]) => [k, Number.isFinite(v) ? v : -1]))),
                active: [...running],
                messageCount: messages.size,
                messagesSent: sentEdges.length,
            },
        };
        step += 1;

        messages = nextMessages;
        active = new Set(nextMessages.keys());
    }

    yield {
        stepNumber: step,
        entities: makeVertices(vertices, dist, new Set(), "done"),
        edges: [],
        description: `Converged after ${superstep} superstep(s): all vertices voted to halt and no messages remain.`,
        codeLineNumber: 6,
        layout: "point",
        meta: {
            superstep,
            distances: JSON.stringify(Object.fromEntries([...dist].map(([k, v]) => [k, Number.isFinite(v) ? v : -1]))),
            active: [],
            messageCount: 0,
            converged: messages.size === 0,
        },
    };
}

/** The Pregel module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Pregel runs the same little program on every vertex, one synchronized superstep at a time. A vertex can only read messages sent to it in the previous superstep, update its own state, and send new messages along its edges. When it has nothing left to do it votes to halt, but a new message wakes it up. The whole job ends when everyone is quiet.",
        invariants: [
            "Messages sent in a superstep are delivered only in the next superstep.",
            "A vertex's value never increases during a shortest-path relaxation.",
            "The computation halts only when no vertex is active and no messages are in flight.",
        ],
        correctness:
            "The vertex program is the Bellman-Ford relaxation: when a vertex receives a smaller distance, it lowers its own value and forwards the improved distance to each neighbor. After S supersteps, every path of at most S edges has been relaxed, so the distances equal the true shortest paths once no further improvement occurs. Because values only decrease and distances are drawn from a finite set of path lengths, the process terminates.",
        complexityRationale:
            "Each superstep examines all active vertices and their outgoing edges, costing O(V + E) in the worst case; with S supersteps the total is O(S (V + E)). State holds one value per vertex, the pending messages, and the graph, for O(V + E) space.",
        uses: [
            "Large-scale graph analytics such as PageRank and shortest paths",
            "Distributed graph processing in Pregel-compatible frameworks",
            "A teaching model for the bulk synchronous parallel programming style",
        ],
        references: [
            "Malewicz et al., Pregel: A System for Large-Scale Graph Processing, 2010",
            "Blelloch, Scatter/Gather: Scalable Graph Processing, 2010",
        ],
        workedExample:
            "On the graph A->B weight 4, A->C weight 2, C->B weight 1, with source A, superstep 1 sends distances B=4 and C=2. Superstep 2 relaxes C->B to 3 (better than 4) and B keeps 3. Superstep 3 finds no improvement, so all vertices vote to halt and the answer B=3, C=2 is final.",
    },
    id: "pregel",
    name: "Pregel (BSP Vertex-Centric Processing)",
    category: "parallel-distributed",
    complexity: { time: "O(S * (V + E))", space: "O(V + E)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D", "E"],
        edges: [
            { source: "A", target: "B", weight: 4 },
            { source: "A", target: "C", weight: 2 },
            { source: "C", target: "B", weight: 1 },
            { source: "B", target: "D", weight: 5 },
            { source: "C", target: "D", weight: 8 },
            { source: "D", target: "E", weight: 2 },
        ],
        source: "A",
        maxSupersteps: 10,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize every vertex value to infinity except the source",
        "place the source in the active set with distance zero",
        "while there are messages and supersteps remain",
        "each active vertex relaxes received messages into its value",
        "send the new distance along outgoing edges when it improves",
        "vote to halt when the vertex has no update",
        "advance to the next superstep with the new messages",
        "done: every vertex is halted and the distances are final",
    ],
};

export default module;
