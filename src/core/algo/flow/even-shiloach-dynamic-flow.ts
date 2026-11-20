/**
 * even-shiloach-dynamic-flow.ts - Even-Shiloach Dynamic Max Flow
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Static max-flow algorithms restart the search from zero after every edit.
 * The Even-Shiloach approach keeps the current maximum flow and maintains two
 * residual distance trees: distances from the source and distances to the
 * sink. When an edge gains capacity, only those trees need repair, because a
 * new augmenting path must use the newly added residual capacity. Augmenting
 * paths are read directly from the repaired trees, and the trees are rebuilt
 * only after an augmentation changes residual capacities in the other
 * direction.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E) per insertion for the tree repair plus O(V E) per augmentation
 *   Space: O(V + E) for residual arcs, distance trees, and the current flow
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Edges are drawn with "flow/capacity"; the augmented path is ACTIVE.
 *   - Vertices turn PATH while they lie on the current augmenting path.
 *   - Meta reports the insertion being processed, distance-tree repairs, and
 *     the current maximum flow.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type FlowEdge = [string, string, number];

interface DynamicInput {
    vertices?: string[];
    edges?: FlowEdge[];
    source?: string;
    sink?: string;
    insertions?: FlowEdge[];
}

interface EdgeRec {
    u: number;
    v: number;
    cap: number;
}

interface Trees {
    distS: number[];
    distT: number[];
    parentS: number[];
}

function emptyFrame(step: number): VisualFrame {
    return {
        stepNumber: step,
        entities: [],
        edges: [],
        description: "Empty network - no dynamic flow to compute.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { maxFlow: 0 },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (input == null || typeof input !== "object") {
        yield emptyFrame(0);
        return;
    }
    const task = input as DynamicInput;
    const vertices = Array.isArray(task.vertices) ? task.vertices.map(String) : [];
    const n = vertices.length;
    if (n < 2) {
        yield emptyFrame(0);
        return;
    }
    const indexOf = new Map(vertices.map((label, i) => [label, i] as [string, number]));
    const s = indexOf.get(String(task.source ?? vertices[0])) ?? 0;
    const t = indexOf.get(String(task.sink ?? vertices[n - 1])) ?? n - 1;
    if (s === t) {
        yield emptyFrame(0);
        return;
    }

    const initialEdges: EdgeRec[] = (Array.isArray(task.edges) ? task.edges : [])
        .map((e) => ({
            u: indexOf.get(String(e[0])) ?? -1,
            v: indexOf.get(String(e[1])) ?? -1,
            cap: Math.max(0, Math.floor(Number(e[2]) || 0)),
        }))
        .filter((e) => e.u >= 0 && e.v >= 0 && e.u !== e.v);
    const edges: EdgeRec[] = [];

    // Residual arcs: arc 2i is edge i forward, arc 2i+1 is its reverse.
    const res: number[] = [];
    const arcFrom: number[] = [];
    const arcTo: number[] = [];
    const adjOut: number[][] = Array.from({ length: n }, () => []);
    const adjIn: number[][] = Array.from({ length: n }, () => []);
    const addEdge = (u: number, v: number, cap: number): number => {
        const i = edges.length;
        edges.push({ u, v, cap });
        res.push(cap, 0);
        arcFrom.push(u, v);
        arcTo.push(v, u);
        adjOut[u]!.push(2 * i);
        adjIn[v]!.push(2 * i);
        adjOut[v]!.push(2 * i + 1);
        adjIn[u]!.push(2 * i + 1);
        return i;
    };
    for (const e of initialEdges) {
        addEdge(e.u, e.v, e.cap);
    }

    const nodeId = (i: number): string => `node-${i}`;
    const nodes = (states: Map<number, EntityState> = new Map()): VisualEntity[] =>
        Array.from({ length: n }, (_, i) => ({
            id: nodeId(i),
            type: "node" as const,
            label: vertices[i] as string,
            value: vertices[i] as string,
            state: states.get(i) ?? "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, label: vertices[i] as string },
        }));
    const buildEdges = (activeArcs: Set<number> = new Set()): VisualEdge[] =>
        edges.map((e, i) => {
            const flow = e.cap - (res[2 * i] as number);
            const active = activeArcs.has(2 * i) || activeArcs.has(2 * i + 1);
            return {
                id: `edge-${i}`,
                sourceId: nodeId(e.u),
                targetId: nodeId(e.v),
                label: `${flow}/${e.cap}`,
                state: (active ? "active" : flow > 0 ? "path" : "idle") as EntityState,
                directed: true,
            };
        });
    const flowIntoSink = (): number => {
        let total = 0;
        for (let i = 0; i < edges.length; i += 1) {
            const e = edges[i] as EdgeRec;
            if (e.v === t) total += e.cap - (res[2 * i] as number);
            if (e.u === t) total -= e.cap - (res[2 * i] as number);
        }
        return total;
    };

    const buildTrees = (): Trees => {
        const distS = new Array<number>(n).fill(Infinity);
        const distT = new Array<number>(n).fill(Infinity);
        const parentS = new Array<number>(n).fill(-1);
        distS[s] = 0;
        const queueS = [s];
        while (queueS.length > 0) {
            const u = queueS.shift() as number;
            for (const arc of adjOut[u] as number[]) {
                const v = arcTo[arc] as number;
                if ((res[arc] as number) > 0 && distS[u]! + 1 < (distS[v] as number)) {
                    distS[v] = (distS[u] as number) + 1;
                    parentS[v] = u;
                    queueS.push(v);
                }
            }
        }
        distT[t] = 0;
        const queueT = [t];
        while (queueT.length > 0) {
            const v = queueT.shift() as number;
            for (const arc of adjIn[v] as number[]) {
                const u = arcFrom[arc] as number;
                if ((res[arc] as number) > 0 && distT[v]! + 1 < (distT[u] as number)) {
                    distT[u] = (distT[v] as number) + 1;
                    queueT.push(u);
                }
            }
        }
        return { distS, distT, parentS };
    };

    const repairTrees = (previous: Trees, newArc: number): Trees => {
        const { distS, distT, parentS } = {
            distS: previous.distS.slice(),
            distT: previous.distT.slice(),
            parentS: previous.parentS.slice(),
        };
        const start = arcFrom[newArc] as number;
        const next = arcTo[newArc] as number;
        // Distances from the source only decrease, spreading from the new arc's tail.
        const queueS = [start];
        const seenS = new Set<number>([start]);
        while (queueS.length > 0) {
            const u = queueS.shift() as number;
            for (const arc of adjOut[u] as number[]) {
                const v = arcTo[arc] as number;
                if (
                    (res[arc] as number) > 0 &&
                    (distS[u] as number) + 1 < (distS[v] as number)
                ) {
                    distS[v] = (distS[u] as number) + 1;
                    parentS[v] = u;
                    if (!seenS.has(v)) {
                        seenS.add(v);
                        queueS.push(v);
                    }
                }
            }
        }
        // Distances to the sink only decrease, spreading backward from the arc's head.
        if ((distT[next] as number) + 1 < (distT[start] as number)) {
            distT[start] = (distT[next] as number) + 1;
            const queueT = [start];
            const seenT = new Set<number>([start]);
            while (queueT.length > 0) {
                const v = queueT.shift() as number;
                for (const arc of adjIn[v] as number[]) {
                    const u = arcFrom[arc] as number;
                    if (
                        (res[arc] as number) > 0 &&
                        (distT[v] as number) + 1 < (distT[u] as number)
                    ) {
                        distT[u] = (distT[v] as number) + 1;
                        if (!seenT.has(u)) {
                            seenT.add(u);
                            queueT.push(u);
                        }
                    }
                }
            }
        }
        return { distS, distT, parentS };
    };

    let step = 0;
    let augmentations = 0;
    let repairs = 0;
    let trees = buildTrees();
    let insertionsProcessed = 0;

    const augment = (current: Trees): { arcs: number[]; amount: number; nodesOnPath: number[] } | null => {
        if (!Number.isFinite(current.distS[t] as number)) return null;
        const arcs: number[] = [];
        const nodesOnPath: number[] = [t];
        let cur = t;
        while (cur !== s) {
            const parent = current.parentS[cur] as number;
            if (parent < 0) return null;
            let found = -1;
            for (const arc of adjOut[parent] as number[]) {
                if (arcTo[arc] === cur && (res[arc] as number) > 0) {
                    found = arc;
                    break;
                }
            }
            if (found < 0) return null;
            arcs.push(found);
            nodesOnPath.push(parent);
            cur = parent;
        }
        let bottleneck = Infinity;
        for (const arc of arcs) {
            bottleneck = Math.min(bottleneck, res[arc] as number);
        }
        for (const arc of arcs) {
            res[arc] = (res[arc] as number) - bottleneck;
            res[arc ^ 1] = (res[arc ^ 1] as number) + bottleneck;
        }
        return { arcs, amount: bottleneck, nodesOnPath };
    };

    yield {
        stepNumber: step++,
        entities: nodes(),
        edges: buildEdges(),
        description: `Dynamic max flow starts with ${edges.length} edge(s); distance trees will be maintained across capacity increases.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { maxFlow: 0, insertionsProcessed: 0, repairs: 0, augmentations: 0 },
    };

    // Establish the initial maximum flow with shortest augmenting paths.
    for (;;) {
        const result = augment(buildTrees());
        if (!result) break;
        augmentations += 1;
        const active = new Set(result.arcs);
        const states = new Map<number, EntityState>();
        for (const v of result.nodesOnPath) states.set(v, "path");
        yield {
            stepNumber: step++,
            entities: nodes(states),
            edges: buildEdges(active),
            description: `Initial flow: augmented ${result.amount} along a shortest path of ${result.arcs.length} arc(s).`,
            codeLineNumber: 1,
            layout: "graph",
            meta: {
                maxFlow: flowIntoSink(),
                insertionsProcessed: 0,
                repairs: 0,
                augmentations,
                amount: result.amount,
            },
        };
    }
    trees = buildTrees();
    yield {
        stepNumber: step++,
        entities: nodes(),
        edges: buildEdges(),
        description: `Initial maximum flow established at ${flowIntoSink()} before any capacity change.`,
        codeLineNumber: 2,
        layout: "graph",
        meta: { maxFlow: flowIntoSink(), insertionsProcessed: 0, repairs: 0, augmentations },
    };

    const insertions = Array.isArray(task.insertions) ? task.insertions : [];
    for (const insertion of insertions) {
        const u = indexOf.get(String(insertion[0])) ?? -1;
        const v = indexOf.get(String(insertion[1])) ?? -1;
        const extra = Math.max(0, Math.floor(Number(insertion[2]) || 0));
        if (u < 0 || v < 0 || u === v || extra === 0) continue;

        let edgeIndex = edges.findIndex((e) => e.u === u && e.v === v);
        let arc = -1;
        if (edgeIndex < 0) {
            arc = 2 * addEdge(u, v, 0);
            edgeIndex = edges.length - 1;
            (edges[edgeIndex] as EdgeRec).cap = 0;
        } else {
            arc = 2 * edgeIndex;
        }
        res[arc] = (res[arc] as number) + extra;
        (edges[edgeIndex] as EdgeRec).cap += extra;
        repairs += 1;
        trees = repairTrees(trees, arc);
        insertionsProcessed += 1;
        const states = new Map<number, EntityState>([
            [u, "comparing"],
            [v, "comparing"],
        ]);
        yield {
            stepNumber: step++,
            entities: nodes(states),
            edges: buildEdges(new Set([arc])),
            description: `Insertion ${insertionsProcessed}: added ${extra} to edge ${vertices[u]} -> ${vertices[v]} and repaired both distance trees.`,
            codeLineNumber: 3,
            layout: "graph",
            meta: {
                maxFlow: flowIntoSink(),
                insertionsProcessed,
                repairs,
                augmentations,
                distS: trees.distS[t],
            },
        };

        for (;;) {
            const result = augment(trees);
            if (!result) break;
            augmentations += 1;
            const active = new Set(result.arcs);
            const pathStates = new Map<number, EntityState>();
            for (const node of result.nodesOnPath) pathStates.set(node, "path");
            yield {
                stepNumber: step++,
                entities: nodes(pathStates),
                edges: buildEdges(active),
                description: `Insertion ${insertionsProcessed}: augmented ${result.amount} through the repaired tree to reach the sink.`,
                codeLineNumber: 4,
                layout: "graph",
                meta: {
                    maxFlow: flowIntoSink(),
                    insertionsProcessed,
                    repairs,
                    augmentations,
                    amount: result.amount,
                },
            };
            // An augmentation raises some distances, so the trees are rebuilt.
            trees = buildTrees();
        }
    }

    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < n; i += 1) finalStates.set(i, "sorted");
    yield {
        stepNumber: step,
        entities: nodes(finalStates),
        edges: buildEdges(),
        description: `After ${insertionsProcessed} insertion(s) the maintained maximum flow is ${flowIntoSink()}.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: {
            maxFlow: flowIntoSink(),
            insertionsProcessed,
            repairs,
            augmentations,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When a link gains capacity, throwing away the old flow and starting over wastes work. Even-Shiloach keeps the flow that is already feasible and maintains two signposts: how far each vertex is from the source and how far it is from the sink. A capacity increase can only shorten those distances, so the signposts are patched locally, and any new augmenting path is read straight from them.",
        invariants: [
            "The maintained flow is feasible at every step: no edge carries more than its capacity and intermediate vertices conserve flow.",
            "After an insertion, any augmenting path must use the newly added residual capacity, so repairing from that edge reaches every affected distance.",
            "Source distances and sink distances can only decrease during a repair, which is why a simple relaxation is enough.",
            "After an augmentation the flow value rises by the bottleneck and never falls, so repeated augmentation terminates.",
        ],
        correctness:
            "Before an insertion the flow is maximum, so the old residual network has no source-to-sink path. Adding capacity creates residual arcs, and every new augmenting path must traverse one of them; the repair propagates all resulting distance decreases from that arc, so the rebuilt trees contain a shortest augmenting path if one exists. Augmenting along a shortest path keeps the flow feasible and increases its value by at least one; when no path remains, the max-flow min-cut theorem certifies that the maintained flow is maximum for the new capacities.",
        complexityRationale:
            "Repairing the two distance trees after one insertion touches each affected vertex at most once, costing O(E). Each augmentation finds a shortest path in O(E) and may require rebuilding the trees in O(V + E), so a batch of insertions costs O(E) per edit plus O(V E) per augmenting path. Residual arcs, distances, and the flow use O(V + E) space.",
        uses: [
            "Rerouting in networks where link capacities grow or new links are added over time",
            "Incremental bipartite matching as the graph gains edges",
            "Maintaining throughput estimates without recomputing a static maximum flow",
        ],
        references: [
            "Even and Shiloach, An On-Line Edge-Deletion Problem, 1981",
            "Ahuja, Magnanti, and Orlin, Network Flows, dynamic flow chapters",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter 26",
        ],
        workedExample:
            "Take source A, sink C, and an edge A->B of capacity 3 plus B->C of capacity 2; the initial maximum flow is 2. Inserting 4 units on A->B repairs the source-distance tree from A and the sink-distance tree from B, then one more augmenting path carries the extra unit through B->C only if that edge has room; adding capacity instead to B->C raises the flow to 3. Each step keeps the previous flow instead of restarting the search.",
    },
    id: "even-shiloach-dynamic-flow",
    name: "Even-Shiloach Dynamic Flow",
    category: "flow",
    complexity: { time: "O(E) repair + O(VE) per augmentation", space: "O(V + E)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D"],
        edges: [
            ["A", "B", 5],
            ["A", "C", 3],
            ["B", "D", 4],
            ["C", "D", 4],
        ],
        source: "A",
        sink: "D",
        insertions: [
            ["B", "D", 3],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build residual arcs and compute the initial maximum flow",
        "maintain distance trees from the source and to the sink",
        "for each capacity increase add the new residual capacity",
        "relax source distances forward from the new arc's tail",
        "relax sink distances backward from the new arc's head",
        "augment along a tree path and rebuild the trees afterward",
        "done: report the maintained maximum flow",
    ],
};

export default module;
