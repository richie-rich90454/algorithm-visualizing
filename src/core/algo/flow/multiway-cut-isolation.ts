/**
 * multiway-cut-isolation.ts - Isolating Cuts Multiway Cut
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The multiway cut problem removes a minimum-weight set of edges so that no
 * two terminals remain connected. This module implements the classic
 * isolating-cuts 2-approximation: for every terminal it computes a cheapest
 * cut separating that terminal from all other terminals, then discards the
 * union of those cuts. Removing those edges separates every pair of terminals,
 * and the remaining components are assigned to the terminal they contain.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * MF(n, m)) for k terminals and k max-flow computations
 *   Space: O(n^2) for the residual capacity matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Removed edges are YELLOW (comparing); remaining edges are idle.
 *   - Terminal nodes are GREEN (sorted); other nodes are visited.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Task {
    edges?: Array<[string, string, number?]>;
    terminals?: string[];
}

interface FlowResult {
    flow: number;
    reachable: boolean[];
}

function maxFlow(capacity: number[][], source: number, sink: number): FlowResult {
    const n = capacity.length;
    const residual = capacity.map((row) => [...row]);
    let flow = 0;
    while (true) {
        const parent = new Array<number>(n).fill(-1);
        parent[source] = -2;
        const queue = [source];
        for (let head = 0; head < queue.length && parent[sink] === -1; head += 1) {
            const u = queue[head] as number;
            for (let v = 0; v < n; v += 1) {
                if (parent[v] !== -1 || (residual[u]?.[v] ?? 0) <= 0) continue;
                parent[v] = u;
                queue.push(v);
                if (v === sink) break;
            }
        }
        if (parent[sink] === -1) break;
        let bottleneck = Infinity;
        let v = sink;
        while (v !== source) {
            const u = parent[v] as number;
            bottleneck = Math.min(bottleneck, residual[u]?.[v] ?? 0);
            v = u;
        }
        v = sink;
        while (v !== source) {
            const u = parent[v] as number;
            residual[u]![v] = (residual[u]![v] ?? 0) - bottleneck;
            residual[v]![u] = (residual[v]![u] ?? 0) + bottleneck;
            v = u;
        }
        flow += bottleneck;
    }
    const reachable = new Array<boolean>(n).fill(false);
    reachable[source] = true;
    const queue = [source];
    for (let head = 0; head < queue.length; head += 1) {
        const u = queue[head] as number;
        for (let v = 0; v < n; v += 1) {
            if (!reachable[v] && (residual[u]?.[v] ?? 0) > 0) {
                reachable[v] = true;
                queue.push(v);
            }
        }
    }
    return { flow, reachable };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const rawEdges = Array.isArray(task.edges) && task.edges.length > 0
        ? task.edges
        : ([
            ["A", "B", 2], ["A", "C", 1], ["B", "C", 2], ["B", "D", 3],
            ["C", "D", 1], ["D", "E", 2], ["E", "F", 3], ["D", "F", 2],
        ] as Array<[string, string, number?]>);
    const clean = rawEdges
        .filter((e) => Array.isArray(e) && typeof e[0] === "string" && typeof e[1] === "string")
        .map(([a, b, w]) => [a, b, typeof w === "number" && w > 0 ? w : 1] as [string, string, number]);
    const vertices = [...new Set(clean.flatMap(([a, b]) => [a, b]))].sort();
    const n = vertices.length;
    const index = new Map(vertices.map((v, i) => [v, i]));
    const requested = Array.isArray(task.terminals)
        ? task.terminals.filter((t): t is string => typeof t === "string" && index.has(t))
        : [];
    const terminals = requested.length >= 2 ? [...new Set(requested)].slice(0, Math.min(4, n)) : [vertices[0] ?? "A", vertices[n - 1] ?? "B"];

    const infinite = clean.reduce((s, e) => s + e[2], 0) + 1;
    const terminalIndices = terminals.map((t) => index.get(t) as number);
    const cutEdges = new Set<string>();
    let step = 0;

    const edgeList = clean
        .filter(([a, b]) => a !== b)
        .map(([a, b, w], i) => ({ a, b, w, id: `edge-${a}-${b}-${i}` }));

    const makeFrame = (description: string, codeLine: number, phase: string): VisualFrame => {
        const entities: VisualEntity[] = vertices.map((label) => ({
            id: `node-${label}`,
            type: "node" as const,
            label,
            value: label,
            state: (terminals.includes(label) ? "sorted" : "visited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label, terminal: terminals.includes(label) },
        }));
        const edges: VisualEdge[] = edgeList.map((e) => ({
            id: e.id,
            sourceId: `node-${e.a}`,
            targetId: `node-${e.b}`,
            label: String(e.w),
            state: (cutEdges.has(e.id) ? "comparing" : "idle") as EntityState,
            directed: false,
        }));
        const cost = edgeList.filter((e) => cutEdges.has(e.id)).reduce((s, e) => s + e.w, 0);
        return {
            stepNumber: step,
            entities,
            edges,
            description,
            codeLineNumber: codeLine,
            layout: "graph",
            meta: {
                phase,
                labels: vertices,
                terminals: terminals.join(","),
                cutEdges: edgeList.filter((e) => cutEdges.has(e.id)).map((e) => `${e.a}-${e.b}`).join(","),
                cost,
                terminalCount: terminals.length,
            },
        };
    };

    yield makeFrame(`Find a multiway cut separating ${terminals.join(", ")}.`, 0, "setup");
    step += 1;

    for (const terminal of terminals) {
        const source = n;
        const sink = n + 1;
        const capacity: number[][] = Array.from({ length: n + 2 }, () => new Array<number>(n + 2).fill(0));
        for (const e of edgeList) {
            const u = index.get(e.a) as number;
            const v = index.get(e.b) as number;
            capacity[u]![v] = (capacity[u]![v] ?? 0) + e.w;
            capacity[v]![u] = (capacity[v]![u] ?? 0) + e.w;
        }
        capacity[source]![index.get(terminal) as number] = infinite;
        for (const other of terminalIndices) {
            if (terminals[terminalIndices.indexOf(other)] === terminal) continue;
            capacity[other]![sink] = infinite;
        }
        const result = maxFlow(capacity, source, sink);
        let isolated = 0;
        for (const e of edgeList) {
            const u = index.get(e.a) as number;
            const v = index.get(e.b) as number;
            if (result.reachable[u] !== result.reachable[v]) {
                cutEdges.add(e.id);
                isolated += 1;
            }
        }
        const frame = makeFrame(
            `Isolating cut for ${terminal}: cut ${isolated} edge(s) at cost ${result.flow}.`,
            2,
            "isolate",
        );
        yield frame;
        step += 1;
    }

    // Assign remaining components to the terminal they contain.
    const remaining = Array.from({ length: n }, () => new Array<number>(n).fill(0) as number[]);
    for (const e of edgeList) {
        if (cutEdges.has(e.id)) continue;
        const u = index.get(e.a) as number;
        const v = index.get(e.b) as number;
        remaining[u]![v] = 1;
        remaining[v]![u] = 1;
    }
    const assignment = new Array<number>(n).fill(-1);
    for (let i = 0; i < n; i += 1) {
        if (assignment[i] !== -1) continue;
        const queue = [i];
        assignment[i] = i;
        let owner = terminalIndices.includes(i) ? i : -1;
        for (let head = 0; head < queue.length; head += 1) {
            const u = queue[head] as number;
            if (terminalIndices.includes(u)) owner = u;
            for (let v = 0; v < n; v += 1) {
                if (remaining[u]![v] === 1 && assignment[v] === -1) {
                    assignment[v] = i;
                    queue.push(v);
                }
            }
        }
        if (owner === -1) owner = terminalIndices[0] as number;
        for (const member of queue) assignment[member] = owner;
    }
    const groups = terminals.map((t) => {
        const owner = index.get(t) as number;
        return vertices.filter((_, i) => assignment[i] === owner).join(",");
    });

    const final = makeFrame(
        `Removed ${cutEdges.size} edge(s); ${terminals.length} terminals are now separated.`,
        5,
        "done",
    );
    final.meta["groups"] = groups.join("|");
    final.meta["valid"] = new Set(terminalIndices.map((t) => assignment[t])).size === terminals.length;
    yield final;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To keep terminals apart, cut each one off from all the others and throw away every edge that any of those cuts used. A single isolating cut is cheap for one terminal but may duplicate edges chosen for another; taking the union costs at most twice the true optimum while guaranteeing that no two terminals stay connected. The leftover pieces are then assigned to whichever terminal each piece contains.",
        invariants: [
            "Every isolating cut separates its terminal from all other terminals.",
            "The removed set is a union of isolating cuts, so it separates every terminal pair.",
            "After removal, each connected component contains at most one terminal.",
        ],
        correctness:
            "Consider an optimal multiway cut and, for each terminal t, the portion of the graph containing t after removal. The cut separating that portion from the rest is a valid isolating cut for t, so the cheapest isolating cut costs no more than that portion's boundary. Summing over terminals counts each optimal edge at most twice, hence the union of the chosen isolating cuts costs at most twice the optimum. Removing the union leaves no terminal-to-terminal path because each terminal's isolating cut alone blocks all such paths from it.",
        complexityRationale:
            "One max-flow computation is performed per terminal, so time is O(k * MF(n, m)) where MF is the cost of a single flow. Residual capacity matrices occupy O(n^2) space and are rebuilt for each terminal.",
        uses: [
            "Partitioning circuits into electrically isolated regions",
            "Dividing a network into zones with limited inter-zone links",
            "Approximation algorithms for labeling and segmentation problems",
        ],
        references: [
            "Dahlhaus, Johnson, Papadimitriou, Seymour, and Yannakakis, The Complexity of Multiway Cuts, 1992",
            "CLRS, Introduction to Algorithms, Chapter 26 on flows and cuts",
        ],
        workedExample:
            "On a path A-B-C-D with terminals A, B, and D, the isolating cut for A removes edge A-B, for B removes B-C, and for D removes C-D. The union separates all three terminals, and any valid multiway cut must remove at least two of those edges, so the result is within a factor of two of optimal.",
    },
    id: "multiway-cut-isolation",
    name: "Multiway Cut by Isolating Cuts",
    category: "flow",
    complexity: { time: "O(k * MF(n, m))", space: "O(n^2)" },
    defaultInput: {
        edges: [["A", "B", 2], ["A", "C", 1], ["B", "C", 2], ["B", "D", 3], ["C", "D", 1], ["D", "E", 2], ["E", "F", 3], ["D", "F", 2]],
        terminals: ["A", "C", "F"],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the undirected weighted graph and terminal list",
        "for each terminal",
        "connect it to a super source and other terminals to a super sink",
        "compute a minimum isolating cut with max flow",
        "add every cut edge to the global removal set",
        "remove the union and find the remaining components",
        "assign each component to the terminal it contains",
        "done: report the removed edges and groups",
    ],
};

export default module;
