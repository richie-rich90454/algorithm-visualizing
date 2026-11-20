/**
 * fifo-push-relabel.ts - FIFO Push-Relabel Maximum Flow
 *
 * The Goldberg-Tarjan preflow-push method with a first-in-first-out active
 * vertex queue. Vertices with excess are discharged in arrival order; each
 * discharge pushes along admissible arcs and relabels when no arc is
 * admissible. No gap or global heuristics are used.
 *
 * Time: O(V^3) with the FIFO rule. Space: O(V + E).
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeFlowNodes } from "./flow-util";

type Task = {
    vertices?: string[];
    edges?: Array<[string, string, number]>;
    source?: string;
    sink?: string;
};
type Arc = { to: number; cap: number; original: number; edgeIndex: number };

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const vertices = Array.isArray(task.vertices)
        ? [...task.vertices].map(String)
        : ["S", "A", "B", "T"];
    const edgeList: Array<[string, string, number]> = Array.isArray(task.edges)
        ? task.edges.map((e) => [String(e[0]), String(e[1]), Math.max(0, Math.floor(e[2]))])
        : [["S", "A", 3], ["S", "B", 2], ["A", "B", 1], ["A", "T", 2], ["B", "T", 3]];
    const sourceLabel = task.source ?? vertices[0] ?? "S";
    const sinkLabel = task.sink ?? vertices[vertices.length - 1] ?? "T";
    const index = new Map<string, number>();
    vertices.forEach((label, i) => index.set(label, i));
    const source = index.get(sourceLabel) ?? 0;
    const sink = index.get(sinkLabel) ?? vertices.length - 1;
    const n = vertices.length;

    const arcs: Arc[] = [];
    const adj: number[][] = vertices.map(() => []);
    edgeList.forEach(([u, v, cap], edgeIndex) => {
        const from = index.get(u);
        const to = index.get(v);
        if (from === undefined || to === undefined) {
            return;
        }
        adj[from]?.push(arcs.length);
        arcs.push({ to, cap, original: cap, edgeIndex });
        adj[to]?.push(arcs.length);
        arcs.push({ to: from, cap: 0, original: 0, edgeIndex });
    });

    const height = new Array<number>(n).fill(0);
    const excess = new Array<number>(n).fill(0);
    const current = new Array<number>(n).fill(0);
    const flow = new Array<number>(edgeList.length).fill(0);
    const nodes = makeFlowNodes(vertices);
    const frames: VisualFrame[] = [];
    let step = 0;
    let pushes = 0;
    let relabels = 0;

    const emit = (
        active: number,
        hotArc: number,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number | string | boolean> = {},
    ): void => {
        const edges: VisualEdge[] = edgeList.map(([u, v], i) => ({
            id: `edge-${i}`,
            sourceId: `node-${u}`,
            targetId: `node-${v}`,
            label: `${flow[i] ?? 0}/${arcs[i * 2]?.original ?? 0}`,
            state: i === hotArc ? "path" : "idle",
            directed: true,
        }));
        frames.push({
            stepNumber: step,
            entities: nodes.map((node, i) => ({
                ...node,
                label: `${vertices[i]} (h=${height[i]}, e=${excess[i]})`,
                state: i === active ? "comparing" : "unvisited",
            })),
            edges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: {
                maxFlow: Math.max(0, excess[sink] ?? 0),
                vertices: n,
                edges: edgeList.length,
                pushes,
                relabels,
                ...extra,
            },
        });
        step += 1;
    };

    if (n === 0 || source === sink) {
        emit(-1, -1, "Empty network or identical source and sink - flow is zero.", 0);
        yield* frames;
        return;
    }

    emit(-1, -1, `FIFO push-relabel on ${n} vertices and ${edgeList.length} arcs.`, 0);

    height[source] = n;
    for (const arcIndex of adj[source] ?? []) {
        const arc = arcs[arcIndex];
        if (!arc || arc.cap <= 0) {
            continue;
        }
        const amount = arc.cap;
        arc.cap = 0;
        const reverse = arcs[arcIndex ^ 1];
        if (reverse) {
            reverse.cap += amount;
        }
        excess[source] = (excess[source] ?? 0) - amount;
        excess[arc.to] = (excess[arc.to] ?? 0) + amount;
        if (arc.edgeIndex < flow.length && arcIndex % 2 === 0) {
            flow[arc.edgeIndex] = amount;
        }
        pushes += 1;
        emit(
            arc.to,
            arc.edgeIndex,
            `Preflow: saturated source arc to ${vertices[arc.to]} with ${amount}.`,
            2,
        );
    }

    const inQueue = new Array<boolean>(n).fill(false);
    const queue: number[] = [];
    const enqueue = (v: number): void => {
        if (v !== source && v !== sink && (excess[v] ?? 0) > 0 && !inQueue[v]) {
            inQueue[v] = true;
            queue.push(v);
        }
    };
    for (let v = 0; v < n; v += 1) {
        enqueue(v);
    }

    let guard = 0;
    while (queue.length > 0 && guard < 200000) {
        guard += 1;
        const u = queue.shift() as number;
        inQueue[u] = false;
        while ((excess[u] ?? 0) > 0 && (height[u] ?? 0) < 2 * n) {
            let pushed = false;
            while ((current[u] ?? 0) < (adj[u]?.length ?? 0)) {
                const arcIndex = adj[u]?.[current[u] ?? 0];
                const arc = arcIndex === undefined ? undefined : arcs[arcIndex];
                if (!arc) {
                    current[u] = (current[u] ?? 0) + 1;
                    continue;
                }
                if (arc.cap > 0 && (height[u] ?? 0) === (height[arc.to] ?? 0) + 1) {
                    const amount = Math.min(excess[u] ?? 0, arc.cap);
                    arc.cap -= amount;
                    const reverse = arcs[arcIndex ^ 1];
                    if (reverse) {
                        reverse.cap += amount;
                    }
                    excess[u] = (excess[u] ?? 0) - amount;
                    excess[arc.to] = (excess[arc.to] ?? 0) + amount;
                    if (arc.edgeIndex < flow.length && arcIndex % 2 === 0) {
                        flow[arc.edgeIndex] = (flow[arc.edgeIndex] ?? 0) + amount;
                    } else if (arc.edgeIndex < flow.length) {
                        flow[arc.edgeIndex] = (flow[arc.edgeIndex] ?? 0) - amount;
                    }
                    pushes += 1;
                    enqueue(arc.to);
                    emit(
                        u,
                        arc.edgeIndex,
                        `Pushed ${amount} from ${vertices[u]} to ${vertices[arc.to]} along an admissible arc.`,
                        4,
                    );
                    pushed = true;
                    if ((excess[u] ?? 0) === 0) {
                        break;
                    }
                } else {
                    current[u] = (current[u] ?? 0) + 1;
                }
            }
            if ((excess[u] ?? 0) === 0) {
                break;
            }
            let lowest = Infinity;
            for (const arcIndex of adj[u] ?? []) {
                const arc = arcs[arcIndex ?? -1];
                if (arc && arc.cap > 0) {
                    lowest = Math.min(lowest, height[arc.to] ?? 0);
                }
            }
            const oldHeight = height[u] ?? 0;
            height[u] = lowest === Infinity ? 2 * n : lowest + 1;
            current[u] = 0;
            relabels += 1;
            emit(
                u,
                -1,
                lowest === Infinity
                    ? `No residual arc from ${vertices[u]}; raised its label to ${height[u]} (disconnected).`
                    : `Relabeled ${vertices[u]} from ${oldHeight} to ${height[u]} to find a lower neighbor.`,
                6,
            );
            if (!pushed && lowest === Infinity) {
                break;
            }
            if ((excess[u] ?? 0) > 0) {
                enqueue(u);
            }
        }
    }

    emit(-1, -1, `Maximum flow is ${Math.max(0, excess[sink] ?? 0)} after ${pushes} pushes.`, 7, {
        maxFlow: Math.max(0, excess[sink] ?? 0),
    });
    yield* frames;
}

const module: AlgorithmModule = {
    id: "fifo-push-relabel",
    name: "FIFO Push-Relabel",
    category: "flow",
    complexity: { time: "O(V³)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["S", "A", "B", "T"],
        edges: [["S", "A", 3], ["S", "B", 2], ["A", "B", 1], ["A", "T", 2], ["B", "T", 3]],
        source: "S",
        sink: "T",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize heights and zero excess for every vertex",
        "set the source height to the vertex count and saturate its arcs",
        "enqueue every active vertex with positive excess",
        "pop the first active vertex from the queue",
        "push along an admissible arc while one exists",
        "if stuck, relabel above the lowest residual neighbor",
        "re-enqueue the vertex when it still holds excess",
        "report the excess collected at the sink as maximum flow",
    ],
    education: {
        intuition:
            "Push-relabel does not search for whole source-to-sink paths. It fills the network with a preflow, then lets vertices with too much incoming flow pass it downhill to neighbors whose height is exactly one lower. A vertex with excess but no downhill neighbor raises its own height until one appears.",
        invariants: [
            "Only vertices other than the source and sink may hold excess.",
            "Flow is only pushed to a neighbor whose height is one less than the sender's.",
            "Every vertex in the queue has positive excess at the moment it is inserted.",
        ],
        correctness:
            "When the algorithm ends, no vertex except the sink holds excess, so the preflow is a feasible flow. The source height is at least the vertex count and no path to the sink can remain unsaturated; otherwise a chain of decreasing heights would connect source to sink, contradicting the height bound. Hence the flow is maximum.",
        complexityRationale:
            "The FIFO rule performs O(V^2) relabels and O(V^3) pushes in the worst case; each operation updates one arc in O(1). Heights, excess, adjacency lists, and current-arc pointers use O(V + E) space.",
        uses: [
            "Maximum flow in dense networks",
            "Bipartite matching reductions",
            "A baseline for comparing push-relabel heuristics",
        ],
        references: [
            "Goldberg and Tarjan, A New Approach to the Maximum-Flow Problem, JACM 1988",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, max-flow chapter",
        ],
        workedExample:
            "On S-A cap 3, S-B cap 2, A-B cap 1, A-T cap 2, B-T cap 3, the preflow sends 3 to A and 2 to B. A pushes 2 to T and 1 to B; B then pushes 3 to T, so the sink holds 5 and no excess remains elsewhere.",
    },
};

export default module;
