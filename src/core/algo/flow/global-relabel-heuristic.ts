/**
 * global-relabel-heuristic.ts - Global Relabel Heuristic
 *
 * Push-relabel with periodic exact distance labels. A reverse BFS from the
 * sink over the current residual graph computes the true distance of every
 * vertex to the sink; any label larger than that distance is lowered. The
 * BFS is repeated after a fixed number of relabels, which keeps the heights
 * near reality and avoids long sequences of local, nearly useless relabels.
 *
 * Time: O(V^3) worst case, with extra O(V + E) per BFS pass.
 * Space: O(V + E).
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeFlowNodes } from "./flow-util";

type Task = {
    vertices?: string[];
    edges?: Array<[string, string, number]>;
    source?: string;
    sink?: string;
    period?: number;
};
type Arc = { to: number; cap: number; original: number; edgeIndex: number };

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const vertices = Array.isArray(task.vertices)
        ? [...task.vertices].map(String)
        : ["S", "A", "B", "C", "T"];
    const edgeList: Array<[string, string, number]> = Array.isArray(task.edges)
        ? task.edges.map((e) => [String(e[0]), String(e[1]), Math.max(0, Math.floor(e[2]))])
        : [
              ["S", "A", 5], ["S", "B", 4], ["A", "B", 2], ["A", "C", 3],
              ["B", "C", 4], ["C", "T", 6], ["B", "T", 3],
          ];
    const sourceLabel = task.source ?? vertices[0] ?? "S";
    const sinkLabel = task.sink ?? vertices[vertices.length - 1] ?? "T";
    const index = new Map<string, number>();
    vertices.forEach((label, i) => index.set(label, i));
    const source = index.get(sourceLabel) ?? 0;
    const sink = index.get(sinkLabel) ?? vertices.length - 1;
    const n = vertices.length;
    const period = Math.max(1, Math.floor(task.period ?? Math.max(1, n)));

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
    let globalPasses = 0;

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
                globalPasses,
                ...extra,
            },
        });
        step += 1;
    };

    const globalRelabel = (reason: string): void => {
        const dist = new Array<number>(n).fill(Infinity);
        dist[sink] = 0;
        const queue = [sink];
        for (let head = 0; head < queue.length; head += 1) {
            const x = queue[head] as number;
            for (let a = 0; a < arcs.length; a += 1) {
                const arc = arcs[a];
                if (!arc || arc.to !== x || arc.cap <= 0) {
                    continue;
                }
                const predecessor = arcs[a ^ 1]?.to;
                if (predecessor === undefined || dist[predecessor] !== Infinity) {
                    continue;
                }
                dist[predecessor] = (dist[x] ?? 0) + 1;
                queue.push(predecessor);
            }
        }
        let lowered = 0;
        for (let v = 0; v < n; v += 1) {
            if (v === source || dist[v] === Infinity) {
                continue;
            }
            if ((dist[v] ?? 0) < (height[v] ?? 0)) {
                height[v] = dist[v];
                lowered += 1;
            }
        }
        globalPasses += 1;
        emit(
            -1,
            -1,
            `Global relabel (${reason}): ${lowered} height(s) lowered to exact residual distances.`,
            6,
            { lowered, reachable: queue.length },
        );
    };

    if (n === 0 || source === sink) {
        emit(-1, -1, "Empty network or identical source and sink - flow is zero.", 0);
        yield* frames;
        return;
    }

    emit(-1, -1, `Push-relabel with global relabeling every ${period} relabel(s).`, 0);
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
        emit(arc.to, arc.edgeIndex, `Preflow saturated the source arc into ${vertices[arc.to]}.`, 2);
    }
    globalRelabel("initial preflow");

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

    let relabelsSincePass = 0;
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
                    emit(u, arc.edgeIndex, `Pushed ${amount} from ${vertices[u]} to ${vertices[arc.to]}.`, 4);
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
            relabelsSincePass += 1;
            emit(u, -1, `Relabeled ${vertices[u]} from ${oldHeight} to ${height[u]}.`, 5);
            if (relabelsSincePass >= period) {
                relabelsSincePass = 0;
                globalRelabel("relabel threshold");
            }
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
    id: "global-relabel-heuristic",
    name: "Global Relabel Heuristic",
    category: "flow",
    complexity: { time: "O(V³)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["S", "A", "B", "C", "T"],
        edges: [
            ["S", "A", 5], ["S", "B", 4], ["A", "B", 2], ["A", "C", 3],
            ["B", "C", 4], ["C", "T", 6], ["B", "T", 3],
        ],
        source: "S",
        sink: "T",
        period: 5,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize residual arcs and zero heights and excess",
        "saturate source arcs to form the preflow",
        "run a reverse BFS from the sink over residual arcs",
        "lower every height that exceeds its exact residual distance",
        "discharge active vertices in first-in-first-out order",
        "push along admissible arcs and relabel when stuck",
        "repeat the reverse BFS after a fixed number of relabels",
        "report the flow accumulated at the sink",
    ],
    education: {
        intuition:
            "Local relabels only look at neighbors, so labels can drift far from the real distance to the sink. A reverse breadth-first search from the sink reveals the true residual distance of every vertex. Resetting labels to those distances periodically gives pushes a reliable downhill direction again.",
        invariants: [
            "After a global relabel pass every finite label is at most the true residual distance to the sink.",
            "The source label stays at the vertex count and is never lowered.",
            "Pushes still require the sender's height to be exactly one above the receiver's.",
        ],
        correctness:
            "Breadth-first search on reversed residual arcs computes shortest distances because every arc has unit length in the level graph. Lowering a label to that distance cannot create an inadmissible push, since the height function condition only needs h(u) to be at most h(v)+1 for residual arcs. Hence all later pushes remain valid and the usual preflow-push termination proof applies.",
        complexityRationale:
            "Each reverse BFS scans all residual arcs in O(V + E). With a pass every V relabels the asymptotic bound remains O(V^3) pushes, and heights, distances, residual arcs, and queue storage require O(V + E) space.",
        uses: [
            "High-performance maximum-flow solvers",
            "Min-cut computations in image segmentation",
            "Flow subroutines in network interdiction and scheduling",
        ],
        references: [
            "Goldberg, Tsioutsiouliklis, and Zhu, The Global-Relabel Heuristic for Maximum Flow, 2002",
            "Ahuja, Magnanti, and Orlin, Network Flows, 1993",
        ],
        workedExample:
            "On a five-vertex network, local relabels may leave a vertex with height six while its shortest residual route to the sink is two arcs. A reverse BFS from the sink assigns it distance two; lowering the label to two immediately makes an admissible arc toward the sink available.",
    },
};

export default module;
