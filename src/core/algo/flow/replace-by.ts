/**
 * replace-by.ts - Ford-Fulkerson with the Replace-By Heuristic
 *
 * The replacement heuristic keeps, for every vertex, the index of the outgoing
 * arc currently being examined. After an augmenting path is found, only the
 * vertices on that path have their scan position reset, because only their
 * residual capacities changed. The next search therefore reuses the work done
 * elsewhere instead of restarting from the source.
 *
 * Limit: integer capacities and small directed graphs; DFS search depth is
 * bounded by the number of vertices.
 *
 * Time:  O(maxFlow * E) augmentations with reused scan pointers
 * Space: O(V + E)
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Edge = [string, number];

interface Arc {
    u: string;
    v: string;
    cap: number;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, Edge[]>; source?: string; sink?: string } | null) ?? {};
    const adjacency: Record<string, Edge[]> = task.graph ?? {
        S: [["A", 3], ["B", 2]],
        A: [["T", 2], ["B", 1]],
        B: [["T", 3]],
        T: [],
    };
    const source = task.source ?? "S";
    const sink = task.sink ?? "T";

    const nodes = new Set<string>(Object.keys(adjacency));
    const arcs: Arc[] = [];
    for (const [u, edges] of Object.entries(adjacency)) {
        for (const [v, cap] of edges) {
            nodes.add(u);
            nodes.add(v);
            arcs.push({ u, v, cap });
        }
    }
    const nodeList = [...nodes];
    const residual = new Map<string, number>();
    const flowOn = new Map<string, number>();
    for (const arc of arcs) {
        const key = `${arc.u}>${arc.v}`;
        const rev = `${arc.v}>${arc.u}`;
        residual.set(key, (residual.get(key) ?? 0) + arc.cap);
        residual.set(rev, residual.get(rev) ?? 0);
        flowOn.set(key, 0);
    }
    const residualCapacity = (u: string, v: string): number => residual.get(`${u}>${v}`) ?? 0;

    const outgoing: Record<string, string[]> = {};
    for (const node of nodeList) outgoing[node] = [];
    for (const arc of arcs) {
        outgoing[arc.u]!.push(arc.v);
        if (!outgoing[arc.v]!.includes(arc.u)) outgoing[arc.v]!.push(arc.u);
    }
    const work: Record<string, number> = {};
    for (const node of nodeList) work[node] = 0;

    let totalFlow = 0;
    const augmentations: Array<{ path: Array<[string, string]>; bottleneck: number }> = [];

    const findPath = (u: string, visited: Set<string>, path: Array<[string, string]>): boolean => {
        if (u === sink) return true;
        const neighbors = outgoing[u] ?? [];
        while ((work[u] ?? 0) < neighbors.length) {
            const v = neighbors[work[u] ?? 0]!;
            if (residualCapacity(u, v) > 0 && !visited.has(v)) {
                path.push([u, v]);
                visited.add(v);
                if (findPath(v, visited, path)) return true;
                path.pop();
            }
            work[u] = (work[u] ?? 0) + 1;
        }
        return false;
    };

    const makeEntities = (path: Array<[string, string]>): { entities: VisualEntity[]; edges: VisualFrame["edges"] } => {
        const onPath = new Set(path.map(([u, v]) => `${u}>${v}`));
        const entities: VisualEntity[] = nodeList.map((node, i) => ({
            id: `node-${node}`,
            type: "node" as const,
            label: node,
            value: node,
            state: (node === source || node === sink ? "pivot" : "idle") as "pivot" | "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, node },
        }));
        const edgeEntities = arcs.map((arc, i) => ({
            id: `edge-${i}`,
            sourceId: `node-${arc.u}`,
            targetId: `node-${arc.v}`,
            label: `${flowOn.get(`${arc.u}>${arc.v}`) ?? 0}/${arc.cap}`,
            state: (onPath.has(`${arc.u}>${arc.v}`) ? "active" : "idle") as "active" | "idle",
            directed: true,
        }));
        return { entities, edges: edgeEntities };
    };

    let step = 0;
    {
        const { entities, edges } = makeEntities([]);
        yield {
            stepNumber: step,
            entities,
            edges,
            description: `Max flow from ${source} to ${sink}; residual scan pointers start at the first outgoing arc of each vertex.`,
            codeLineNumber: 0,
            layout: "graph",
            meta: { rows: nodeList.length, cols: arcs.length, flow: 0, arcs: arcs.length },
        };
        step += 1;
    }

    for (let iteration = 0; iteration < arcs.reduce((s, a) => s + a.cap, 0) + 1; iteration += 1) {
        const path: Array<[string, string]> = [];
        const visited = new Set<string>([source]);
        if (!findPath(source, visited, path)) break;
        let bottleneck = Infinity;
        for (const [u, v] of path) bottleneck = Math.min(bottleneck, residualCapacity(u, v));
        if (!Number.isFinite(bottleneck) || bottleneck <= 0) break;
        for (const [u, v] of path) {
            residual.set(`${u}>${v}`, residualCapacity(u, v) - bottleneck);
            residual.set(`${v}>${u}`, residualCapacity(v, u) + bottleneck);
            flowOn.set(`${u}>${v}`, (flowOn.get(`${u}>${v}`) ?? 0) + bottleneck);
        }
        totalFlow += bottleneck;
        augmentations.push({ path: [...path], bottleneck });
        for (const [u] of path) work[u] = 0;

        const { entities, edges } = makeEntities(path);
        yield {
            stepNumber: step,
            entities,
            edges,
            description: `Augmenting path ${path.map(([u, v]) => `${u}->${v}`).join(" ")} with bottleneck ${bottleneck}; flow is now ${totalFlow}.`,
            codeLineNumber: 4,
            layout: "graph",
            meta: { rows: nodeList.length, cols: arcs.length, flow: totalFlow, path, bottleneck, iteration: iteration + 1 },
        };
        step += 1;
    }

    const reachable = new Set<string>([source]);
    const queue = [source];
    while (queue.length > 0) {
        const u = queue.shift()!;
        for (const v of outgoing[u] ?? []) {
            if (!reachable.has(v) && residualCapacity(u, v) > 0) {
                reachable.add(v);
                queue.push(v);
            }
        }
    }
    const crossing = arcs.filter((a) => reachable.has(a.u) && !reachable.has(a.v));
    const cut = crossing.map((a) => `${a.u}->${a.v}`);
    const cutCapacity = crossing.reduce((s, a) => s + a.cap, 0);
    const { entities, edges } = makeEntities([]);
    yield {
        stepNumber: step,
        entities,
        edges,
        description: `Maximum flow is ${totalFlow}; the residual reachable set gives a minimum cut of capacity ${cutCapacity}.`,
        codeLineNumber: 7,
        layout: "graph",
        meta: { rows: nodeList.length, cols: arcs.length, flow: totalFlow, cutCapacity, reachable: [...reachable], cut, augmentations },
    };
}

const module: AlgorithmModule = {
    id: "replace-by",
    name: "Replace-By Ford-Fulkerson",
    category: "flow",
    complexity: { time: "O(maxFlow * E)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            S: [["A", 3], ["B", 2]],
            A: [["T", 2], ["B", 1]],
            B: [["T", 3]],
            T: [],
        },
        source: "S",
        sink: "T",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the residual network and initialize every scan pointer to zero",
        "while an augmenting path exists from source to sink",
        "follow outgoing arcs from the scan pointer, skipping saturated arcs",
        "record the path when the sink is reached",
        "augment by the smallest residual capacity on the path",
        "reset the scan pointers only of vertices on the augmenting path",
        "continue from the source with the other pointers unchanged",
        "when no path remains, compute the residual reachable set and cut",
        "done: report the maximum flow value",
    ],
    education: {
        intuition:
            "A plain Ford-Fulkerson search restarts its arc scan from the beginning after every augmentation. The replace-by heuristic observes that only vertices touched by the last augmenting path can have lost residual capacity, so every other vertex can keep its current scan position. This reuses previous work without changing the answer.",
        invariants: [
            "A scan pointer always points to the first not-yet-examined outgoing arc of its vertex.",
            "Only forward arcs on the augmenting path lose residual capacity.",
            "The flow value increases by the bottleneck on every augmentation.",
        ],
        correctness:
            "The search is a depth-first traversal of the residual graph with current-arc pointers, so it finds an augmenting path whenever one exists. Resetting pointers on path vertices merely re-examines arcs whose residual may have changed; pointers at other vertices skip only arcs already proven unusable in this phase. Ford-Fulkerson augmentations preserve capacity and conservation and terminate on integer capacities, ending at a maximum flow certified by the empty residual reachable set.",
        complexityRationale:
            "Each augmentation pushes at least one unit for integer capacities, so there are at most maxFlow augmentations. A depth-first scan with reused pointers touches O(E) arcs per augmentation, giving O(maxFlow * E) time and O(V + E) space for the residual network.",
        uses: [
            "Teaching the current-arc optimization inside Ford-Fulkerson",
            "Assignment problems with small integer capacities",
            "A stepping stone toward Dinic's blocking-flow algorithm",
        ],
        references: [
            "Ford and Fulkerson, Flows in Networks, 1962",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, chapter 26",
        ],
        workedExample:
            "With S->A=3, S->B=2, A->T=2, A->B=1, B->T=3, the first path S-A-T augments 2 and resets pointers at S, A, T. The scan then finds S-A-B-T augmenting 1, followed by S-B-T augmenting 2, for a maximum flow of 5.",
    },
};

export default module;
