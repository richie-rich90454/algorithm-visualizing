/**
 * hao-orlin-min-cut.ts - Hao-Orlin Global Minimum Cut
 *
 * One preflow-push run finds a minimum cut for every choice of sink. The root
 * stays a source, the current sink is repeatedly promoted to the source set,
 * and vertices that can no longer reach the sink are stored in dormant sets.
 * On an undirected graph a single rooted run gives the global minimum cut.
 *
 * Time: O(V^2 E) with this simple selection rule. Space: O(V + E).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Task = { vertices?: string[]; edges?: Array<[string, string, number]> };
type Arc = { to: number; cap: number; rev: number };

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const vertices = Array.isArray(task.vertices)
        ? [...task.vertices].map(String)
        : ["a", "b", "c", "d", "e"];
    const edgeList: Array<[string, string, number]> = Array.isArray(task.edges)
        ? task.edges.map(([u, v, w]) => [String(u), String(v), Math.max(0, Math.floor(w))])
        : [
              ["a", "b", 4], ["a", "c", 6], ["b", "c", 2], ["b", "d", 5],
              ["c", "d", 3], ["c", "e", 7], ["d", "e", 4],
          ];
    const index = new Map<string, number>();
    vertices.forEach((label, i) => index.set(label, i));
    const n = vertices.length;
    const frames: VisualFrame[] = [];
    let step = 0;
    let phases = 0;
    let dormancies = 0;

    const emit = (
        sourceSet: Set<number>,
        awake: Set<number>,
        dormant: number[][],
        sink: number,
        description: string,
        codeLineNumber: number,
        bestValue: number,
        bestSide: number[],
        extra: Record<string, number | string | boolean> = {},
    ): void => {
        const stateOf = (i: number): EntityState => {
            if (i === sink) {
                return "pivot";
            }
            if (sourceSet.has(i)) {
                return "sorted";
            }
            if (awake.has(i)) {
                return "active";
            }
            return "idle";
        };
        const inBest = new Set(bestSide);
        const entities: VisualEntity[] = vertices.map((label, i) => ({
            id: `node-${label}`,
            type: "node",
            label: `${label}${i === sink ? " (sink)" : ""}`,
            value: label,
            state: stateOf(i),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                label,
                region: i === sink ? "sink" : sourceSet.has(i) ? "source" : awake.has(i) ? "awake" : "dormant",
                inBestCut: inBest.has(i),
            },
        }));
        frames.push({
            stepNumber: step,
            entities,
            edges: edgeList.map(([u, v, w], i) => {
                const iu = index.get(u) ?? -1;
                const iv = index.get(v) ?? -1;
                return {
                    id: `edge-${i}`,
                    sourceId: `node-${u}`,
                    targetId: `node-${v}`,
                    label: String(w),
                    state: inBest.has(iu) !== inBest.has(iv) ? "path" : "idle",
                    directed: false,
                };
            }),
            description,
            codeLineNumber,
            layout: "graph",
            meta: {
                vertices: n,
                edges: edgeList.length,
                phases,
                dormancies,
                bestCut: bestValue,
                awake: awake.size,
                dormantSets: dormant.length,
                ...extra,
            },
        });
        step += 1;
    };

    if (n < 2) {
        emit(new Set([0]), new Set(), [], -1, "Fewer than two vertices - no nontrivial cut exists.", 0, 0, [], { bestCut: 0 });
        yield* frames;
        return;
    }

    const arcs: Arc[] = [];
    const adjacency: number[][] = vertices.map(() => []);
    for (const [u, v, w] of edgeList) {
        const a = index.get(u);
        const b = index.get(v);
        if (a === undefined || b === undefined || a === b) {
            continue;
        }
        const forward = arcs.length;
        arcs.push({ to: b, cap: w, rev: forward + 1 });
        adjacency[a]?.push(forward);
        arcs.push({ to: a, cap: w, rev: forward });
        adjacency[b]?.push(forward + 1);
    }

    const root = 0;
    const height = new Array<number>(n).fill(0);
    const excess = new Array<number>(n).fill(0);
    height[root] = n;
    const sourceSet = new Set<number>([root]);
    const awake = new Set<number>(vertices.map((_, i) => i).filter((i) => i !== root));
    const dormant: number[][] = [];
    for (const a of adjacency[root] ?? []) {
        const arc = arcs[a];
        if (!arc || arc.cap <= 0) {
            continue;
        }
        const amount = arc.cap;
        arc.cap = 0;
        const reverse = arcs[arc.rev];
        if (reverse) {
            reverse.cap += amount;
        }
        excess[arc.to] = (excess[arc.to] ?? 0) + amount;
    }

    const leastLabelVertex = (): number => {
        let target = -1;
        for (const v of awake) {
            if (target === -1 || (height[v] ?? 0) < (height[target] ?? 0)) {
                target = v;
            }
        }
        return target;
    };

    const cutCapacity = (side: Set<number>): number => {
        let value = 0;
        for (const [u, v, w] of edgeList) {
            const a = index.get(u);
            const b = index.get(v);
            if (a === undefined || b === undefined || a === b) {
                continue;
            }
            if (side.has(a) !== side.has(b)) {
                value += w;
            }
        }
        return value;
    };

    let sink = leastLabelVertex();
    let bestValue = Infinity;
    let bestSide: number[] = [];
    emit(sourceSet, awake, dormant, sink, `Rooted at ${vertices[root]}; initial sink is ${vertices[sink] ?? "none"}.`, 0, bestValue, bestSide);

    let guard = 0;
    while (sink >= 0 && guard < 10000) {
        guard += 1;
        phases += 1;
        let work = 0;
        for (;;) {
            work += 1;
            if (work > 10000) {
                break;
            }
            let active = -1;
            for (const v of awake) {
                if (v !== sink && (excess[v] ?? 0) > 0) {
                    active = v;
                    break;
                }
            }
            if (active === -1) {
                break;
            }
            let advanced = false;
            for (const a of adjacency[active] ?? []) {
                const arc = arcs[a];
                if (!arc || arc.cap <= 0 || !awake.has(arc.to) ||
                    (height[active] ?? 0) !== (height[arc.to] ?? 0) + 1) {
                    continue;
                }
                const amount = Math.min(excess[active] ?? 0, arc.cap);
                arc.cap -= amount;
                const reverse = arcs[arc.rev];
                if (reverse) {
                    reverse.cap += amount;
                }
                excess[active] = (excess[active] ?? 0) - amount;
                excess[arc.to] = (excess[arc.to] ?? 0) + amount;
                advanced = true;
                break;
            }
            if (advanced) {
                continue;
            }
            const sameLabel = [...awake].filter((v) => (height[v] ?? 0) === (height[active] ?? 0));
            if (sameLabel.length === 1) {
                const moved: number[] = [];
                for (const v of [...awake]) {
                    if ((height[v] ?? 0) >= (height[active] ?? 0)) {
                        awake.delete(v);
                        moved.push(v);
                    }
                }
                dormant.push(moved);
                dormancies += 1;
            } else {
                let hasResidual = false;
                let lowest = Infinity;
                for (const a of adjacency[active] ?? []) {
                    const arc = arcs[a];
                    if (arc && arc.cap > 0 && awake.has(arc.to)) {
                        hasResidual = true;
                        lowest = Math.min(lowest, height[arc.to] ?? 0);
                    }
                }
                if (!hasResidual) {
                    awake.delete(active);
                    dormant.push([active]);
                    dormancies += 1;
                } else {
                    height[active] = lowest + 1;
                }
            }
        }

        const side = new Set<number>(vertices.map((_, i) => i).filter((i) => !awake.has(i)));
        const value = cutCapacity(side);
        if (value < bestValue && side.size > 0 && side.size < n) {
            bestValue = value;
            bestSide = [...side].sort((a, b) => a - b);
        }
        emit(
            sourceSet,
            awake,
            dormant,
            sink,
            `Phase ${phases}: cut of capacity ${value} separates the dormant/source side from ${[...awake].map((v) => vertices[v]).join(", ") || "no one"}.`,
            5,
            bestValue,
            bestSide,
            { phaseCut: value },
        );

        sourceSet.add(sink);
        awake.delete(sink);
        height[sink] = n;
        for (const a of adjacency[sink] ?? []) {
            const arc = arcs[a];
            if (!arc || arc.cap <= 0 || sourceSet.has(arc.to)) {
                continue;
            }
            const amount = arc.cap;
            arc.cap = 0;
            const reverse = arcs[arc.rev];
            if (reverse) {
                reverse.cap += amount;
            }
            excess[arc.to] = (excess[arc.to] ?? 0) + amount;
        }
        if (awake.size === 0 && dormant.length > 0) {
            const revived = dormant.pop() ?? [];
            for (const v of revived) {
                awake.add(v);
            }
        }
        sink = leastLabelVertex();
        if (sink < 0) {
            break;
        }
    }

    emit(
        sourceSet,
        awake,
        dormant,
        -1,
        `Global minimum cut has capacity ${bestValue}, side ${bestSide.map((i) => vertices[i]).join(", ") || "empty"}.`,
        7,
        bestValue,
        bestSide,
        { bestCut: bestValue },
    );
    yield* frames;
}

const module: AlgorithmModule = {
    id: "hao-orlin-min-cut",
    name: "Hao-Orlin Minimum Cut",
    category: "flow",
    complexity: { time: "O(V²E)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["a", "b", "c", "d", "e"],
        edges: [
            ["a", "b", 4], ["a", "c", 6], ["b", "c", 2], ["b", "d", 5],
            ["c", "d", 3], ["c", "e", 7], ["d", "e", 4],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "choose a root and make it the only permanent source",
        "saturate every arc leaving the root and pick the lowest-label sink",
        "push flow from active awake vertices along admissible arcs",
        "put unreachable vertices into a dormant set when stuck",
        "record the cut between dormant and awake vertices",
        "promote the sink into the source set and saturate its outgoing arcs",
        "revive the newest dormant set if the awake set is empty",
        "choose the next sink and stop when none remains",
        "report the smallest cut found over all phases",
    ],
    education: {
        intuition:
            "A global minimum cut is the cheapest way to split a graph in two. Instead of running a separate max flow for every possible sink, Hao-Orlin keeps one preflow alive: when a sink is finished it joins the source set, and another awake vertex takes its place. Vertices that can no longer reach the sink are parked in dormant sets and revived later.",
        invariants: [
            "Every arc from the source set into the awake set is saturated at the end of a phase.",
            "No residual arc goes from a dormant vertex into the awake set.",
            "Each recorded cut separates the source and dormant vertices from the awake vertices.",
        ],
        correctness:
            "When no active vertex remains below the cut level, all arcs leaving the recorded side are saturated, so its capacity equals the flow value and it is a minimum cut for the current source set and sink. As the sink is promoted to the source set in every phase, one of these cuts is a minimum cut that contains the root; on an undirected graph the complement has the same capacity, so this is the global minimum cut.",
        complexityRationale:
            "Each of the V-1 phases ends with all active excess drained, and a simple active-vertex scan performs O(V^2 E) work overall. Residuals, heights, excesses, and dormant sets use O(V + E) space.",
        uses: [
            "Global min cut in undirected networks",
            "Network reliability and vulnerability analysis",
            "A subroutine for recursive min-cut algorithms",
        ],
        references: [
            "Hao and Orlin, A Faster Algorithm for Finding the Minimum Cut in a Graph, SODA 1992",
            "Ahuja, Magnanti, and Orlin, Network Flows, 1993",
        ],
        workedExample:
            "On a five-vertex graph where a and c connect to b and d with capacities 4 and 6, the first phase isolates b with a cut of capacity 4. Promoting b to the source set and continuing through the other vertices reveals whether a cheaper split, such as one of capacity 3, exists elsewhere.",
    },
};

export default module;
