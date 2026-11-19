/**
 * gap-relabel-heuristic.ts - Gap Heuristic for Push-Relabel
 *
 * A FIFO discharge order combined with the gap heuristic: whenever a height
 * level becomes empty, no vertex above that level can reach the sink, so every
 * such vertex is raised to the source height in one sweep. This removes a
 * whole layer of futile relabeling work.
 *
 * Time: O(V^3) in the worst case, much less with successful gap detection.
 * Space: O(V + E).
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
        : [["S", "A", 4], ["S", "B", 3], ["A", "B", 2], ["A", "T", 3], ["B", "T", 4]];
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
    const levelCount = new Array<number>(2 * n + 2).fill(0);
    for (let v = 0; v < n; v += 1) {
        levelCount[v === source ? n : 0] = (levelCount[v === source ? n : 0] ?? 0) + 1;
    }
    const nodes = makeFlowNodes(vertices);
    const frames: VisualFrame[] = [];
    let step = 0;
    let pushes = 0;
    let relabels = 0;
    let gaps = 0;

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
                gaps,
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

    emit(-1, -1, `Push-relabel with the gap heuristic on ${n} vertices.`, 0);
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
            const newHeight = lowest === Infinity ? 2 * n : lowest + 1;
            levelCount[oldHeight] = (levelCount[oldHeight] ?? 0) - 1;
            levelCount[newHeight] = (levelCount[newHeight] ?? 0) + 1;
            height[u] = newHeight;
            current[u] = 0;
            relabels += 1;
            emit(u, -1, `Relabeled ${vertices[u]} from ${oldHeight} to ${newHeight}.`, 5);

            if ((levelCount[oldHeight] ?? 0) === 0 && oldHeight > 0 && oldHeight < n) {
                let lifted = 0;
                for (let v = 0; v < n; v += 1) {
                    if (v === source || v === sink || (height[v] ?? 0) <= oldHeight) {
                        continue;
                    }
                    levelCount[height[v] ?? 0] = (levelCount[height[v] ?? 0] ?? 0) - 1;
                    height[v] = n;
                    levelCount[n] = (levelCount[n] ?? 0) + 1;
                    lifted += 1;
                }
                if (lifted > 0) {
                    gaps += 1;
                    emit(
                        u,
                        -1,
                        `Gap at height ${oldHeight}: raised ${lifted} unreachable vertex label(s) to ${n}.`,
                        6,
                        { gapLevel: oldHeight, lifted },
                    );
                }
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
    id: "gap-relabel-heuristic",
    name: "Gap Relabel Heuristic",
    category: "flow",
    complexity: { time: "O(V³)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["S", "A", "B", "T"],
        edges: [["S", "A", 4], ["S", "B", 3], ["A", "B", 2], ["A", "T", 3], ["B", "T", 4]],
        source: "S",
        sink: "T",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize heights, excess, and a count per height level",
        "saturate source arcs to build the initial preflow",
        "discharge active vertices in first-in-first-out order",
        "push flow to a neighbor exactly one level lower",
        "when stuck, relabel above the lowest residual neighbor",
        "if an entire height level is empty, lift all vertices above it",
        "continue until no active vertex holds excess",
        "report the sink excess as the maximum flow",
    ],
    education: {
        intuition:
            "Height labels approximate distance to the sink. If no vertex remains at some intermediate height, the labels above it form a disconnected plateau: none of those vertices can deliver flow to the sink. The gap heuristic notices the empty level and lifts every vertex on that plateau in one pass instead of relabeling them one by one.",
        invariants: [
            "The level-count table always equals the number of non-source, non-sink vertices at each height.",
            "Lifting a vertex above an empty level preserves the validity of the height function.",
            "Admissible pushes still go only to a neighbor one level lower.",
        ],
        correctness:
            "A height function remains valid when a vertex is raised to a level above an empty gap because no residual path can cross the gap at the old height. Raising all affected vertices therefore only removes dead ends. With a valid height function and no active excess, the standard push-relabel termination argument gives a maximum flow.",
        complexityRationale:
            "The queue-based discharge costs O(V^3) pushes in the worst case; each relabel updates two counters and gap detection scans all vertices once per empty level. Heights, counters, residual arcs, and queue entries take O(V + E) space.",
        uses: [
            "Accelerating push-relabel on dense flow networks",
            "Maximum-flow solvers in combinatorial optimization libraries",
            "Teaching the role of label maintenance in preflow algorithms",
        ],
        references: [
            "Goldberg and Tarjan, A New Approach to the Maximum-Flow Problem, JACM 1988",
            "Ahuja, Magnanti, and Orlin, Network Flows, push-relabel heuristics chapter",
        ],
        workedExample:
            "If heights 0, 1, 2, 4 are occupied and level 3 becomes empty, every vertex at height 4 cannot reach the sink with the current residual graph. The heuristic sets those heights to the source height, so their excess is returned toward the source rather than relabeled one step at a time.",
    },
};

export default module;
