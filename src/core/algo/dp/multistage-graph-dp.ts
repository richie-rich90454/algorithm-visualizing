/**
 * multistage-graph-dp.ts - Multistage Graph (Backward DP)
 *
 * A multistage graph is a weighted DAG whose vertices are arranged in stages,
 * with edges only from one stage to the next. The shortest path from the start
 * to the finish is found by a backward dynamic program: the cost of a vertex
 * is the minimum over its outgoing edges of edge weight plus successor cost.
 *
 * Time: O(V + E). Space: O(V + E) for the graph and the DP table.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualEdge, VisualFrame } from "@/types";

type WeightedEdge = [number, number, number];

interface NodeInfo {
    nodes: number[];
    adjacency: Map<number, Array<{ to: number; weight: number }>>;
    order: number[];
}

/** Topologically order the DAG so the backward DP reads final successor costs. */
function prepare(edges: WeightedEdge[]): NodeInfo {
    const nodes = new Set<number>();
    const adjacency = new Map<number, Array<{ to: number; weight: number }>>();
    const indegree = new Map<number, number>();
    for (const [u, v, weight] of edges) {
        nodes.add(u);
        nodes.add(v);
        if (!adjacency.has(u)) adjacency.set(u, []);
        adjacency.get(u)?.push({ to: v, weight });
        indegree.set(v, (indegree.get(v) ?? 0) + 1);
    }
    const queue = [...nodes].filter((n) => (indegree.get(n) ?? 0) === 0);
    const order: number[] = [];
    while (queue.length > 0) {
        const u = queue.shift();
        if (u === undefined) break;
        order.push(u);
        for (const { to } of adjacency.get(u) ?? []) {
            const left = (indegree.get(to) ?? 0) - 1;
            indegree.set(to, left);
            if (left === 0) queue.push(to);
        }
    }
    for (const n of nodes) if (!order.includes(n)) order.push(n);
    return { nodes: [...nodes], adjacency, order };
}

function makeEntities(
    info: NodeInfo,
    edges: WeightedEdge[],
    cost: Map<number, number>,
    computed: Set<number>,
    activeNode: number,
    pathEdges: Set<string>,
): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = info.nodes.map((n) => {
        let state: EntityState = "idle";
        if (pathEdges.size > 0) {
            state = computed.has(n) ? "path" : "idle";
        } else if (computed.has(n)) {
            state = n === activeNode ? "comparing" : "visited";
        }
        return {
            id: `node-${n}`,
            type: "node" as const,
            label: String(n),
            value: n,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { node: n, cost: cost.get(n) ?? 0 },
        };
    });
    const visualEdges: VisualEdge[] = edges.map(([u, v, w]) => {
        const key = `${u}-${v}`;
        let state: EntityState = "idle";
        if (pathEdges.has(key)) state = "path";
        else if (u === activeNode && pathEdges.size === 0) state = "active";
        return {
            id: `edge-${u}-${v}`,
            sourceId: `node-${u}`,
            targetId: `node-${v}`,
            label: String(w),
            state,
            directed: true,
        };
    });
    return { entities, edges: visualEdges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { edges?: WeightedEdge[]; source?: number; sink?: number } | null) ?? {};
    const edges: WeightedEdge[] = Array.isArray(task.edges) && task.edges.length > 0
        ? task.edges
              .filter((e) => Array.isArray(e) && e.length >= 3)
              .map((e) => [Number(e[0]), Number(e[1]), Number(e[2])] as WeightedEdge)
        : [
              [0, 1, 2], [0, 2, 5], [0, 3, 1],
              [1, 4, 4], [1, 5, 7], [2, 4, 2], [2, 5, 3],
              [3, 5, 6], [4, 6, 3], [5, 6, 2],
          ];
    const info = prepare(edges);
    const source = typeof task.source === "number" ? task.source : (info.nodes[0] ?? 0);
    const sink = typeof task.sink === "number" ? task.sink : (info.nodes[info.nodes.length - 1] ?? 0);
    const cost = new Map<number, number>();
    const next = new Map<number, number>();
    const computed = new Set<number>();
    cost.set(sink, 0);
    computed.add(sink);
    let step = 0;

    const start = makeEntities(info, edges, cost, computed, -1, new Set());
    yield {
        stepNumber: step,
        entities: start.entities,
        edges: start.edges,
        description: `Backward DP on a ${info.nodes.length}-vertex staged graph; cost(${sink}) is initialized to zero.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { source, sink, answer: 0, path: [] },
    };
    step += 1;

    for (let idx = info.order.length - 1; idx >= 0; idx -= 1) {
        const u = info.order[idx];
        if (u === undefined || u === sink) continue;
        let best = Number.POSITIVE_INFINITY;
        let bestTo = -1;
        for (const { to, weight } of info.adjacency.get(u) ?? []) {
            const successor = cost.get(to) ?? Number.POSITIVE_INFINITY;
            if (successor === Number.POSITIVE_INFINITY) continue;
            const candidate = weight + successor;
            if (candidate < best) {
                best = candidate;
                bestTo = to;
            }
        }
        cost.set(u, best === Number.POSITIVE_INFINITY ? 1e15 : best);
        if (bestTo >= 0) next.set(u, bestTo);
        computed.add(u);
        const picture = makeEntities(info, edges, cost, computed, u, new Set());
        yield {
            stepNumber: step,
            entities: picture.entities,
            edges: picture.edges,
            description: `cost(${u}) = ${cost.get(u)} via the cheapest outgoing edge to ${bestTo} plus its successor cost.`,
            codeLineNumber: 3,
            layout: "graph",
            meta: { source, sink, answer: 0, path: [], vertex: u, cost: cost.get(u) ?? 0 },
        };
        step += 1;
    }

    const path: number[] = [];
    const pathEdges = new Set<string>();
    let cursor = source;
    const guard = info.nodes.length + 1;
    while (cursor !== sink && path.length < guard) {
        path.push(cursor);
        const to = next.get(cursor);
        if (to === undefined || to < 0) break;
        pathEdges.add(`${cursor}-${to}`);
        cursor = to;
    }
    if (cursor === sink) path.push(sink);
    const answer = cost.get(source) ?? 1e15;
    const final = makeEntities(info, edges, cost, computed, -1, pathEdges);
    yield {
        stepNumber: step,
        entities: final.entities,
        edges: final.edges,
        description: `Shortest staged path ${path.join(" -> ")} has total cost ${answer}.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: {
            source,
            sink,
            answer: answer >= 1e15 ? "unreachable" : answer,
            path,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Every path through a staged graph moves forward one stage at a time, so the cost of leaving a vertex depends only on the already-known best cost from its successors. Work backward from the finish: for each vertex take the outgoing edge whose weight plus the successor's cost is smallest, and remember that edge to reconstruct the path.",
        invariants: [
            "cost[v] is the minimum weight of any path from v to the sink among vertices already processed.",
            "Processing in reverse topological order guarantees every successor's cost is final when v is computed.",
            "The stored successor pointer always realizes the chosen minimum.",
        ],
        correctness:
            "For the sink the best remaining cost is zero. For any other vertex v, every path to the sink begins with exactly one outgoing edge v to u followed by a path from u to the sink. By induction the DP already knows the optimal continuation from u, so choosing the edge minimizing weight(v,u) plus cost[u] yields the optimal path from v. Following the recorded successors reconstructs that path.",
        complexityRationale:
            "The topological sort visits each vertex and edge once, and the backward DP scans each outgoing edge once, giving O(V + E) time. The cost and successor maps plus the input graph use O(V + E) space.",
        uses: [
            "Layered network routing and telecommunication planning",
            "Shortest path selection in directed acyclic workflows",
            "A canonical introduction to DP over DAGs",
        ],
        references: [
            "Cormen et al., Introduction to Algorithms, Chapter 24.2",
            "Ahuja, Magnanti and Orlin, Network Flows, Chapter 4",
        ],
        workedExample:
            "In the pictured graph cost(6)=0, cost(4)=3 and cost(5)=2, then cost(2)=min(2+3, 3+2)=5 and cost(1)=min(4+3, 7+2)=7, so cost(0)=min(2+7, 5+5, 1+8)=9 along 0 -> 1 -> 4 -> 6.",
    },
    id: "multistage-graph-dp",
    name: "Multistage Graph (Backward DP)",
    category: "dynamic-programming",
    complexity: { time: "O(V + E)", space: "O(V + E)" },
    defaultInput: {
        edges: [
            [0, 1, 2], [0, 2, 5], [0, 3, 1],
            [1, 4, 4], [1, 5, 7], [2, 4, 2], [2, 5, 3],
            [3, 5, 6], [4, 6, 3], [5, 6, 2],
        ],
        source: 0,
        sink: 6,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build adjacency lists and topologically order the staged DAG",
        "set cost of the finish vertex to zero",
        "for each vertex in reverse topological order except the finish",
        "cost of vertex is the minimum over outgoing edges of weight plus successor cost",
        "store the successor that achieved that minimum",
        "follow stored successors from the start to recover the path",
        "report the start cost and the chosen path",
    ],
};

export default module;
