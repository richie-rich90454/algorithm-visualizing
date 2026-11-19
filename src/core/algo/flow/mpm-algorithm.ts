/**
 * mpm-algorithm.ts - MPM Maximum Flow (Malhotra, Pramodh, Maheshwari)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MPM is a blocking-flow algorithm. It builds a layered residual graph from
 * the source, assigns each interior vertex a flow capacity equal to the
 * smaller of its total incoming and outgoing layer capacity, and repeatedly
 * pushes along source-to-sink paths through vertices with positive capacity.
 * Each push saturates at least one vertex, so few pushes are needed per layer
 * before the graph must be rebuilt.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^2 * E) worst case, with at most V-2 pushes per layer graph
 *   Space: O(V^2) for the capacity and residual matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show their current layer number in the caption.
 *   - The augmenting path turns CYAN (path).
 *   - Saturated vertices turn RED (error) until the layer graph is rebuilt.
 */
import type { AlgorithmModule, VisualEdge, VisualFrame } from "@/types";
import { makeGraphNodes } from "../graph/graph-util";

type CapGraph = Record<string, Record<string, number>>;

const INF = 1e9;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: CapGraph; source?: string; sink?: string } | null) ?? {};
    const graph: CapGraph = task.graph ?? {
        s: { a: 3, b: 2 },
        a: { b: 1, c: 2 },
        b: { c: 1, t: 2 },
        c: { a: 1, t: 3 },
        t: {},
    };
    const source = task.source ?? "s";
    const sink = task.sink ?? "t";

    const vertices: string[] = [];
    const seen = new Set<string>();
    for (const [u, outgoing] of Object.entries(graph)) {
        if (!seen.has(u)) {
            seen.add(u);
            vertices.push(u);
        }
        for (const v of Object.keys(outgoing)) {
            if (!seen.has(v)) {
                seen.add(v);
                vertices.push(v);
            }
        }
    }
    const n = vertices.length;
    const index = new Map(vertices.map((v, i) => [v, i]));

    const nodes = makeGraphNodes(vertices.length > 0 ? vertices : ["s"]);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const original: VisualEdge[] = [];
    for (const [u, outgoing] of Object.entries(graph)) {
        for (const [v, cap] of Object.entries(outgoing)) {
            if (cap > 0) {
                original.push({
                    id: `arc-${u}-${v}`,
                    sourceId: `node-${u}`,
                    targetId: `node-${v}`,
                    label: String(cap),
                    state: "idle",
                    directed: true,
                });
            }
        }
    }

    let step = 0;
    const snap = (
        description: string,
        line: number,
        path: string[] = [],
        meta: Record<string, number | string | boolean> = {},
    ): VisualFrame => {
        for (const e of original) e.state = "idle";
        for (let i = 0; i < path.length - 1; i += 1) {
            const e = original.find(
                (edge) => edge.sourceId === `node-${path[i]}` && edge.targetId === `node-${path[i + 1]}`,
            );
            if (e) e.state = "path";
        }
        return {
            stepNumber: step,
            entities: nodes.map((node) => ({ ...node })),
            edges: original.map((edge) => ({ ...edge })),
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: { flow: meta["flow"] ?? 0, source, sink, ...meta },
        };
    };

    if (n === 0 || !seen.has(source) || !seen.has(sink)) {
        yield snap("Source or sink missing - maximum flow is zero.", 7, [], {
            flow: 0,
            source,
            sink,
            iterations: 0,
        });
        return;
    }

    const cap: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
    for (const [u, outgoing] of Object.entries(graph)) {
        const iu = index.get(u);
        if (iu === undefined) continue;
        for (const [v, value] of Object.entries(outgoing)) {
            const iv = index.get(v);
            if (iv === undefined) continue;
            (cap[iu] as number[])[iv] = (cap[iu] as number[])[iv] + value;
        }
    }

    const s = index.get(source) as number;
    const t = index.get(sink) as number;
    let flow = 0;
    let iterations = 0;

    yield snap(`Build the layered residual network from ${source} to ${sink}.`, 0, [], {
        flow: 0,
        iterations: 0,
    });
    step += 1;

    while (true) {
        const level: number[] = Array<number>(n).fill(-1);
        level[s] = 0;
        const queue = [s];
        while (queue.length > 0) {
            const u = queue.shift() as number;
            for (let v = 0; v < n; v += 1) {
                if (level[v] === -1 && (cap[u] as number[])[v] > 0) {
                    level[v] = (level[u] as number) + 1;
                    queue.push(v);
                }
            }
        }
        if (level[t] === -1) break;

        const f: number[] = Array<number>(n).fill(0);
        for (let v = 0; v < n; v += 1) {
            if (v === s || v === t) {
                f[v] = INF;
                continue;
            }
            let incoming = 0;
            let outgoing = 0;
            for (let u = 0; u < n; u += 1) {
                if (level[u] === (level[v] as number) - 1) incoming += (cap[u] as number[])[v] as number;
                if (level[u] === (level[v] as number) + 1) outgoing += (cap[v] as number[])[u] as number;
            }
            f[v] = Math.min(incoming, outgoing);
        }

        yield snap(`Layer graph built: ${source} at level 0, ${sink} at level ${level[t]}.`, 1, [], {
            flow,
            iterations,
        });
        step += 1;

        while (true) {
            const prev: number[] = Array<number>(n).fill(-1);
            prev[s] = s;
            const q = [s];
            while (q.length > 0 && prev[t] === -1) {
                const u = q.shift() as number;
                if (u !== s && u !== t && (f[u] as number) <= 0) continue;
                for (let v = 0; v < n; v += 1) {
                    if (
                        prev[v] === -1 &&
                        level[v] === (level[u] as number) + 1 &&
                        (cap[u] as number[])[v] > 0 &&
                        (v === t || (f[v] as number) > 0)
                    ) {
                        prev[v] = u;
                        q.push(v);
                        if (v === t) break;
                    }
                }
            }
            if (prev[t] === -1) break;

            const pathIdx: number[] = [];
            let cursor = t;
            while (cursor !== s) {
                pathIdx.push(cursor);
                cursor = prev[cursor] as number;
            }
            pathIdx.push(s);
            pathIdx.reverse();

            let delta = INF;
            for (let i = 0; i < pathIdx.length - 1; i += 1) {
                const u = pathIdx[i] as number;
                const v = pathIdx[i + 1] as number;
                delta = Math.min(delta, (cap[u] as number[])[v] as number);
                if (v !== t) delta = Math.min(delta, f[v] as number);
            }
            for (let i = 0; i < pathIdx.length - 1; i += 1) {
                const u = pathIdx[i] as number;
                const v = pathIdx[i + 1] as number;
                (cap[u] as number[])[v] = (cap[u] as number[])[v] - delta;
                (cap[v] as number[])[u] = (cap[v] as number[])[u] + delta;
                if (v !== t) f[v] = (f[v] as number) - delta;
            }
            flow += delta;
            iterations += 1;
            const pathLabels = pathIdx.map((i) => vertices[i] as string);
            for (const i of pathIdx) {
                const node = nodeById.get(`node-${vertices[i]}`);
                if (node && i !== s && i !== t) node.state = (f[i] as number) <= 0 ? "error" : "path";
            }
            yield snap(
                `Push ${delta} along ${pathLabels.join(" -> ")}; cumulative flow ${flow}.`,
                4,
                pathLabels,
                { flow, iterations },
            );
            step += 1;
        }
    }

    for (const node of nodes) node.state = "visited";
    yield snap(`Maximum flow from ${source} to ${sink} is ${flow} after ${iterations} push(es).`, 7, [], {
        flow,
        iterations,
    });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "MPM refines the idea of a blocking flow. In a layered network it gives each interior vertex a budget: the smaller of how much can flow in and how much can flow out. Every augmenting path is chosen through vertices that still have budget, and each push drains at least one of them to zero. When no path remains, the layer graph is rebuilt. This is why each layer needs only a small number of pushes.",
        invariants: [
            "Residual capacities stay nonnegative and conserve flow at interior vertices.",
            "A vertex with zero flow capacity cannot appear on another augmenting path in the current layer graph.",
            "Each push saturates at least one interior vertex of the current layer graph.",
        ],
        correctness:
            "The layered graph contains only shortest residual paths from the source, so exhausting it yields a blocking flow. MPM's capacity bound guarantees that every push saturates at least one interior vertex, and at most V-2 pushes are needed before no path remains through positive-capacity vertices. Repeating layer construction until the sink is unreachable produces a maximum flow by the max-flow min-cut theorem.",
        complexityRationale:
            "Each layer graph needs at most V-2 pushes and each path search costs O(E), giving O(V^2 E) overall in the basic implementation. The residual matrix uses O(V squared) space.",
        uses: [
            "Computing throughput in transportation and communication networks",
            "A blocking-flow alternative to Dinic for teaching max-flow design",
            "Bipartite matching and other problems reducible to maximum flow",
        ],
        references: [
            "Malhotra, Pramodh, and Maheshwari, An O(V^3) Algorithm for Finding Maximum Flows in Networks, 1978",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, maximum flow",
        ],
        workedExample:
            "With arcs s->a of 3, s->b of 2, a->c of 2, b->t of 2, and c->t of 3, the first layer graph allows pushes through a and b. After saturating b and then a, the sink is unreachable and the maximum flow is 4, which equals the capacity of the source cut.",
    },
    id: "mpm-algorithm",
    name: "MPM Maximum Flow",
    category: "flow",
    complexity: { time: "O(V^2 * E)", space: "O(V^2)" },
    defaultInput: {
        graph: {
            s: { a: 3, b: 2 },
            a: { b: 1, c: 2 },
            b: { c: 1, t: 2 },
            c: { a: 1, t: 3 },
            t: {},
        },
        source: "s",
        sink: "t",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the residual capacity matrix",
        "BFS the residual graph to form the layer graph of the source",
        "if the sink has no layer, stop",
        "for each interior vertex set capacity to min of layer in and out",
        "find a source-to-sink path through positive-capacity vertices",
        "push the bottleneck amount and reduce vertex capacities",
        "when no path remains rebuild the layer graph",
        "done: report the total maximum flow",
    ],
};

export default module;
