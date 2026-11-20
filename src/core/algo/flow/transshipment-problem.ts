/**
 * transshipment-problem.ts - Transshipment Problem (Min-Cost Flow)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Supplies and demands sit at arbitrary nodes of a directed network, not just
 * at two bipartite sides. A super source feeds every supply node and a super
 * sink drains every demand node, then a min-cost augmenting-path search moves
 * goods through the intermediate nodes at least total cost.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(F * V * E) with Bellman-Ford shortest paths
 *   Space: O(V + E) for the residual network
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are circles; arcs are directed edges labeled with cost.
 *   - The arc carrying the current augmentation is YELLOW.
 *   - Arcs with positive flow are GREEN in the final frame.
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Arc {
    to: number;
    cap: number;
    cost: number;
    flow: number;
    label: string;
}

function makeNodes(ids: string[], supply: number[]): VisualEntity[] {
    return ids.map((id, index) => {
        const s = supply[index] ?? 0;
        return {
            id: `node-${id}`,
            type: "node" as const,
            label: `${id}${s === 0 ? "" : ` (${s > 0 ? "+" : ""}${s})`}`,
            value: s,
            state: s > 0 ? "highlight" : s < 0 ? "active" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, supply: s },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        nodes?: string[];
        arcs?: [string, string, number, number][];
        supply?: Record<string, number>;
    } | null) ?? {};
    const ids = Array.isArray(task.nodes) && task.nodes.length > 0
        ? [...task.nodes]
        : ["A", "B", "C", "D"];
    const originalArcs: [string, string, number, number][] = Array.isArray(task.arcs)
        ? task.arcs
        : [["A", "B", 4, 1], ["B", "D", 4, 2], ["A", "C", 4, 3], ["C", "D", 4, 1], ["B", "C", 2, 1]];
    const supplyRecord = task.supply ?? { A: 5, D: -5 };
    const supply = ids.map((id) => Number(supplyRecord[id]) || 0);
    const n = ids.length;
    const index = new Map(ids.map((id, i) => [id, i]));
    const S = n;
    const T = n + 1;
    const graph: Arc[][] = Array.from({ length: n + 2 }, () => []);

    const addArc = (u: number, v: number, cap: number, cost: number, label: string): void => {
        const forward: Arc = { to: v, cap, cost, flow: 0, label };
        const backward: Arc = { to: u, cap: 0, cost: -cost, flow: 0, label: `rev:${label}` };
        graph[u]!.push(forward);
        graph[v]!.push(backward);
    };

    for (const [u, v, cap, cost] of originalArcs) {
        const ui = index.get(u);
        const vi = index.get(v);
        if (ui === undefined || vi === undefined) continue;
        addArc(ui, vi, Math.max(0, Math.floor(cap)), Number(cost) || 0, `${u}->${v}`);
    }
    let required = 0;
    for (let i = 0; i < n; i += 1) {
        const s = supply[i] ?? 0;
        if (s > 0) {
            addArc(S, i, s, 0, `S->${ids[i]}`);
            required += s;
        } else if (s < 0) {
            addArc(i, T, -s, 0, `${ids[i]}->T`);
        }
    }

    let step = 0;
    const highlight = new Set<string>();
    const frame = (description: string, line: number, answer: number | null, sent: number): VisualFrame => {
        const edges: VisualEdge[] = [];
        for (const [u, uName] of ids.entries()) {
            for (const arc of graph[u] ?? []) {
                const arcLabel = arc.label;
                if (arcLabel.startsWith("rev:") || arcLabel.startsWith("S->") || arcLabel.endsWith("->T")) continue;
                const vi = arc.to;
                if (vi >= n) continue;
                edges.push({
                    id: `edge-${uName}-${ids[vi]}`,
                    sourceId: `node-${uName}`,
                    targetId: `node-${ids[vi]}`,
                    label: `${arc.cost}`,
                    state: highlight.has(arcLabel) ? "comparing" : arc.flow > 0 ? "sorted" : "idle",
                    directed: true,
                });
            }
        }
        return {
            stepNumber: step++,
            entities: makeNodes(ids, supply),
            edges,
            description,
            codeLineNumber: line,
            layout: "graph",
            meta: { answer, flow: sent, required, nodes: [...ids] },
        };
    };

    yield frame(`Transshipping ${required} unit(s) through ${n} node(s).`, 0, null, 0);
    if (required === 0) {
        yield frame("No net supply or demand, so no shipment is needed.", 1, 0, 0);
        return;
    }

    let totalFlow = 0;
    let totalCost = 0;
    const N = n + 2;
    while (totalFlow < required) {
        const dist = new Array<number>(N).fill(Infinity);
        const prevNode = new Array<number>(N).fill(-1);
        const prevArc = new Array<Arc | null>(N).fill(null);
        dist[S] = 0;
        for (let iter = 0; iter < N; iter += 1) {
            let changed = false;
            for (let u = 0; u < N; u += 1) {
                if (!Number.isFinite(dist[u])) continue;
                for (const arc of graph[u] ?? []) {
                    if (arc.cap - arc.flow <= 0) continue;
                    const candidate = dist[u]! + arc.cost;
                    if (candidate < (dist[arc.to] ?? Infinity)) {
                        dist[arc.to] = candidate;
                        prevNode[arc.to] = u;
                        prevArc[arc.to] = arc;
                        changed = true;
                    }
                }
            }
            if (!changed) break;
        }
        if (!Number.isFinite(dist[T])) {
            yield frame("The demand cannot be fully met with the given arcs.", 6, null, totalFlow);
            return;
        }

        let delta = required - totalFlow;
        for (let v = T; v !== S; v = prevNode[v]!) {
            const arc = prevArc[v];
            if (!arc) break;
            delta = Math.min(delta, arc.cap - arc.flow);
        }
        highlight.clear();
        for (let v = T; v !== S; v = prevNode[v]!) {
            const arc = prevArc[v];
            if (!arc) break;
            arc.flow += delta;
            totalCost += delta * arc.cost;
            if (!arc.label.startsWith("rev:")) highlight.add(arc.label);
        }
        totalFlow += delta;
        yield frame(
            `Augmented ${delta} unit(s) along the cheapest path; cost so far ${totalCost}.`,
            4,
            null,
            totalFlow,
        );
    }

    const finalFrame = frame(`Minimum transshipment cost is ${totalCost}.`, 7, totalCost, totalFlow);
    highlight.clear();
    yield finalFrame;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Turn every supply and demand into an edge to a dummy source or sink, so shipping everything becomes a single flow problem. Repeatedly send goods along the currently cheapest residual path, canceling earlier shipping choices by using backward arcs when a better route appears.",
        invariants: [
            "A node's net outflow equals its supply minus its demand once all flow arrives.",
            "Every augmentation respects the remaining capacity of each arc.",
            "The accumulated cost equals the sum of shipped units times their arc costs.",
        ],
        correctness:
            "Adding the super source and sink makes transshipment exactly a min-cost flow of value equal to total supply. Successive shortest augmenting paths with negative-cost residual arcs finds a minimum-cost flow of each value, so when total supply is sent the flow is feasible and has least possible cost; if the sink is unreachable no feasible plan exists.",
        complexityRationale:
            "At most the total supply augmentations are needed and each Bellman-Ford relaxation pass costs O(V * E), giving O(F * V * E) time. The residual graph stores two arcs per original arc plus the dummy connections, so space is O(V + E).",
        uses: [
            "Distributing goods through warehouses that both receive and ship",
            "Planning power or data flow across a network with local sources and sinks",
            "Generalizing the transportation problem beyond bipartite structure",
        ],
        references: [
            "Ahuja, Magnanti and Orlin, Network Flows, Chapter 11",
            "Cormen et al., Introduction to Algorithms, Chapter 26",
        ],
        workedExample:
            "With supply 5 at A, demand 5 at D, and arcs A-B cap 4 cost 1, B-D cap 4 cost 2, A-C cap 4 cost 3, C-D cap 4 cost 1, four units go A-B-D at cost 3 each and the last goes A-C-D at cost 4, totaling 16.",
    },
    id: "transshipment-problem",
    name: "Transshipment Problem (Min-Cost Flow)",
    category: "flow",
    complexity: { time: "O(F * V * E)", space: "O(V + E)" },
    defaultInput: {
        nodes: ["A", "B", "C", "D"],
        arcs: [["A", "B", 4, 1], ["B", "D", 4, 2], ["A", "C", 4, 3], ["C", "D", 4, 1], ["B", "C", 2, 1]],
        supply: { A: 5, D: -5 },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "read nodes, arcs with capacity and cost, and the supply of each node",
        "add a super source arc to every node with positive supply",
        "add an arc to a super sink from every node with negative supply",
        "find the cheapest residual path from super source to super sink",
        "if no path exists report that demand cannot be met",
        "augment the maximum possible units along that path",
        "add the shipped units times path cost to the total",
        "repeat until all supply has been shipped",
        "report the minimum transshipment cost",
    ],
};

export default module;
