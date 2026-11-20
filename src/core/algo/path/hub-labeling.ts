/**
 * hub-labeling.ts - Hub Labeling for Shortest Path Queries
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Hub labeling precomputes, for every vertex, a short list of landmark hubs
 * together with the distance to each hub. A shortest-path query between s and
 * t is answered by taking the minimum of label(s, h) + label(t, h) over hubs
 * common to both labels. Hubs are chosen greedily: each new hub should lie on
 * a shortest path for as many still-uncovered vertex pairs as possible, where
 * a hub h covers pair (s, t) when d(s, h) + d(h, t) equals d(s, t).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) for all-pairs BFS plus O(n^4) for greedy hub selection
 *   Space: O(n^2) for the distance table and labels
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Hub vertices are GREEN (sorted); other vertices are visited.
 *   - The caption names the hub chosen this round and how many pairs it covers.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Task {
    edges?: Array<[string, string]>;
    hubCount?: number;
}

/** Breadth-first distances from one vertex in an undirected graph. */
function bfs(start: number, adjacency: number[][]): number[] {
    const n = adjacency.length;
    const dist = new Array<number>(n).fill(-1);
    dist[start] = 0;
    const queue = [start];
    for (let head = 0; head < queue.length; head += 1) {
        const u = queue[head] as number;
        for (const v of adjacency[u] ?? []) {
            if (dist[v] !== -1) continue;
            dist[v] = (dist[u] as number) + 1;
            queue.push(v);
        }
    }
    return dist;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const rawEdges = Array.isArray(task.edges) && task.edges.length > 0
        ? task.edges
        : ([
            ["A", "B"], ["A", "C"], ["B", "D"], ["C", "D"],
            ["D", "E"], ["E", "F"], ["E", "G"], ["F", "G"], ["G", "H"],
        ] as Array<[string, string]>);
    const pairs = rawEdges
        .filter((e) => Array.isArray(e) && typeof e[0] === "string" && typeof e[1] === "string")
        .map(([a, b]) => [a, b] as [string, string]);
    const vertices = [...new Set(pairs.flatMap(([a, b]) => [a, b]))].sort();
    const n = vertices.length;
    const index = new Map(vertices.map((v, i) => [v, i]));
    const adjacency: number[][] = Array.from({ length: n }, () => []);
    for (const [a, b] of pairs) {
        const u = index.get(a);
        const v = index.get(b);
        if (u === undefined || v === undefined || u === v) continue;
        if (!(adjacency[u] as number[]).includes(v)) (adjacency[u] as number[]).push(v);
        if (!(adjacency[v] as number[]).includes(u)) (adjacency[v] as number[]).push(u);
    }

    const edges: VisualEdge[] = pairs
        .filter(([a, b]) => a !== b)
        .map(([a, b]) => ({
            id: `edge-${a}-${b}`,
            sourceId: `node-${a}`,
            targetId: `node-${b}`,
            label: "",
            state: "idle" as const,
            directed: false,
        }));

    const dist = vertices.map((_, i) => bfs(i, adjacency));
    const covered = new Set<string>();
    const allPairs: Array<[number, number]> = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            if ((dist[i]?.[j] ?? -1) >= 0) allPairs.push([i, j]);
        }
    }
    const key = (i: number, j: number): string => `${i}-${j}`;
    for (const [i, j] of allPairs) covered.add(key(i, j));

    const maxHubs = Math.max(0, Math.min(n, Math.floor(Number(task.hubCount ?? n)) || n));
    const hubs: number[] = [];
    let step = 0;

    const makeNodes = (): VisualEntity[] =>
        vertices.map((label, i) => ({
            id: `node-${label}`,
            type: "node" as const,
            label: hubs.includes(i) ? `${label}*` : label,
            value: label,
            state: (hubs.includes(i) ? "sorted" : "visited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label, hub: hubs.includes(i) },
        }));

    yield {
        stepNumber: step,
        entities: makeNodes(),
        edges: edges.map((e) => ({ ...e })),
        description: `Computed all-pairs distances for ${n} vertices; ${allPairs.length} pairs need coverage.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { phase: "setup", hubs: "", hubCount: 0, pairCount: allPairs.length, uncovered: covered.size },
    };
    step += 1;

    while (covered.size > 0 && hubs.length < maxHubs) {
        let bestHub = -1;
        let bestGain = -1;
        for (let h = 0; h < n; h += 1) {
            if (hubs.includes(h)) continue;
            let gain = 0;
            for (const [i, j] of allPairs) {
                if (!covered.has(key(i, j))) continue;
                if ((dist[i]?.[h] ?? -1) >= 0 && (dist[h]?.[j] ?? -1) >= 0
                    && (dist[i]?.[h] as number) + (dist[h]?.[j] as number) === (dist[i]?.[j] as number)) {
                    gain += 1;
                }
            }
            if (gain > bestGain) {
                bestGain = gain;
                bestHub = h;
            }
        }
        if (bestHub < 0 || bestGain <= 0) break;
        hubs.push(bestHub);
        for (const [i, j] of allPairs) {
            if (!covered.has(key(i, j))) continue;
            if ((dist[i]?.[bestHub] ?? -1) >= 0 && (dist[bestHub]?.[j] ?? -1) >= 0
                && (dist[i]?.[bestHub] as number) + (dist[bestHub]?.[j] as number) === (dist[i]?.[j] as number)) {
                covered.delete(key(i, j));
            }
        }
        yield {
            stepNumber: step,
            entities: makeNodes(),
            edges: edges.map((e) => ({ ...e })),
            description: `Chose hub ${vertices[bestHub]}: covers ${bestGain} new pairs, ${covered.size} remain.`,
            codeLineNumber: 2,
            layout: "graph",
            meta: { phase: "select", hubs: hubs.map((h) => vertices[h]).join(","), hubCount: hubs.length, pairCount: allPairs.length, uncovered: covered.size },
        };
        step += 1;
    }

    const labels = vertices.map((_, i) => hubs.map((h) => ({ hub: h, distance: dist[i]?.[h] ?? -1 })));
    const query = (s: number, t: number): number => {
        let best = Infinity;
        for (let k = 0; k < hubs.length; k += 1) {
            const ds = labels[s]?.[k]?.distance ?? -1;
            const dt = labels[t]?.[k]?.distance ?? -1;
            if (ds < 0 || dt < 0) continue;
            best = Math.min(best, ds + dt);
        }
        return best === Infinity ? -1 : best;
    };
    const sample = allPairs.slice(0, 8).map(([i, j]) => `${vertices[i]}->${vertices[j]}=${query(i, j)}`);

    yield {
        stepNumber: step,
        entities: makeNodes(),
        edges: edges.map((e) => ({ ...e })),
        description: `Built labels for ${hubs.length} hub(s); sample queries answered from labels.`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { phase: "query", hubs: hubs.map((h) => vertices[h]).join(","), hubCount: hubs.length, pairCount: allPairs.length, uncovered: covered.size, sampleQueries: sample },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeNodes(),
        edges: edges.map((e) => ({ ...e })),
        description: `Hub labeling complete: ${hubs.length} hub(s) cover all ${allPairs.length} reachable pairs.`,
        codeLineNumber: 7,
        layout: "graph",
        meta: { phase: "done", hubs: hubs.map((h) => vertices[h]).join(","), hubCount: hubs.length, pairCount: allPairs.length, uncovered: covered.size, sampleQueries: sample },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of searching the graph for every query, precompute a few landmark vertices and remember how far every vertex is from each landmark. To go from s to t, combine the two labels over every shared landmark and keep the cheapest total. A landmark helps a pair only when it sits on one of their shortest paths, so hubs are picked to cover as many still-unanswered pairs as possible.",
        invariants: [
            "A pair is removed from the uncovered set only when some chosen hub lies on a shortest path between its endpoints.",
            "Every label entry equals a true shortest-path distance to that hub.",
            "A query result is never smaller than the true distance, by the triangle inequality.",
        ],
        correctness:
            "For any hub h, label(s, h) plus label(t, h) is the length of an s-to-t walk through h, so it is at least the true shortest distance. When h lies on a shortest s-to-t path, the sum equals that distance. The greedy loop removes a pair only after selecting such a hub, and it continues until no reachable pair remains uncovered, so every query attains the minimum and therefore returns the exact distance.",
        complexityRationale:
            "All-pairs breadth-first search costs O(n * (n + m)). Each of at most n hub selections scores every candidate against every uncovered pair in O(n^3) worst case, and there are O(n) rounds, giving O(n^4) on dense inputs. The distance matrix and labels occupy O(n^2) space.",
        uses: [
            "Fast shortest-path queries on road networks",
            "Distance oracle preprocessing for large graphs",
            "Repeated point-to-point routing where queries vastly outnumber updates",
        ],
        references: [
            "Abraham, Fiat, Goldberg, and Werneck, Hub Labeling, 2011",
            "Geisberger, Sanders, Schultes, and Delling, Contraction Hierarchies, 2008",
        ],
        workedExample:
            "On the path A-B-C-D with hubs B and C, the label of A is (B:1, C:2) and the label of D is (B:2, C:1). Query A to D takes the minimum of 1+2 through B and 2+1 through C, which is 3, the true distance. Hub B alone covers that pair because it lies on the shortest path.",
    },
    id: "hub-labeling",
    name: "Hub Labeling",
    category: "shortest-path",
    complexity: { time: "O(n^4)", space: "O(n^2)" },
    defaultInput: {
        edges: [["A", "B"], ["A", "C"], ["B", "D"], ["C", "D"], ["D", "E"], ["E", "F"], ["E", "G"], ["F", "G"], ["G", "H"]],
        hubCount: 3,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "compute all-pairs shortest-path distances",
        "mark every reachable vertex pair as uncovered",
        "while uncovered pairs remain and hubs are allowed",
        "pick the vertex covering the most uncovered pairs",
        "remove the pairs whose shortest path uses that hub",
        "store the distance from every vertex to every hub",
        "answer a query by the minimum shared-hub sum",
        "done: report the hubs and query results",
    ],
};

export default module;
