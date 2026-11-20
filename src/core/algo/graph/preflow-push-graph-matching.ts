/**
 * preflow-push-graph-matching.ts - Maximum Bipartite Matching by Preflow-Push
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A bipartite matching problem becomes a unit-capacity flow network: a source
 * feeds every left vertex, left-to-right edges carry at most one unit, and
 * every right vertex feeds the sink. A highest-label preflow-push routine
 * sends flow with pushes and relabels instead of augmenting paths, and the
 * saturated left-to-right arcs at the end are the matched pairs. The unit
 * capacities guarantee the flow value equals the matching cardinality.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^2 sqrt(E)) for unit networks with highest-label preflow-push
 *   Space: O(V + E) for the residual graph, heights, and excesses
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Left and right vertices plus source and sink are graph nodes.
 *   - Saturated arcs are GREEN (path); the currently active node is YELLOW.
 *   - meta reports flow value, the matched pairs, pushes, and relabels.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualFrame } from "@/types";

interface Arc {
    to: number;
    cap: number;
    rev: number;
}

interface LRArc {
    u: number;
    v: number;
    index: number;
    left: string;
    right: string;
}

const defaultEdges: Array<[string, string]> = [
    ["a", "1"],
    ["a", "2"],
    ["b", "1"],
    ["b", "3"],
    ["c", "2"],
    ["c", "4"],
    ["d", "3"],
    ["d", "4"],
];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { left?: string[]; right?: string[]; edges?: Array<[string, string]> } | null) ?? {};
    const left = Array.isArray(task.left) && task.left.length > 0 ? task.left.map(String) : ["a", "b", "c", "d"];
    const right = Array.isArray(task.right) && task.right.length > 0 ? task.right.map(String) : ["1", "2", "3", "4"];
    const pairs = Array.isArray(task.edges) ? task.edges : defaultEdges;
    const edges = pairs
        .filter((e) => Array.isArray(e) && e.length >= 2)
        .map((e) => [String(e[0]), String(e[1])] as [string, string])
        .filter(([u, v]) => left.includes(u) && right.includes(v));

    const L = left.length;
    const R = right.length;
    const source = 0;
    const sink = 1 + L + R;
    const total = sink + 1;
    const graph: Arc[][] = Array.from({ length: total }, () => []);
    const addArc = (u: number, v: number): number => {
        const forward: Arc = { to: v, cap: 1, rev: graph[v]!.length };
        const reverse: Arc = { to: u, cap: 0, rev: graph[u]!.length };
        graph[u]!.push(forward);
        graph[v]!.push(reverse);
        return graph[u]!.length - 1;
    };
    const leftArcs = left.map((_, i) => addArc(source, 1 + i));
    const rightArcs = right.map((_, j) => addArc(1 + L + j, sink));
    const lrArcs: LRArc[] = edges.map(([u, v]) => ({
        u: 1 + left.indexOf(u),
        v: 1 + L + right.indexOf(v),
        index: -1,
        left: u,
        right: v,
    }));
    for (const arc of lrArcs) {
        arc.index = addArc(arc.u, arc.v);
    }

    const height = Array<number>(total).fill(0);
    const excess = Array<number>(total).fill(0);
    height[source] = total;
    for (const arcIndex of leftArcs) {
        const arc = graph[source]![arcIndex]!;
        arc.cap = 0;
        graph[arc.to]![arc.rev]!.cap = 1;
        excess[arc.to]! += 1;
        excess[source]! -= 1;
    }

    let step = 0;
    let pushes = 0;
    let relabels = 0;
    let active = -1;

    const matchedPairs = (): string[] =>
        lrArcs.filter((arc) => graph[arc.u]![arc.index]!.cap === 0).map((arc) => `${arc.left}-${arc.right}`);

    const frame = (description: string, codeLineNumber: number): VisualFrame => {
        const entities: VisualFrame["entities"] = [
            {
                id: "node-S",
                type: "node",
                label: "S",
                value: excess[source] ?? 0,
                state: active === source ? "comparing" : "visited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { role: "source", excess: excess[source] ?? 0 },
            },
            ...left.map((v, i) => ({
                id: `node-L-${v}`,
                type: "node" as const,
                label: v,
                value: excess[1 + i] ?? 0,
                state: (active === 1 + i ? "comparing" : excess[1 + i] ? "highlight" : "unvisited") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { role: "left", excess: excess[1 + i] ?? 0, height: height[1 + i] ?? 0 },
            })),
            ...right.map((v, j) => ({
                id: `node-R-${v}`,
                type: "node" as const,
                label: v,
                value: excess[1 + L + j] ?? 0,
                state: (active === 1 + L + j ? "comparing" : excess[1 + L + j] ? "highlight" : "unvisited") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { role: "right", excess: excess[1 + L + j] ?? 0 },
            })),
            {
                id: "node-T",
                type: "node",
                label: "T",
                value: excess[sink] ?? 0,
                state: "sorted",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { role: "sink", excess: excess[sink] ?? 0 },
            },
        ];
        const visualEdges: VisualEdge[] = [
            ...leftArcs.map((_, i) => ({
                id: `arc-S-${i}`,
                sourceId: "node-S",
                targetId: `node-L-${left[i]}`,
                label: "1",
                state: (graph[source]![leftArcs[i]!]!.cap === 0 ? "path" : "idle") as EntityState,
                directed: true,
            })),
            ...lrArcs.map((arc, i) => ({
                id: `arc-LR-${i}`,
                sourceId: `node-L-${arc.left}`,
                targetId: `node-R-${arc.right}`,
                label: graph[arc.u]![arc.index]!.cap === 0 ? "1" : "0",
                state: (graph[arc.u]![arc.index]!.cap === 0 ? "path" : "idle") as EntityState,
                directed: true,
            })),
            ...rightArcs.map((_, j) => ({
                id: `arc-T-${j}`,
                sourceId: `node-R-${right[j]}`,
                targetId: "node-T",
                label: "1",
                state: (graph[1 + L + j]![rightArcs[j]!]!.cap === 0 ? "path" : "idle") as EntityState,
                directed: true,
            })),
        ];
        return {
            stepNumber: step++,
            entities,
            edges: visualEdges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: {
                flow: excess[sink] ?? 0,
                matching: matchedPairs(),
                pushes,
                relabels,
                leftCount: L,
                rightCount: R,
            },
        };
    };

    yield frame(`Bipartite matching on ${L} left and ${R} right vertices with ${edges.length} candidate edge(s).`, 0);

    const activeNodes = new Set<number>();
    for (let i = 0; i < L; i += 1) {
        if ((excess[1 + i] ?? 0) > 0) {
            activeNodes.add(1 + i);
        }
    }
    yield frame("Preflow starts by saturating every source arc, leaving one unit of excess at each left vertex.", 2);

    let guard = 0;
    while (activeNodes.size > 0 && guard < 5000) {
        guard += 1;
        let u = -1;
        for (const node of activeNodes) {
            if (u === -1 || (height[node] ?? 0) > (height[u] ?? 0)) {
                u = node;
            }
        }
        if (u === -1) {
            break;
        }
        active = u;
        let pushed = false;
        for (let i = 0; i < graph[u]!.length; i += 1) {
            const arc = graph[u]![i]!;
            if (arc.cap <= 0 || (height[arc.to] ?? 0) + 1 !== height[u]) {
                continue;
            }
            const amount = Math.min(excess[u] ?? 0, arc.cap);
            arc.cap -= amount;
            graph[arc.to]![arc.rev]!.cap += amount;
            excess[u] = (excess[u] ?? 0) - amount;
            excess[arc.to] = (excess[arc.to] ?? 0) + amount;
            pushes += 1;
            pushed = true;
            if (excess[u] === 0) {
                activeNodes.delete(u);
            }
            if (arc.to !== source && arc.to !== sink && (excess[arc.to] ?? 0) > 0) {
                activeNodes.add(arc.to);
            }
            const label = u === source ? "S" : u <= L ? left[u - 1] : u === sink ? "T" : right[u - 1 - L];
            const target = arc.to === source ? "S" : arc.to <= L ? left[arc.to - 1] : arc.to === sink ? "T" : right[arc.to - 1 - L];
            yield frame(`Push ${amount} unit from ${label} (height ${height[u]}) to ${target} along an admissible arc.`, 4);
            break;
        }
        if (!pushed) {
            let minimum = Infinity;
            for (const arc of graph[u]!) {
                if (arc.cap > 0) {
                    minimum = Math.min(minimum, height[arc.to] ?? 0);
                }
            }
            if (minimum === Infinity) {
                activeNodes.delete(u);
                continue;
            }
            height[u] = minimum + 1;
            relabels += 1;
            yield frame(`No admissible arc remains at ${u}; relabel it to height ${height[u]}.`, 5);
        }
    }

    const matching = matchedPairs();
    yield frame(
        `Maximum flow ${excess[sink] ?? 0}; ${matching.length} matched pair(s): ${matching.join(", ") || "none"}. Saturated left-to-right arcs form the matching.`,
        7,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Turn matching into a flow problem with unit pipes. A preflow pushes units from the source as far as they can go, and whenever a vertex gets stuck it raises its height so the next unit can roll downhill. When all excess has reached the sink, the saturated middle pipes are exactly the pairs we matched.",
        invariants: [
            "Every arc carries at most one unit because all capacities are one.",
            "A push follows an admissible arc whose target height is exactly one less.",
            "A left vertex appears in at most one matched pair because its source arc carries one unit.",
        ],
        correctness:
            "The constructed network has a one-to-one correspondence between integral flows and matchings: a unit crossing a left-to-right arc selects that pair, and the unit capacity on every source and sink arc prevents a vertex from being reused. Highest-label preflow-push terminates with a maximum flow once no active vertex remains, and preflow with integral capacities stays integral throughout, so the saturated left-to-right arcs form a maximum matching of the same size.",
        complexityRationale:
            "For a unit-capacity network the highest-label preflow-push algorithm runs in O(V^2 sqrt(E)) time, and the residual graph, heights, and excess arrays use O(V + E) space.",
        uses: [
            "Assigning workers to jobs under compatibility constraints",
            "Pairing applicants to slots in matching markets",
            "A flow-based alternative to Hopcroft-Karp for bipartite graphs",
        ],
        references: [
            "Goldberg and Tarjan, A New Approach to the Maximum-Flow Problem, 1988",
            "Kleinberg and Tardos, Algorithm Design, chapter on matchings and flows",
        ],
        workedExample:
            "With left vertices a,b and right vertices 1,2 and edges a-1, a-2, b-1, the preflow sends a to 1 and b to 2 after one relabel. Both source arcs are saturated, the sink receives two units, and the matching is a-1 plus b-2 of size two.",
    },
    id: "preflow-push-graph-matching",
    name: "Maximum Bipartite Matching via Preflow-Push",
    category: "graph",
    complexity: { time: "O(V^2 sqrt(E))", space: "O(V + E)" },
    defaultInput: { left: ["a", "b", "c", "d"], right: ["1", "2", "3", "4"], edges: defaultEdges },
    visualType: "graph",
    run,
    pseudocode: [
        "build a unit-capacity network from the bipartite graph",
        "feed one unit from the source to each left vertex",
        "while some vertex has positive excess",
        "choose the active vertex with the largest height",
        "push along an arc to a height-one-lower neighbor",
        "if no such arc exists, relabel the vertex above its lowest neighbor",
        "repeat until no active vertex remains",
        "done: saturated middle arcs are the matched pairs",
    ],
};

export default module;
