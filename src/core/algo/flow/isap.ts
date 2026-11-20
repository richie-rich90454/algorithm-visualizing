/**
 * isap.ts - Improved Shortest Augmenting Path (Maximum Flow)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ISAP is Dinic's augmenting-path idea with one big improvement: instead of
 * rebuilding a level graph with BFS after every phase, it keeps exact
 * distance-to-sink labels and updates them locally as flow is pushed. A
 * current-arc pointer skips edges already known to be dead ends, and a gap
 * heuristic stops the search immediately when no vertex remains at some
 * distance level.
 *
 *   - dist[v] is the shortest residual distance from v to the sink.
 *   - An admissible edge satisfies dist[u] = dist[v] + 1.
 *   - When a distance level becomes empty, no augmenting path can exist.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^2 * E) worst case, usually far faster with the gap heuristic
 *   Space: O(V + E) for the residual arcs and distance counters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices show their current distance label.
 *   - Edges on the augmenting path are CYAN (path).
 *   - The final frame reports the maximum flow value.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeFlowNodes } from "./flow-util";

type Arc = { from: number; to: number; cap: number; original: number };

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            vertices?: string[];
            edges?: Array<[string, string, number]>;
            source?: string;
            sink?: string;
        } | null) ?? {};
    const vertices = task.vertices ?? ["S", "A", "B", "T"];
    const edgeList: Array<[string, string, number]> = task.edges ?? [
        ["S", "A", 3],
        ["S", "B", 2],
        ["A", "B", 1],
        ["A", "T", 2],
        ["B", "T", 3],
    ];
    const sourceLabel = task.source ?? "S";
    const sinkLabel = task.sink ?? "T";
    const index = new Map<string, number>();
    vertices.forEach((label, i) => index.set(label, i));
    const source = index.get(sourceLabel) ?? 0;
    const sink = index.get(sinkLabel) ?? vertices.length - 1;
    const n = vertices.length;
    const INF = n + edgeList.length + 1;

    const arcs: Arc[] = [];
    const adj: number[][] = vertices.map(() => []);
    for (const [u, v, rawCap] of edgeList) {
        const from = index.get(u);
        const to = index.get(v);
        if (from === undefined || to === undefined) {
            continue;
        }
        const capacity = Math.max(0, Math.floor(rawCap));
        adj[from].push(arcs.length);
        arcs.push({ from, to, cap: capacity, original: capacity });
        adj[to].push(arcs.length);
        arcs.push({ from: to, to: from, cap: 0, original: 0 });
    }

    const nodes = makeFlowNodes(vertices);
    const flowPerOriginal = new Array<number>(edgeList.length).fill(0);
    let step = 0;

    const frame = (
        highlighted: Set<number>,
        description: string,
        codeLineNumber: number,
        flow: number,
        extra: Record<string, number | string | boolean | number[]> = {},
    ): VisualFrame => {
        const edges: VisualEdge[] = edgeList.map(([u, v], i) => ({
            id: `edge-${i}`,
            sourceId: `node-${u}`,
            targetId: `node-${v}`,
            label: `${flowPerOriginal[i] ?? 0}/${arcs[i * 2]?.original ?? 0}`,
            state: highlighted.has(i) ? ("path" as const) : ("idle" as const),
            directed: true,
        }));
        return {
            stepNumber: step++,
            entities: nodes.map((node, i) => ({
                ...node,
                label: `${vertices[i]} (d=${dist[i] === INF ? "-" : dist[i]})`,
            })),
            edges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: { flow, vertices: n, edges: edgeList.length, ...extra },
        };
    };

    const dist = new Array<number>(n).fill(INF);
    const count = new Array<number>(INF + 1).fill(0);
    const current = new Array<number>(n).fill(0);

    /** Reverse BFS from the sink to initialize exact distance labels. */
    const computeDistances = (): void => {
        dist.fill(INF);
        count.fill(0);
        dist[sink] = 0;
        const queue = [sink];
        for (let head = 0; head < queue.length; head += 1) {
            const v = queue[head] as number;
            for (const arcIndex of adj[v] ?? []) {
                const reverse = arcIndex ^ 1;
                const predecessor = toOf(arcIndex);
                if ((arcs[reverse]?.cap ?? 0) > 0 && dist[predecessor] === INF) {
                    dist[predecessor] = dist[v] + 1;
                    queue.push(predecessor);
                }
            }
        }
        for (const d of dist) {
            if (d < INF) {
                count[d] = (count[d] ?? 0) + 1;
            }
        }
    };

    const toOf = (arcIndex: number): number => arcs[arcIndex]?.to ?? 0;

    if (source === sink) {
        yield frame(new Set(), "Source and sink are the same vertex; flow is zero.", 0, 0, {
            maxFlow: 0,
        });
        return;
    }

    computeDistances();
    yield frame(new Set(), "Initial reverse BFS set exact distances to the sink.", 1, 0);

    let totalFlow = 0;
    let iterations = 0;
    let gaps = 0;

    /** DFS along admissible arcs, recording the arcs of a successful augment. */
    const send = (u: number, limit: number, trail: number[]): number => {
        if (u === sink) {
            return limit;
        }
        const list = adj[u] ?? [];
        for (let i = current[u] ?? 0; i < list.length; i += 1) {
            current[u] = i;
            const arcIndex = list[i] as number;
            const arc = arcs[arcIndex];
            if (!arc || arc.cap <= 0 || (dist[arc.to] ?? INF) !== (dist[u] ?? INF) - 1) {
                continue;
            }
            const pushed = send(arc.to, Math.min(limit, arc.cap), trail);
            if (pushed > 0) {
                arc.cap -= pushed;
                const reverse = arcs[arcIndex ^ 1];
                if (reverse) {
                    reverse.cap += pushed;
                }
                trail.push(arcIndex);
                const original = Math.floor(arcIndex / 2);
                flowPerOriginal[original] = (flowPerOriginal[original] ?? 0) + pushed;
                return pushed;
            }
        }
        const level = dist[u] ?? INF;
        count[level] = (count[level] ?? 0) - 1;
        if (count[level] === 0 && level < n) {
            dist[source] = INF;
            gaps += 1;
            return 0;
        }
        dist[u] = level + 1;
        count[level + 1] = (count[level + 1] ?? 0) + 1;
        current[u] = 0;
        return 0;
    };

    const maxIterations = 100000;
    while ((dist[source] ?? INF) < INF && iterations < maxIterations) {
        iterations += 1;
        const trail: number[] = [];
        const pushed = send(source, 1e9, trail);
        if (pushed === 0) {
            if ((dist[source] ?? INF) >= INF) {
                yield frame(new Set(), "Gap heuristic closed the last distance level.", 4, totalFlow, {
                    gaps,
                    iterations,
                });
            }
            continue;
        }
        totalFlow += pushed;
        const highlighted = new Set(trail.map((arcIndex) => Math.floor(arcIndex / 2)));
        yield frame(
            highlighted,
            `Augmented ${pushed} unit(s) along a shortest path; flow is now ${totalFlow}.`,
            3,
            totalFlow,
            { gaps, iterations },
        );
    }

    yield frame(
        new Set(),
        `Maximum flow from ${sourceLabel} to ${sinkLabel} is ${totalFlow}.`,
        5,
        totalFlow,
        { maxFlow: totalFlow, gaps, iterations },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Dinic rebuilds a level graph after every blocking flow, which repeats work. ISAP instead keeps the exact distance from each vertex to the sink and updates a label only when that vertex runs out of useful outgoing edges. A pointer remembers how far each scan got, and when a whole distance level empties the algorithm knows no path can still reach the sink.",
        invariants: [
            "dist[v] is a valid lower bound on the shortest residual distance from v to the sink.",
            "An admissible edge always moves exactly one level closer to the sink.",
            "count[d] tracks how many vertices currently sit at level d.",
            "Flow conservation holds at every intermediate vertex after an augmentation.",
        ],
        correctness:
            "The initial reverse BFS gives exact distances. Each push follows admissible edges, so it follows a shortest residual path. When a vertex has no admissible edge, raising its label preserves validity because all residual neighbors have distance at least one more. If a level becomes empty, no path from the source to the sink can exist, so terminating is correct. By the augmenting-path theorem, exhausting all such paths yields a maximum flow.",
        complexityRationale:
            "Each relabel increases a distance to at most V, and the gap heuristic can end a phase early, giving a worst-case bound of O(V^2 E) with a current-arc implementation. Only residual arcs, distance labels, and counters are stored, which is O(V + E) space.",
        uses: [
            "Large-scale bipartite matching and assignment networks",
            "Network planning where incremental flow updates avoid repeated BFS",
            "A practical teaching counterpart to Dinic's level-graph approach",
        ],
        references: [
            "Ahuja, Magnanti, and Orlin, Network Flows, Chapter 7",
            "Goldberg, Two-Level Push-Relabel and the ISAP family, ACM Transactions on Algorithms",
        ],
        workedExample:
            "On S->A (3), S->B (2), A->B (1), A->T (2), B->T (3), the first shortest path is S-A-T carrying 2 units. The next is S-A-B-T carrying 1, then S-B-T carrying 2, for a maximum flow of 5, which saturates both edges leaving S.",
    },
    id: "isap",
    name: "Improved Shortest Augmenting Path (ISAP)",
    category: "flow",
    complexity: { time: "O(V^2 * E)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["S", "A", "B", "T"],
        edges: [
            ["S", "A", 3],
            ["S", "B", 2],
            ["A", "B", 1],
            ["A", "T", 2],
            ["B", "T", 3],
        ],
        source: "S",
        sink: "T",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build residual arcs with a reverse arc for each edge",
        "BFS backward from the sink to initialize dist[v]",
        "count vertices at each distance level",
        "start a DFS at the source with the current-arc pointer",
        "push along an arc when dist[u] = dist[v] + 1",
        "on success reduce and raise the reverse residual capacity",
        "if a vertex has no admissible arc, increment its label",
        "if a level empties, stop: no augmenting path remains",
        "report the accumulated flow when the source label overflows",
    ],
};

export default module;
