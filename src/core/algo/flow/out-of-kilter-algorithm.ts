/**
 * out-of-kilter-algorithm.ts - Out-of-Kilter Algorithm for Min-Cost Flow.
 *
 * The algorithm maintains a flow and node potentials. An arc is "in kilter"
 * when its flow sits consistently with its reduced cost (zero flow needs a
 * nonnegative reduced cost, full flow needs a nonpositive one, and a partial
 * flow needs exactly zero). Each step repairs one out-of-kilter arc by finding
 * a shortest residual path between its endpoints and augmenting around the
 * resulting cycle.
 *
 * Time O(iterations * V * E) with Bellman-Ford path searches, space O(V + E).
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Arc = { u: number; v: number; cap: number; cost: number; flow: number; tag: string };
type Ref = { arc: number; dir: 1 | -1 };
type Input = {
    vertices?: string[];
    arcs?: [string, string, number, number][];
    source?: string;
    sink?: string;
    maxFlow?: number;
};

function nodeEntities(
    names: string[],
    dist: Map<number, number>,
    states: Map<number, EntityState>,
): VisualEntity[] {
    return names.map((name, i) => {
        const d = dist.get(i) ?? 0;
        return {
            id: `node-${name}`,
            type: "node" as const,
            label: `${name} (pi ${d})`,
            value: d,
            state: states.get(i) ?? "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label: name, potential: d },
        };
    });
}

function arcEdges(arcs: Arc[], names: string[], states: Map<number, EntityState>): VisualEdge[] {
    return arcs.map((a, i) => ({
        id: `edge-${i}`,
        sourceId: `node-${names[a.u]}`,
        targetId: `node-${names[a.v]}`,
        label: `${a.flow}/${a.cap} c${a.cost}`,
        state: states.get(i) ?? "idle",
        directed: true,
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const names = Array.from(new Set<string>([
        ...(task.vertices ?? []).map(String),
        ...(task.arcs ?? []).flatMap((a) => [String(a[0]), String(a[1])]),
    ]));
    const index = new Map<string, number>(names.map((n, i) => [n, i]));
    const source = String(task.source ?? names[0] ?? "");
    const sink = String(task.sink ?? names[names.length - 1] ?? "");
    const maxFlow = Math.max(1, Math.floor(Number(task.maxFlow ?? 2) || 2));

    if (names.length === 0) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "Empty network - no min-cost flow to compute.",
            codeLineNumber: 0,
            layout: "graph",
            meta: {},
        };
        return;
    }

    const arcs: Arc[] = (task.arcs ?? []).map((a) => ({
        u: index.get(String(a[0])) ?? 0,
        v: index.get(String(a[1])) ?? 0,
        cap: Math.max(0, Math.floor(Number(a[2]))),
        cost: Number(a[3]),
        flow: 0,
        tag: "original",
    }));
    const costScale = 1 + arcs.reduce((s, a) => s + Math.abs(a.cost), 0) * (maxFlow + 2);
    const returnIndex = arcs.length;
    arcs.push({
        u: index.get(sink) ?? 0,
        v: index.get(source) ?? 0,
        cap: maxFlow,
        cost: -costScale,
        flow: 0,
        tag: "return",
    });

    const potential = new Array<number>(names.length).fill(0);
    const n = names.length;
    let step = 0;
    let augmentations = 0;
    let repairs = 0;
    const piMap = (): Map<number, number> => new Map(potential.map((p, i) => [i, p]));

    yield {
        stepNumber: step++,
        entities: nodeEntities(names, piMap(), new Map()),
        edges: arcEdges(arcs, names, new Map()),
        description: `Out-of-kilter setup: ${n} nodes, ${arcs.length - 1} arcs, goal ${maxFlow} units ${source}->${sink}.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { sent: 0, cost: 0, augmentations, repairs },
    };

    const reduced = (a: Arc): number => a.cost + potential[a.u]! - potential[a.v]!;
    const outOfKilter = (a: Arc): { active: boolean; increase: boolean } => {
        const c = reduced(a);
        if (a.flow === 0) return { active: c < 0, increase: true };
        if (a.flow === a.cap) return { active: c > 0, increase: false };
        return { active: c !== 0, increase: c < 0 };
    };

    /** Bellman-Ford over in-kilter residual arcs, excluding one target arc. */
    const shortest = (
        start: number,
        end: number,
        excluded: number,
    ): { dist: number[]; pred: Array<Ref | null> } => {
        const dist = new Array<number>(n).fill(Infinity);
        const pred: Array<Ref | null> = new Array(n).fill(null);
        dist[start] = 0;
        for (let iter = 0; iter < n; iter += 1) {
            let changed = false;
            for (let ai = 0; ai < arcs.length; ai += 1) {
                if (ai === excluded) continue;
                const a = arcs[ai]!;
                if (a.cap - a.flow > 0) {
                    const rc = a.cost + potential[a.u]! - potential[a.v]!;
                    if (dist[a.u]! + rc < dist[a.v]! - 1e-9) {
                        dist[a.v] = dist[a.u]! + rc;
                        pred[a.v] = { arc: ai, dir: 1 };
                        changed = true;
                    }
                }
                if (a.flow > 0) {
                    const rc = -a.cost + potential[a.v]! - potential[a.u]!;
                    if (dist[a.v]! + rc < dist[a.u]! - 1e-9) {
                        dist[a.u] = dist[a.v]! + rc;
                        pred[a.u] = { arc: ai, dir: -1 };
                        changed = true;
                    }
                }
            }
            if (!changed) break;
        }
        return { dist, pred };
    };

    const guardLimit = 4000;
    let guard = 0;
    let lastFrameStep = step;

    while (guard++ < guardLimit) {
        let target = -1;
        let increase = true;
        for (let i = 0; i < arcs.length; i += 1) {
            const status = outOfKilter(arcs[i]!);
            if (status.active) {
                target = i;
                increase = status.increase;
                break;
            }
        }
        if (target < 0) break;
        repairs += 1;
        const a = arcs[target]!;
        const start = increase ? a.v : a.u;
        const end = increase ? a.u : a.v;
        const { dist, pred } = shortest(start, end, target);

        if (step - lastFrameStep >= 4) {
            yield {
                stepNumber: step++,
                entities: nodeEntities(names, piMap(), new Map([[start, "active" as EntityState]])),
                edges: arcEdges(arcs, names, new Map([[target, "comparing" as EntityState]])),
                description: `Arc ${a.tag === "return" ? "return" : `${names[a.u]}->${names[a.v]}`} is out of kilter; repairing ${increase ? "forward" : "backward"} flow.`,
                codeLineNumber: 2,
                layout: "graph",
                meta: { sent: arcs[returnIndex]!.flow, cost: 0, augmentations, repairs },
            };
            lastFrameStep = step;
        }

        for (let i = 0; i < n; i += 1) {
            if (Number.isFinite(dist[i])) potential[i] = potential[i]! + dist[i]!;
        }

        if (!Number.isFinite(dist[end])) continue;

        const pathRefs: Ref[] = [];
        let cursor = end;
        let bottleneck = increase ? a.cap - a.flow : a.flow;
        while (cursor !== start) {
            const ref = pred[cursor];
            if (!ref) break;
            pathRefs.push(ref);
            const pa = arcs[ref.arc]!;
            const residual = ref.dir === 1 ? pa.cap - pa.flow : pa.flow;
            bottleneck = Math.min(bottleneck, residual);
            cursor = ref.dir === 1 ? pa.u : pa.v;
        }
        if (bottleneck <= 0) continue;

        for (const ref of pathRefs) {
            const pa = arcs[ref.arc]!;
            pa.flow += ref.dir === 1 ? bottleneck : -bottleneck;
        }
        a.flow += increase ? bottleneck : -bottleneck;
        augmentations += 1;

        yield {
            stepNumber: step++,
            entities: nodeEntities(names, piMap(), new Map([[end, "sorted" as EntityState]])),
            edges: arcEdges(
                arcs,
                names,
                new Map([
                    [target, "active" as EntityState],
                    ...pathRefs.map((r) => [r.arc, "path" as EntityState] as [number, EntityState]),
                ]),
            ),
            description: `Augmented ${bottleneck} unit(s) around the correction cycle; ${arcs[returnIndex]!.flow}/${maxFlow} units sent.`,
            codeLineNumber: 4,
            layout: "graph",
            meta: { sent: arcs[returnIndex]!.flow, augmentations, repairs },
        };
        lastFrameStep = step;
    }

    const sent = arcs[returnIndex]!.flow;
    let realCost = 0;
    for (let i = 0; i < arcs.length - 1; i += 1) {
        realCost += arcs[i]!.flow * arcs[i]!.cost;
    }
    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < arcs.length - 1; i += 1) {
        if (arcs[i]!.flow > 0) finalStates.set(i, "sorted");
    }
    yield {
        stepNumber: step,
        entities: nodeEntities(names, piMap(), new Map()),
        edges: arcEdges(arcs, names, finalStates),
        description:
            sent >= maxFlow
                ? `Optimal flow of ${sent} units costs ${realCost}; all arcs are in kilter.`
                : `Stopped with ${sent}/${maxFlow} units: no augmenting correction cycle exists.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: { sent, maxFlow, cost: realCost, augmentations, repairs, converged: sent >= maxFlow },
    };
}

const module: AlgorithmModule = {
    id: "out-of-kilter-algorithm",
    name: "Out-of-Kilter Algorithm",
    category: "flow",
    complexity: { time: "O(iterations * V * E)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["s", "a", "b", "t"],
        arcs: [
            ["s", "a", 3, 2],
            ["s", "b", 3, 4],
            ["a", "b", 2, 1],
            ["a", "t", 2, 5],
            ["b", "t", 3, 1],
        ],
        source: "s",
        sink: "t",
        maxFlow: 3,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start with zero flow and zero node potentials",
        "find an arc whose flow is out of kilter with its reduced cost",
        "search a shortest residual path between the arc endpoints",
        "update potentials from the shortest path distances",
        "augment the correction cycle by its bottleneck capacity",
        "repeat until every arc is in kilter",
        "report the minimum cost of the required flow",
    ],
    education: {
        intuition:
            "For each arc, the reduced cost says whether carrying more or less flow would be cheaper. When the current flow disagrees with that signal the arc is out of kilter. The algorithm fixes one such arc at a time by sending flow around a cycle that restores agreement, using shortest paths so each repair is the cheapest available.",
        invariants: [
            "Flow conservation holds at every node after each augmentation.",
            "Node potentials make every in-kilter residual arc have nonnegative reduced cost.",
            "Arc flows always stay between zero and capacity.",
        ],
        correctness:
            "A circulation of minimum cost is characterized by the existence of consistent node potentials that place every arc in kilter. Each augmentation preserves feasibility and strictly moves the offending arc toward kilter without breaking arcs already in kilter; with integral costs and capacities the process terminates. When no out-of-kilter arc remains, the potentials certify optimality, so the circulation is minimum-cost.",
        complexityRationale:
            "Each repair performs one Bellman-Ford search costing O(V E), and the number of repairs is polynomial in the network size and capacities, giving O(iterations * V * E) time. Flow and potential arrays use O(V + E) space.",
        uses: [
            "Minimum-cost flow in transportation and assignment networks",
            "Reoptimizing a circulation after local cost changes",
            "A canonical example of potentials and complementary slackness",
        ],
        references: [
            "Ford and Fulkerson, Flows in Networks, the out-of-kilter method",
            "Ahuja, Magnanti, and Orlin, Network Flows, Chapter 12",
        ],
        workedExample:
            "From s to t with arcs s-a cost 2, s-b cost 4, a-b cost 1, a-t cost 5, and b-t cost 1, sending three units: two travel s-a-b-t at cost 2+1+1=4 each and one travels s-b-t at cost 4+1=5, giving a minimum cost of 13. The out-of-kilter steps discover the cheap a-b detour before committing flow to the expensive a-t arc.",
    },
};

export default module;
