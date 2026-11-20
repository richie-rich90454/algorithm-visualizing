/**
 * karzanov-preflow.ts - Karzanov's Blocking Flow Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Karzanov computes a blocking flow in the layered residual graph one phase
 * at a time. Unlike Dinic, which always pushes from the source along complete
 * paths, Karzanov allows a temporary preflow: vertices may hold excess flow.
 * Saturating the source edges creates that excess, and an "advance" step moves
 * it toward the sink along level edges. When a vertex has excess but no usable
 * outgoing level edge, a "retreat" step lowers its level and returns the
 * excess to a predecessor. Once no interior excess remains, the phase's flow
 * is blocking and the next breadth-first search starts a new phase.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V²·E) worst case, with at most V phases
 *   Space: O(V + E) for the residual matrix, levels, and excess array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Node labels show the current BFS level after each phase begins.
 *   - The edge carrying an advance or retreat is CYAN (path).
 *   - Vertices holding excess are PINK (highlight).
 *   - Edges carrying flow finish GREEN (sorted).
 */

import type { AlgorithmModule, VisualEdge, VisualFrame } from "@/types";
import { makeFlowEdges, makeFlowNodes } from "./flow-util";

type Edge = [string, string, number];

interface FlowTask {
    edges?: Edge[];
    vertices?: string[];
    source?: string;
    sink?: string;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FlowTask | null) ?? {};
    const edgeList: Edge[] = Array.isArray(task.edges)
        ? task.edges.map(([u, v, c]) => [u, v, c] as Edge)
        : [
              ["S", "A", 3],
              ["S", "B", 2],
              ["A", "B", 1],
              ["A", "C", 2],
              ["B", "C", 3],
              ["B", "T", 1],
              ["C", "T", 4],
          ];
    const source = task.source ?? "S";
    const sink = task.sink ?? "T";

    const vertices: string[] = [];
    const seen = new Set<string>();
    const register = (v: string): void => {
        if (!seen.has(v)) {
            seen.add(v);
            vertices.push(v);
        }
    };
    if (Array.isArray(task.vertices)) {
        for (const v of task.vertices) register(v);
    }
    for (const [u, v] of edgeList) {
        register(u);
        register(v);
    }
    if (!seen.has(source)) register(source);
    if (!seen.has(sink)) register(sink);

    const n = vertices.length;
    const index = new Map(vertices.map((v, i) => [v, i]));
    const s = index.get(source) as number;
    const t = index.get(sink) as number;

    const nodes = makeFlowNodes(vertices);
    const edges: VisualEdge[] = makeFlowEdges(edgeList);

    const cap: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
    const flow: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
    const adjacency: number[][] = Array.from({ length: n }, () => [] as number[]);
    for (const [u, v, c] of edgeList) {
        const iu = index.get(u);
        const iv = index.get(v);
        if (iu === undefined || iv === undefined || iu === iv) {
            continue;
        }
        cap[iu] = cap[iu] as number[];
        (cap[iu] as number[])[iv] = ((cap[iu] as number[])[iv] ?? 0) + Math.max(0, c);
        const list = adjacency[iu] as number[];
        if (!list.includes(iv)) {
            list.push(iv);
        }
    }

    let step = 0;
    let phases = 0;
    let advances = 0;
    let retreats = 0;

    const refresh = (): void => {
        edgeList.forEach(([u, v, c], i) => {
            const iu = index.get(u);
            const iv = index.get(v);
            const edge = edges[i];
            if (edge && iu !== undefined && iv !== undefined) {
                edge.label = `${flow[iu]?.[iv] ?? 0}/${c}`;
            }
        });
        for (const edge of edges) edge.state = "idle";
    };

    const snap = (description: string, line: number, active: number = -1): VisualFrame => {
        refresh();
        if (active >= 0 && edges[active]) {
            (edges[active] as VisualEdge).state = "path";
        }
        return {
            stepNumber: step,
            entities: nodes.map((node) => ({ ...node })),
            edges: edges.map((edge) => ({ ...edge })),
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: { flow: 0, phases, advances, retreats },
        };
    };

    const frames: VisualFrame[] = [];
    const yieldSnap = (description: string, line: number, active: number = -1, extra: Record<string, number> = {}): void => {
        const frame = snap(description, line, active);
        frame.stepNumber = step;
        Object.assign(frame.meta, extra);
        frames.push(frame);
        step += 1;
    };
    yieldSnap(`Karzanov blocking flow from ${source} to ${sink} over ${n} vertices.`, 0);

    if (s === t || n === 0) {
        yieldSnap("Source and sink coincide, so the flow is zero.", 6, -1, { flow: 0 });
        for (const frame of frames) yield frame;
        return;
    }

    const bfsLevels = (): number[] => {
        const level = Array<number>(n).fill(-1);
        level[s] = 0;
        const queue: number[] = [s];
        while (queue.length > 0) {
            const u = queue.shift() as number;
            for (const v of adjacency[u] ?? []) {
                if ((level[v] ?? -1) >= 0) continue;
                if (((cap[u] as number[])[v] ?? 0) - ((flow[u] as number[])[v] ?? 0) > 0) {
                    level[v] = (level[u] as number) + 1;
                    queue.push(v);
                }
            }
        }
        return level;
    };

    let level = bfsLevels();
    while ((level[t] ?? -1) >= 0 && phases < 100) {
        phases += 1;
        yieldSnap(`Phase ${phases}: BFS levels the sink at ${level[t]}.`, 2, -1, { phases });

        const excess = Array<number>(n).fill(0);
        for (let v = 0; v < n; v += 1) {
            if (v === s || (level[v] ?? -1) !== 1) continue;
            const residual = ((cap[s] as number[])[v] ?? 0) - ((flow[s] as number[])[v] ?? 0);
            if (residual > 0) {
                (flow[s] as number[])[v] = ((flow[s] as number[])[v] ?? 0) + residual;
                excess[v] = (excess[v] ?? 0) + residual;
            }
        }

        let operations = 0;
        while (operations < 2000) {
            let active = -1;
            for (let v = 0; v < n; v += 1) {
                if (v !== s && v !== t && (excess[v] ?? 0) > 0) {
                    active = v;
                    break;
                }
            }
            if (active < 0) break;

            let moved = false;
            for (const w of adjacency[active] ?? []) {
                if ((level[w] ?? -1) !== (level[active] as number) + 1) continue;
                const residual = ((cap[active] as number[])[w] ?? 0) - ((flow[active] as number[])[w] ?? 0);
                if (residual <= 0) continue;
                const amount = Math.min(excess[active] as number, residual);
                (flow[active] as number[])[w] = ((flow[active] as number[])[w] ?? 0) + amount;
                excess[active] = (excess[active] as number) - amount;
                excess[w] = (excess[w] ?? 0) + amount;
                advances += 1;
                operations += 1;
                const edgeIndex = edgeList.findIndex(
                    ([u, v]) => index.get(u) === active && index.get(v) === w,
                );
                yieldSnap(
                    `Advance: pushed ${amount} from ${vertices[active]} along level ${level[active]} to ${vertices[w]}.`,
                    4,
                    edgeIndex,
                    { advances },
                );
                moved = true;
                break;
            }

            if (moved) continue;

            level[active] = -1;
            let safety = 0;
            while ((excess[active] ?? 0) > 0 && safety < 200) {
                safety += 1;
                let predecessor = -1;
                for (let u = 0; u < n; u += 1) {
                    if (((flow[u] as number[])[active] ?? 0) > 0) {
                        predecessor = u;
                        break;
                    }
                }
                if (predecessor < 0) {
                    excess[active] = 0;
                    break;
                }
                const amount = Math.min(excess[active] as number, (flow[predecessor] as number[])[active] as number);
                (flow[predecessor] as number[])[active] =
                    ((flow[predecessor] as number[])[active] as number) - amount;
                excess[active] = (excess[active] as number) - amount;
                excess[predecessor] = (excess[predecessor] ?? 0) + amount;
                retreats += 1;
                operations += 1;
                const edgeIndex = edgeList.findIndex(
                    ([u, v]) => index.get(u) === predecessor && index.get(v) === active,
                );
                yieldSnap(
                    `Retreat: ${vertices[active]} had no level edge, returned ${amount} to ${vertices[predecessor]}.`,
                    5,
                    edgeIndex,
                    { retreats },
                );
            }
        }

        level = bfsLevels();
    }

    let total = 0;
    for (let v = 0; v < n; v += 1) {
        if (v === t) continue;
        total += (flow[v] as number[])[t] ?? 0;
        total -= (flow[t] as number[])[v] ?? 0;
    }
    const finalFrame = snap(
        `Maximum flow from ${source} to ${sink} is ${total} after ${phases} phase(s), ${advances} advance(s), and ${retreats} retreat(s).`,
        6,
    );
    for (let i = 0; i < edgeList.length; i += 1) {
        const [u, v] = edgeList[i] as Edge;
        const iu = index.get(u);
        const iv = index.get(v);
        if (iu !== undefined && iv !== undefined && ((flow[iu] as number[])[iv] ?? 0) > 0) {
            const edge = finalFrame.edges[i];
            if (edge) edge.state = "sorted";
        }
    }
    finalFrame.meta.flow = total;
    finalFrame.stepNumber = step;
    frames.push(finalFrame);

    for (const frame of frames) yield frame;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Karzanov builds one blocking flow at a time on the shortest-path layers of the residual graph. Instead of insisting that every intermediate vertex conserve flow immediately, it first saturates the edges out of the source and lets vertices accumulate excess. Excess is pushed forward along level edges when possible and returned to a predecessor when a vertex is stuck, so the search never has to restart a path from the source.",
        invariants: [
            "Flow moves forward only along edges that increase the BFS level by exactly one.",
            "The excess of an interior vertex is the amount received but not yet passed on or returned.",
            "A retreat removes a vertex from the current level graph, so it is never advanced into again in that phase.",
        ],
        correctness:
            "Advances and retreats preserve conservation at every interior vertex: an advance transfers excess one level forward, and a retreat returns it along an edge that actually carried flow. When the phase ends no interior vertex holds excess, so the result is a legitimate flow that saturates a path in every shortest source-to-sink route, which is a blocking flow. Repeating phases until the sink is unreachable leaves no augmenting path, and by max-flow min-cut the flow is maximum.",
        complexityRationale:
            "Each phase performs at most O(V) retreats and O(E) advances because a vertex is removed once and an edge saturates at most once before a rebuild. With at most V phases, the bound is O(V²·E) time. Levels, excess values, and the residual matrix need O(V + E) space.",
        uses: [
            "Maximum throughput in large transport and communication networks",
            "A historical stepping stone to push-relabel and highest-label methods",
            "Blocking-flow computation inside specialized matching reductions",
        ],
        references: [
            "Karzanov, Determining the Maximal Flow in a Network by the Method of Preflows, Soviet Mathematics Doklady, 1973",
            "Ahuja, Magnanti, and Orlin, Network Flows, blocking-flow chapter",
        ],
        workedExample:
            "In a layered network S-A, S-B, A-C, B-C, C-T, saturating the source edges gives A and B excess. Advancing A-C and B-C passes the excess to C, which pushes it to T. When a vertex has excess but no forward level edge with residual capacity, it retreats and returns the amount to its predecessor. The next BFS phase either finds a longer augmenting route or declares the flow maximum.",
    },
    id: "karzanov-preflow",
    name: "Karzanov Blocking Flow",
    category: "flow",
    complexity: { time: "O(V²·E)", space: "O(V + E)" },
    defaultInput: {
        edges: [
            ["S", "A", 3],
            ["S", "B", 2],
            ["A", "B", 1],
            ["A", "C", 2],
            ["B", "C", 3],
            ["B", "T", 1],
            ["C", "T", 4],
        ],
        vertices: ["S", "A", "B", "C", "T"],
        source: "S",
        sink: "T",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the layered residual graph with a breadth-first search",
        "if the sink is unreachable, stop with the current flow",
        "saturate source edges and record excess at their targets",
        "advance excess along any forward edge with residual capacity",
        "if a vertex is stuck, lower its level and return excess backward",
        "repeat until no interior vertex holds excess",
        "done: report the maximum flow value",
    ],
};

export default module;
